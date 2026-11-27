export type RunTable = {
  title: string;
  columns: string[];
  rows: string[][];
  note?: string;
};

export type RunDocument = {
  title: string;
  op: string;
  summary: string;
  base: number | null;
  createdAt: string;
  tables: RunTable[];
  checks: string[];
  script: string;
};

function text(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    const abs = Math.abs(value);
    if (abs !== 0 && abs < 0.001) return value < 0 ? '< .001' : '< .001';
    return String(Math.round(value * 1000) / 1000);
  }
  return String(value);
}

function tableFromReport(value: unknown): RunTable | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as { title?: unknown; columns?: unknown; rows?: unknown };
  const columns = Array.isArray(record.columns) ? record.columns.map(text).filter(Boolean) : [];
  const rows = Array.isArray(record.rows)
    ? record.rows.filter(row => Array.isArray(row)).map(row => (row as unknown[]).map(text))
    : [];
  if (!columns.length || !rows.length) return null;
  return { title: text(record.title) || 'Table', columns, rows };
}

function groupLabelMap(result: Record<string, unknown>): Map<string, string> {
  const labels = new Map<string, string>();
  const rows = result.group_descriptives;
  if (Array.isArray(rows)) {
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;
      const record = row as { group?: unknown; label?: unknown };
      const code = text(record.group);
      const label = text(record.label);
      if (code && label && label !== code) {
        labels.set(code, label);
        const stripped = code.replace(/\.0$/, '');
        if (stripped && stripped !== code) labels.set(stripped, label);
      }
    }
  }
  const prepared = result.group_labels;
  const names = result.group_names;
  if (Array.isArray(prepared) && Array.isArray(names)) {
    for (let index = 0; index < names.length; index += 1) {
      const code = text(names[index]);
      const label = text(prepared[index]);
      if (code && label && label !== code) {
        labels.set(code, label);
        const stripped = code.replace(/\.0$/, '');
        if (stripped && stripped !== code) labels.set(stripped, label);
      }
    }
  }
  return labels;
}

function groupTable(result: Record<string, unknown>): RunTable | null {
  const groups = result.group_descriptives;
  if (!Array.isArray(groups) || !groups.length) return null;
  const records = groups.filter(group => group && typeof group === 'object') as {
    group?: unknown;
    label?: unknown;
    n?: unknown;
    mean?: unknown;
    std?: unknown;
  }[];
  // Rank results carry medians. The shared Groups table is the one to show.
  if (!records.some(row => row.mean != null && Number.isFinite(Number(row.mean)))) {
    return null;
  }
  const rows = records
    .map(row => [text(row.label || row.group), text(row.n), text(row.mean), text(row.std)])
    .filter(row => row[0]);
  if (!rows.length) return null;
  return { title: 'Group means', columns: ['Group', 'n', 'Mean', 'SD'], rows };
}

function anovaTable(result: Record<string, unknown>): RunTable | null {
  const table = result.anova_table;
  if (!table || typeof table !== 'object' || Array.isArray(table)) return null;
  const rows = Object.entries(table as Record<string, unknown>)
    .filter(([, value]) => value && typeof value === 'object')
    .map(([name, value]) => {
      const row = value as Record<string, unknown>;
      return [
        name,
        text(row.sum_sq ?? row.ss),
        text(row.df),
        text(row.mean_sq ?? row.ms),
        text(row.F ?? row.f),
        text(row.PR_F ?? row.p ?? row.p_value),
      ];
    });
  if (!rows.length) return null;
  return { title: 'ANOVA', columns: ['Source', 'SS', 'df', 'MS', 'F', 'p'], rows };
}

export function runDocument(run: Record<string, unknown>): RunDocument {
  const report = (run.report && typeof run.report === 'object' ? run.report : {}) as Record<
    string,
    unknown
  >;
  const result = (run.result && typeof run.result === 'object' ? run.result : {}) as Record<
    string,
    unknown
  >;
  // Tool wrappers nest the engine book under result.result.
  const nested =
    result.result && typeof result.result === 'object' && !Array.isArray(result.result)
      ? (result.result as Record<string, unknown>)
      : result;
  const engine =
    Array.isArray(nested.group_descriptives) ||
    nested.u_statistic != null ||
    nested.h_statistic != null
      ? nested
      : result;
  const meta = (report.meta && typeof report.meta === 'object' ? report.meta : {}) as Record<
    string,
    unknown
  >;
  const tables = [
    ...((Array.isArray(report.tables) ? report.tables : [])
      .map(tableFromReport)
      .filter(Boolean) as RunTable[]),
  ];
  const groups = groupTable(engine);
  const anova = anovaTable(engine);
  if (groups && !tables.some(table => table.title === groups.title)) tables.unshift(groups);
  if (anova && !tables.some(table => table.title === anova.title)) tables.push(anova);
  const labelledGroups = groupLabelMap(engine);
  if (labelledGroups.size) {
    for (const table of tables) {
      if (table.title.trim().toLowerCase() !== 'groups') continue;
      table.rows = table.rows.map(row => {
        if (!row.length) return row;
        const code = row[0] || '';
        const named =
          labelledGroups.get(code) ||
          labelledGroups.get(code.replace(/\.0$/, '')) ||
          labelledGroups.get(`${code}.0`) ||
          code;
        return [named, ...row.slice(1)];
      });
    }
  }
  const checks: string[] = [];
  const seen = new Set<string>();
  const addCheck = (note: unknown) => {
    if (typeof note !== 'string' || !note.trim() || seen.has(note.trim())) return;
    seen.add(note.trim());
    checks.push(note.trim());
  };
  const noteList = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
  const assumptions = report.assumption_checks as
    | { notes?: unknown; warnings?: unknown }
    | undefined;
  for (const note of noteList(assumptions?.notes)) addCheck(note);
  for (const note of noteList(assumptions?.warnings)) addCheck(note);
  const trust = report.trust as { notes?: unknown; warnings?: unknown } | undefined;
  for (const note of noteList(trust?.notes)) addCheck(note);
  for (const note of noteList(trust?.warnings)) addCheck(note);
  const repro = report.reproducibility as { r_script?: unknown; python?: unknown } | undefined;
  const script =
    typeof repro?.r_script === 'string'
      ? repro.r_script
      : typeof repro?.python === 'string'
        ? repro.python
        : '';
  const rows = meta.rows_dataset;
  const bases = result.bases;
  const oneBase =
    Array.isArray(bases) && bases.length === 1 && bases[0] && typeof bases[0] === 'object'
      ? (bases[0] as { unweighted?: unknown }).unweighted
      : undefined;
  const exclusion = report.exclusion_summary as { rows_used?: unknown } | undefined;
  const answered = typeof oneBase === 'number' ? oneBase : exclusion?.rows_used;
  const base =
    typeof answered === 'number'
      ? answered
      : typeof result.n_used === 'number'
        ? result.n_used
        : typeof rows === 'number'
          ? rows
          : typeof result.n_rows === 'number'
            ? result.n_rows
            : null;
  const structured =
    report.answer_from_result === true && typeof report.answer === 'string'
      ? report.answer.trim()
      : '';
  return {
    title: text(meta.title) || text(run.title) || text(run.op) || 'Analysis',
    op: text(run.op),
    summary: structured || (typeof report.summary === 'string' ? report.summary.trim() : ''),
    base,
    createdAt: text(run.created_at) || text(meta.generated_at),
    tables,
    checks,
    script,
  };
}

function escapeCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export function documentCsv(document: RunDocument): string {
  return document.tables
    .map(table =>
      [
        table.title,
        table.columns.map(escapeCell).join(','),
        ...table.rows.map(row => row.map(escapeCell).join(',')),
      ].join('\n')
    )
    .join('\n\n');
}

export function documentMarkdown(document: RunDocument): string {
  const parts = [`# ${document.title}`];
  if (document.summary) parts.push(document.summary);
  if (document.base != null) parts.push(`Base: ${document.base}`);
  for (const table of document.tables) {
    const header = `| ${table.columns.join(' | ')} |`;
    const rule = `| ${table.columns.map(() => '---').join(' | ')} |`;
    const rows = table.rows.map(row => `| ${row.join(' | ')} |`);
    parts.push(`## ${table.title}`, [header, rule, ...rows].join('\n'));
  }
  if (document.checks.length)
    parts.push(`## Checks`, document.checks.map(check => `- ${check}`).join('\n'));
  if (document.script) parts.push('## Script', '```', document.script, '```');
  return parts.join('\n\n');
}

export function documentApa(document: RunDocument): string {
  const parts = [document.title];
  document.tables.forEach((table, index) => {
    parts.push(
      `Table ${index + 1}`,
      table.title,
      table.columns.join('\t'),
      ...table.rows.map(row => row.join('\t'))
    );
  });
  if (document.summary) parts.push(`Note. ${document.summary}`);
  return parts.filter(Boolean).join('\n');
}

export type ReportPinBar = { label: string; percent: number };

const BASE_CHART_LABEL =
  /^(weighted\s+base|unweighted\s+base|effective\s+base(?:\s*\(kish\))?|base\s*\(n\)|base\s*:?|deff|kish(?:\s+effective(?:\s+(?:base|n))?)?)$/i;
/** Respondent counts (incl. Kish ESS) — whole numbers for the reader (TEN-242). */
const COUNT_BASE_LABEL =
  /^(weighted\s+base|unweighted\s+base|effective\s+base(?:\s*\(kish\))?|base\s*\(n\)|base\s*:?|kish(?:\s+effective(?:\s+(?:base|n))?)?)$/i;
const DEFF_LABEL = /^deff$/i;
/** Ops whose slides are always a result / matrix table — never share % bars. */
const TABLE_SLIDE_OPS =
  /^(correlation|correlations|partial_correlation|canonical_correlation|spearman|pearson|kendall|ttest|ttest_indep|ttest_paired|mann_whitney|mann_whitney_u|wilcoxon|kruskal|anova|anova_oneway|anova_twoway|chi_square|chi_square_goodness|regression|linear_regression|logistic_regression|reliability|factor|pca|canonical)$/i;
const INDEX_COLUMN = /\bindex\b|idx\b/i;
const PEOPLE_COLUMN = /people|000s|projected|weighted\s*n|unweighted/i;
const CELL_IDX_TAIL = /\s*(?:·\s*)?idx\s*[\d,]+(?:\.\d+)?\s*$/i;

/** True when a stub label is a base / DEFF line, not a result item to chart. */
export function isBaseChartLabel(label: string): boolean {
  return BASE_CHART_LABEL.test(label.trim());
}

function isCountBaseLabel(label: string): boolean {
  return COUNT_BASE_LABEL.test(label.trim());
}

function isDeffLabel(label: string): boolean {
  return DEFF_LABEL.test(label.trim());
}

/** Correlation / hypothesis-test outputs become tables on a slide, never % bars. */
export function pinUsesTableSlide(op: string | undefined | null): boolean {
  return TABLE_SLIDE_OPS.test(String(op || '').trim());
}

function formatBaseFooterValue(raw: string, label = ''): string {
  const text = raw.replace(/%/g, '').replace(/,/g, '').trim();
  if (!text || text === '—' || text === '-') return '';
  const number = Number(text);
  if (!Number.isFinite(number)) return raw.trim();
  // Kish / base counts are whole; DEFF keeps decimals (TEN-242).
  if (
    isCountBaseLabel(label) ||
    Math.abs(number) >= 1000 ||
    Math.abs(number - Math.round(number)) < 1e-9
  ) {
    return Math.round(number).toLocaleString('en-GB');
  }
  const places = Math.abs(number) < 10 ? 2 : 1;
  return number.toLocaleString('en-GB', {
    minimumFractionDigits: places,
    maximumFractionDigits: places,
  });
}

/** Compact people count for a client slide footer (4.82m, 1,204). */
export function formatWeightedPeople(raw: string): string {
  const text = raw.replace(/%/g, '').replace(/,/g, '').trim();
  const number = Number(text);
  if (!Number.isFinite(number)) return raw.trim();
  const abs = Math.abs(number);
  if (abs >= 1_000_000) {
    const millions = number / 1_000_000;
    const places = abs >= 10_000_000 ? 1 : 2;
    return `${millions.toFixed(places).replace(/\.?0+$/, '')}m`;
  }
  if (abs >= 10_000) {
    return `${Math.round(number / 1000).toLocaleString('en-GB')}k`;
  }
  return Math.round(number).toLocaleString('en-GB');
}

/** Base / DEFF rows under a crosstab become a caption, never chart bars. */
export function baseFooterFromTable(table: RunTable | undefined): string {
  if (!table) return '';
  const parts: string[] = [];
  for (const row of table.rows) {
    const label = (row[0] || '').trim();
    if (!isBaseChartLabel(label)) continue;
    const value = formatBaseFooterValue(row[1] || '', label);
    if (!value) continue;
    parts.push(`${label} ${value}`);
  }
  return parts.join(' · ');
}

/**
 * Client-slide base line: audience + n + weighted people. DEFF stays off the deck.
 */
export function clientBaseFooterFromTable(
  table: RunTable | undefined,
  options?: { audienceLabel?: string }
): string {
  if (!table) return '';
  let weighted = '';
  let unweighted = '';
  let kish = '';
  for (const row of table.rows) {
    const label = (row[0] || '').trim();
    if (!isBaseChartLabel(label) || isDeffLabel(label)) continue;
    const value = formatBaseFooterValue(row[1] || '', label);
    if (!value) continue;
    const folded = label.toLowerCase();
    if (folded.startsWith('weighted')) weighted = row[1] || value;
    else if (folded.startsWith('unweighted') || folded === 'base (n)' || folded === 'base')
      unweighted = value;
    else if (folded.includes('kish') || folded.includes('effective')) kish = value;
  }
  const audience = String(options?.audienceLabel || '').trim();
  if (unweighted || weighted) {
    const bits: string[] = [];
    if (audience) bits.push(audience);
    if (unweighted) bits.push(`n = ${unweighted}`);
    if (weighted) bits.push(`weighted ${formatWeightedPeople(String(weighted))}`);
    else if (kish) bits.push(`Kish n = ${kish}`);
    return bits.length ? `Base: ${bits.join(', ')}` : '';
  }
  // Fall back to the diagnostic line without DEFF.
  const parts: string[] = [];
  for (const row of table.rows) {
    const label = (row[0] || '').trim();
    if (!isBaseChartLabel(label) || isDeffLabel(label)) continue;
    const value = formatBaseFooterValue(row[1] || '', label);
    if (!value) continue;
    parts.push(`${label} ${value}`);
  }
  return parts.join(' · ');
}

function looksLikeCorrelationTable(table: RunTable | undefined): boolean {
  if (!table) return false;
  const title = table.title.trim().toLowerCase();
  if (/correlation|spearman|pearson|kendall|\brho\b|\bτ\b/.test(title)) return true;
  const headers = table.columns.map(column => column.trim().toLowerCase());
  if (headers.some(column => /^(ρ|r|τ|tau|p|p-value|n)$/i.test(column))) return true;
  if (headers.some(column => /correlation/.test(column))) return true;
  return false;
}

function looksLikeTestStatTable(table: RunTable | undefined): boolean {
  if (!table) return false;
  const title = table.title.trim().toLowerCase();
  if (/\b(anova|t-?test|mann-?whitney|wilcoxon|kruskal|chi-?square|regression)\b/.test(title))
    return true;
  const headers = table.columns.map(column => column.trim().toLowerCase());
  return headers.some(column => /^(u|h|f|t|z|w|χ²|chi|df|p|p-value|statistic)$/i.test(column));
}

/** Non-stub columns that look like share / percent series (not index or people). */
export function shareSeriesIndexes(table: RunTable): number[] {
  const width = Math.max(table.columns.length, ...table.rows.map(row => row.length), 0);
  if (width < 2) return [];
  const indexes: number[] = [];
  for (let index = 1; index < width; index += 1) {
    const header = (table.columns[index] || '').trim();
    if (INDEX_COLUMN.test(header) || PEOPLE_COLUMN.test(header)) continue;
    if (/%|percent|share/i.test(header)) {
      indexes.push(index);
      continue;
    }
    const sample = table.rows
      .filter(row => !isBaseChartLabel((row[0] || '').trim()))
      .map(row => (row[index] || '').trim())
      .filter(Boolean);
    if (!sample.length) continue;
    if (sample.some(value => /%/.test(value))) {
      indexes.push(index);
      continue;
    }
    // Bare decimals can be shares or coefficients — only treat as shares when
    // several values sit outside the correlation [-1, 1] band or look like %.
    const numbers = sample
      .map(value => Number(value.replace(/,/g, '').replace(/%/g, '')))
      .filter(number => Number.isFinite(number));
    if (
      numbers.length &&
      numbers.every(number => Math.abs(number) <= 100) &&
      numbers.some(number => Math.abs(number) > 1)
    ) {
      indexes.push(index);
    }
  }
  return indexes;
}

/** Drop embedded "idx 100" clutter from a slide cell; keep the percent / count. */
export function stripSlideCellIndex(cell: string): string {
  const text = String(cell || '').trim();
  if (!text) return '';
  return (
    text
      .replace(CELL_IDX_TAIL, '')
      .replace(/\s+·\s+$/g, '')
      .trim() || text
  );
}

/**
 * Crosstab / frequency grid for a client slide: every source column, no base
 * rows, no idx tails. A lone "Total" header becomes the audience label when set.
 */
export function slideTableFromRunTable(
  table: RunTable | undefined,
  options?: { audienceLabel?: string }
): { title: string; columns: string[]; rows: string[][] } | null {
  if (!table) return null;
  const audience = String(options?.audienceLabel || '').trim();
  let columns = table.columns.map(column => column.trim());
  const dataIndexes = columns
    .map((column, index) => ({ column, index }))
    .filter(({ index, column }) => index > 0 && !INDEX_COLUMN.test(column));
  if (dataIndexes.length === 1 && audience) {
    const only = dataIndexes[0]!;
    if (/^total(?:\s*%)?$/i.test(only.column) || only.column === '%' || only.column === '') {
      columns = columns.map((column, index) => (index === only.index ? audience : column));
    }
  }
  // Drop dedicated index columns from the client slide (idx vs total is noise
  // when the series is already the audience, and chat already showed %).
  const keep = columns
    .map((column, index) => ({ column, index }))
    .filter(({ column, index }) => index === 0 || !INDEX_COLUMN.test(column));
  const body = table.rows
    .filter(row => {
      const label = (row[0] || '').trim();
      return label && !isBaseChartLabel(label);
    })
    .map(row => keep.map(({ index }) => stripSlideCellIndex(row[index] || '')));
  if (!body.length) return null;
  return {
    title: table.title,
    columns: keep.map(({ column }) => column),
    rows: body,
  };
}

/** The lead and the share bars a report card shows for a saved run. */
export function pinStory(document: RunDocument): {
  support: string;
  bars: ReportPinBar[];
  baseFooter: string;
} {
  const table =
    document.tables.find(item => item.columns.some(column => /%|percent|share/i.test(column))) ||
    document.tables.find(item => !/^columns$/i.test(item.title.trim())) ||
    document.tables[0];
  const audienceMatch = document.summary.match(
    /(?:among|for|audience[:\s]+)\s*([^.(]{3,80}?)(?:\.|,|$)/i
  );
  const audienceLabel = audienceMatch?.[1]?.trim() || '';
  const baseFooter = clientBaseFooterFromTable(table, { audienceLabel });
  if (
    pinUsesTableSlide(document.op) ||
    looksLikeCorrelationTable(table) ||
    looksLikeTestStatTable(table)
  ) {
    return { support: document.summary.trim(), bars: [], baseFooter };
  }
  const series = table ? shareSeriesIndexes(table) : [];
  // Total + audience (or any multi-series crosstab) stays a labelled table.
  if (series.length > 1) {
    return { support: document.summary.trim(), bars: [], baseFooter };
  }
  return {
    support: document.summary.trim(),
    bars: shareBars(table, series[0]),
    baseFooter,
  };
}

/**
 * Prefer this run's own summary / share bars over chat takeaway text so a slide
 * never picks up another output's commentary.
 */
export function enrichPinFromRunDocument(pin: ReportPin, document: RunDocument): ReportPin {
  const story = pinStory(document);
  const headline = (document.title || '').trim() || pin.headline;
  const support = story.support || pin.support;
  const forceTable = pinUsesTableSlide(document.op) || story.bars.length === 0;
  const bars = forceTable
    ? []
    : story.bars.length
      ? story.bars
      : (pin.bars || []).filter(bar => !isBaseChartLabel(bar.label));
  return {
    ...pin,
    headline,
    support,
    bars,
    op: document.op || pin.op || '',
    baseFooter: story.baseFooter || pin.baseFooter || '',
  };
}

function shareBars(table: RunTable | undefined, percentAtHint?: number): ReportPinBar[] {
  if (!table) return [];
  // Rows keep the stub label in cell 0 even when an empty header was dropped.
  const width = Math.max(table.columns.length, ...table.rows.map(row => row.length), 0);
  let percentAt =
    typeof percentAtHint === 'number' && percentAtHint >= 0
      ? percentAtHint
      : table.columns.findIndex(column => /%|percent|share/i.test(column));
  if (percentAt < 0 && width >= 2) {
    const series = shareSeriesIndexes(table);
    if (series.length === 1) percentAt = series[0]!;
    else if (series.length === 0) {
      const last = width - 1;
      const sample = table.rows.map(row => row[last] || '');
      if (sample.some(value => /%/.test(value))) percentAt = last;
    }
  }
  if (percentAt < 0) return [];
  // Never chart a coefficient / p / n column as a share bar.
  const header = (table.columns[percentAt] || '').trim();
  if (/^(ρ|r|τ|tau|p|p-value|n|df)$/i.test(header) || /correlation/i.test(header)) return [];
  const bars: ReportPinBar[] = [];
  for (const row of table.rows) {
    const label = (row[0] || '').trim();
    if (!label || isBaseChartLabel(label)) continue;
    const raw = stripSlideCellIndex(row[percentAt] || '')
      .replace('%', '')
      .replace(/,/g, '')
      .trim();
    const percent = Number(raw);
    if (!Number.isFinite(percent)) continue;
    bars.push({ label, percent: Math.round(percent * 10) / 10 });
    if (bars.length >= 8) break;
  }
  return bars;
}

/** A card that only has a type and a title still needs its lead and table. */
export function pinIsThin(pin: { support?: string; bars?: unknown[] }): boolean {
  const support = (pin.support || '').trim();
  return !pin.bars?.length && (!support || /^n\s*=/i.test(support));
}

export type ReportPin = {
  id: string;
  runId: string;
  datasetId?: string;
  headline: string;
  support: string;
  citation: string;
  afterId: string;
  deck: boolean;
  topline: boolean;
  keepLive: boolean;
  bars?: ReportPinBar[];
  /** Analysis op — correlation / tests force a table slide. */
  op?: string;
  /** Base caption under a slide chart or table (no DEFF on the client deck). */
  baseFooter?: string;
};

const PIN_KEY = 'tensr-report-pins';

export function pinKey(projectId: string): string {
  return `${PIN_KEY}:${projectId}`;
}

export function readPins(projectId: string, storage?: Storage): ReportPin[] {
  const box = storage || (typeof window === 'undefined' ? null : window.localStorage);
  if (!box) return [];
  try {
    const parsed = JSON.parse(box.getItem(pinKey(projectId)) || '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      pin => pin && typeof pin === 'object' && typeof (pin as ReportPin).runId === 'string'
    ) as ReportPin[];
  } catch {
    return [];
  }
}

export function writePins(projectId: string, pins: ReportPin[], storage?: Storage) {
  const box = storage || (typeof window === 'undefined' ? null : window.localStorage);
  if (!box) return;
  box.setItem(pinKey(projectId), JSON.stringify(pins));
}

export function placePins<T extends { id: string }>(
  findings: T[],
  pins: ReportPin[]
): ({ kind: 'finding'; item: T } | { kind: 'pin'; item: ReportPin })[] {
  const ordered: ({ kind: 'finding'; item: T } | { kind: 'pin'; item: ReportPin })[] = findings.map(
    item => ({
      kind: 'finding' as const,
      item,
    })
  );
  for (const pin of pins) {
    const index = pin.afterId
      ? ordered.findIndex(entry => entry.kind === 'finding' && entry.item.id === pin.afterId)
      : -1;
    const entry = { kind: 'pin' as const, item: pin };
    if (index >= 0) ordered.splice(index + 1, 0, entry);
    else if (pin.afterId === 'start') ordered.unshift(entry);
    else ordered.push(entry);
  }
  return ordered;
}
