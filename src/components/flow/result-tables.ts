import type { RunTable } from '@/components/flow/run-document';
import type { AnalysisReportChart } from '@/lib/analysis-report-types';
import { chartsFromToolPayloads } from '@/lib/flow-result-charts';
import type { DuplicationPanelData } from '@/components/flow/duplication-panel';

export type ResultView = {
  tables: RunTable[];
  charts: AnalysisReportChart[];
  script: string;
  checks: string[];
  weight: string;
  filter: string;
  audience: string;
  audienceDefinition: string;
  wave: string;
  source: string;
  /** match, mismatch, pending, or empty when this result has no R reproduction. */
  rCheck: string;
  rStatement: string;
  base: string;
  letterNote: string;
  /** Weight, sample size, missing, effective n, and the confidence level. */
  baseDetail?: string;
  /** study_brief when the table used the weight named in the brief. */
  weightSource?: string;
  universeThousands?: number;
  /** Paper 6n structured duplication card when the run is brand_duplication. */
  duplication?: DuplicationPanelData;
};

/** The builder table replaces the engine copy. A coefficients table with SE replaces the empty one. */
export function withoutEngineCopies<
  T extends { title?: string; columns?: string[]; superseded?: boolean },
>(tables: T[]): T[] {
  const titles = tables.map(table => (table.title || '').trim().toLowerCase());
  const has = (name: string) => titles.includes(name);
  const hasAnova = tables.some(table => {
    const title = (table.title || '').trim().toLowerCase();
    const columns = (table.columns || []).map(column => column.trim().toLowerCase());
    return (
      title === 'anova' ||
      title === 'welch anova' ||
      (columns.includes('source') && columns.includes('f'))
    );
  });
  const labelledCoefficients = tables.some(
    table =>
      (table.title || '').trim().toLowerCase() === 'coefficients' &&
      (table.columns || []).some(column => column.trim().toLowerCase() === 'se')
  );
  const hasLabelledCorrelation = titles.some(title => {
    if (title.includes('partial') || title.includes('canonical') || title.includes('matrix')) {
      return false;
    }
    if (title === 'correlations') return true;
    return /^(pearson|spearman|kendall) correlations?$/.test(title);
  });
  return tables.filter(table => {
    if (table.superseded) return false;
    const title = (table.title || '').trim().toLowerCase();
    const columns = (table.columns || []).map(column => column.trim().toLowerCase());
    if (
      hasLabelledCorrelation &&
      (title.includes('correlation matrix') || title.includes('correlation p-value'))
    ) {
      return false;
    }
    // Rank Groups/Test/Pairwise(U) must not sit under an ANOVA source table.
    if (hasAnova && (title === 'groups' || title === 'test')) return false;
    if (hasAnova && title === 'pairwise' && columns.includes('u')) return false;
    if (has('groups') && (title === 'group statistics' || title === 'group means')) return false;
    if (
      has('groups') &&
      columns.includes('status') &&
      (columns.includes('median') || columns.includes('mean rank'))
    ) {
      return false;
    }
    if (
      labelledCoefficients &&
      title === 'coefficients' &&
      !(table.columns || []).some(column => column.trim().toLowerCase() === 'se')
    ) {
      return false;
    }
    return true;
  });
}

function decimalKind(
  header: string,
  percentSign: boolean
): 'percent' | 'mean' | 'median' | 'whole' | 'tenth' | 'plain' {
  if (percentSign) return 'percent';
  const name = header.trim().toLowerCase().replace(/[_-]+/g, ' ');
  if (/%|percent|share/.test(name)) return 'percent';
  if (/weighted\s*n|weighted base/.test(name)) return 'whole';
  if (name === 'nps' || name.endsWith(' nps')) return 'tenth';
  if (/\bmedian\b/.test(name)) return 'median';
  if (/\b(mean|sd|std\.?|s\.d\.?|standard deviation)\b/.test(name)) return 'mean';
  if (
    /^(n|count|frequency|cases|df)$/.test(name) ||
    /\b(count|frequency)\b/.test(name) ||
    name.endsWith(' n')
  ) {
    return 'whole';
  }
  return 'plain';
}

function plainNumber(value: number): string {
  if (!Number.isFinite(value)) return '';
  if (Math.abs(value) >= 1000) {
    return new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 }).format(value);
  }
  const rounded = Math.round(value * 1000) / 1000;
  return String(rounded);
}

/** A count that arrived as 2.67896e+06 is shown as a normal number. */
export function shownCount(value: string): string {
  const text = value.trim().replace(/,/g, '');
  if (!/^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(text)) return value;
  const number = Number(text);
  if (!Number.isFinite(number)) return value;
  const scientific = /e[+-]?\d+$/i.test(text);
  if (Math.abs(number) < 1000 && !scientific) return value;
  return plainNumber(number);
}

/** Percents use the project decimals. Counts and weighted n are whole. Means and SDs are 2 dp. */
export function formatDecimalText(value: string, places: number, header = ''): string {
  value = shownCount(value);
  const match = value.trim().match(/^(-?\d[\d,]*)(\.\d+)?(%?)$/);
  if (!match?.[2]) return value;
  const number = Number(`${match[1].replace(/,/g, '')}${match[2]}`);
  if (!Number.isFinite(number)) return value;
  const kind = decimalKind(header, Boolean(match[3]));
  if (kind === 'plain') {
    const shown = number
      .toFixed(match[2].length - 1)
      .replace(/(\.\d*?)0+$/, '$1')
      .replace(/\.$/, '');
    return `${shown}${match[3] || ''}`;
  }
  const digits =
    kind === 'mean'
      ? 2
      : kind === 'tenth'
        ? 1
        : kind === 'percent' || kind === 'median'
          ? Math.max(0, Math.min(6, Math.trunc(places)))
          : 0;
  let shown = number.toFixed(digits);
  if (kind === 'percent' || kind === 'median')
    shown = shown.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  // Whole counts keep thousands separators after rounding (1221043.0 → 1,221,043).
  if (kind === 'whole' && Math.abs(number) >= 1000) {
    const whole = Number(shown);
    if (Number.isFinite(whole)) return `${plainNumber(whole)}${match[3] || ''}`;
  }
  return `${shown}${match[3] || ''}`;
}

function isPHeader(header: string): boolean {
  const name = header.trim().toLowerCase().replace(/[_-]+/g, ' ');
  return (
    name === 'p' ||
    name === 'p value' ||
    name === 'p adj' ||
    name === 'adjusted p' ||
    name.endsWith(' p')
  );
}

/** A p below .001 is shown as < .001, including a value that arrived in scientific notation. */
function shownP(value: unknown): string {
  const number =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && /e-/i.test(value.trim())
        ? Number(value)
        : Number.NaN;
  if (Number.isFinite(number) && number >= 0 && number < 0.001) return '< .001';
  return cell(value);
}

function oneDecimal(value: unknown): string {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return '';
  return (Math.round(number * 10) / 10).toFixed(1);
}

function cell(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    if (Math.abs(value) >= 1000) return plainNumber(value);
    const rounded = Math.round(value * 1000) / 1000;
    return String(rounded);
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const label = record.label ?? record.name ?? record.text ?? record.value ?? record.title;
    if (label != null && typeof label !== 'object') return cell(label);
    return '';
  }
  return shownCount(String(value).trim());
}

function questionTitle(title: string): string {
  const stripped = title.replace(/^frequency table:\s*/i, '').trim();
  return stripped || title || 'Table';
}

function percentCell(value: unknown): string {
  const text = cell(value);
  const number = Number(text);
  if (!text || Number.isNaN(number)) return text;
  if (Number.isInteger(number)) return String(number);
  return (Math.round(number * 10) / 10).toFixed(1);
}

/** A share with extra decimals becomes one decimal. Integers and other text stay. */
export function roundShareText(value: string): string {
  const match = value.trim().match(/^(-?\d[\d,]*)(\.\d+)?(%)?(\s+.*)?$/);
  if (!match?.[2] || match[2].length <= 2) return value;
  const number = Number(`${match[1].replace(/,/g, '')}${match[2]}`);
  if (!Number.isFinite(number)) return value;
  return `${(Math.round(number * 10) / 10).toFixed(1)}${match[3] || ''}${match[4] || ''}`;
}

const STAT_HEADER = /\b(mean|sd|std|s\.e\.|se|p-value|p value|statistic|df)\b/i;

function shareColumn(header: string, rows: string[][], index: number): boolean {
  if (/%|percent|share/i.test(header)) return true;
  if (STAT_HEADER.test(header)) return false;
  const values = rows.map(row => (row[index] || '').trim()).filter(Boolean);
  if (!values.length) return false;
  return values.every(value => {
    const match = value.match(/^(-?\d[\d,]*(?:\.\d+)?)%?$/);
    if (!match) return false;
    const number = Number(match[1].replace(/,/g, ''));
    return Number.isFinite(number) && Math.abs(number) <= 100;
  });
}

function markdownCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map(item => item.trim());
}

/**
 * Tables written into an answer, in the same shape as a result table.
 * Share cells use one decimal, matching the result grid.
 */
export function answerResultTables(answer: string): RunTable[] {
  const lines = String(answer || '').split('\n');
  const tables: RunTable[] = [];
  let index = 0;
  while (index < lines.length) {
    if (!lines[index].trim().startsWith('|')) {
      index += 1;
      continue;
    }
    const block: string[] = [];
    const start = index;
    while (index < lines.length && lines[index].trim().startsWith('|')) {
      block.push(lines[index]);
      index += 1;
    }
    const columns = markdownCells(block[0] || '');
    const rows = block
      .slice(1)
      .filter(line => !/^[\s|:-]+$/.test(line))
      .map(markdownCells)
      .filter(row => row.some(Boolean));
    if (columns.filter(Boolean).length < 2 || !rows.length) continue;
    let title = '';
    for (let cursor = start - 1; cursor >= 0; cursor -= 1) {
      const text = lines[cursor].trim();
      if (!text) continue;
      if (!text.startsWith('|') && text.length <= 80 && !/[.!?]$/.test(text)) title = text;
      break;
    }
    const shares = columns.map((column, columnIndex) => shareColumn(column, rows, columnIndex));
    tables.push({
      title,
      columns,
      rows: rows.map(row =>
        row.map((value, columnIndex) =>
          shares[columnIndex] || /%/.test(value) ? roundShareText(value) : value
        )
      ),
    });
  }
  return tables;
}

/** Shared frequency headers. A blank first cell used to shift counts under Percent. */
const FREQUENCY_HEADERS = ['Label', 'Count', '%', 'Valid %', 'Cumulative %'];
const MR_FREQUENCY_HEADERS = ['Label', 'Count', '% of respondents'];

function looksLikeFrequencyHeaders(columns: string[]): boolean {
  if (columns.length < 2) return false;
  const folded = columns.map(column => column.trim().toLowerCase());
  const first = folded[0];
  const hasCount = folded.some(
    column => column === 'frequency' || column === 'count' || column === 'n'
  );
  const hasPercent = folded.some(column => /%|percent/.test(column));
  if (first === '' && hasCount) return true;
  if (
    (first === '' || first === 'label' || first === 'answer' || first === 'value') &&
    hasCount &&
    hasPercent
  ) {
    return true;
  }
  return false;
}

function normalizeFrequencyColumns(
  columns: string[],
  opts?: { multipleResponse?: boolean }
): string[] {
  if (!looksLikeFrequencyHeaders(columns)) return columns;
  if (opts?.multipleResponse) {
    if (columns.some(column => /respondent/i.test(column))) return [...columns];
    return [...MR_FREQUENCY_HEADERS];
  }
  if (columns.length >= FREQUENCY_HEADERS.length) return [...FREQUENCY_HEADERS];
  return FREQUENCY_HEADERS.slice(0, Math.max(columns.length, 2));
}

/** Frequency % / Valid % / Cumulative %, or a header that names percent/share. Not "% of base". */
function isPercentHeader(column: string): boolean {
  const name = column.trim().toLowerCase();
  if (name.includes('percent') || name.includes('share') || name.includes('respondent'))
    return true;
  return name === '%' || name === 'valid %' || name === 'cumulative %' || /(?:^|\s)%$/.test(name);
}

function asTable(value: unknown): RunTable | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as {
    title?: unknown;
    columns?: unknown;
    rows?: unknown;
    headers?: unknown;
    variable_names?: unknown;
    note?: unknown;
    superseded?: unknown;
    multiple_response?: unknown;
    mr_base?: unknown;
  };
  if (record.superseded) return null;
  if (Array.isArray(record.headers) && Array.isArray(record.variable_names)) return null;
  let columns = Array.isArray(record.columns) ? record.columns.map(cell) : [];
  const titleText = cell(record.title);
  const title = questionTitle(titleText);
  const multipleResponse =
    Boolean(record.multiple_response) || record.mr_base === 'percent_of_respondents';
  if (looksLikeFrequencyHeaders(columns) || /^frequency table:/i.test(titleText)) {
    columns = normalizeFrequencyColumns(columns, { multipleResponse });
  }
  const percentAt = columns.map(isPercentHeader);
  const rows = Array.isArray(record.rows)
    ? record.rows
        .filter(row => Array.isArray(row))
        .map(row =>
          (row as unknown[]).map((value, index) =>
            percentAt[index] ? percentCell(value) : cell(value)
          )
        )
        .filter(row => row.some(Boolean))
    : [];
  if (columns.filter(Boolean).length < 2 || !rows.length) return null;
  const note = cell(record.note);
  return { title, columns, rows, ...(note ? { note } : {}) };
}

/** summary["table"]: one titled block per question, or a flat list of value rows. */
function summaryTables(table: unknown, fallbackTitle: string): RunTable[] {
  if (!Array.isArray(table) || !table.length) return [];
  const titled = table.every(
    item => item && typeof item === 'object' && Array.isArray((item as { rows?: unknown }).rows)
  );
  const blocks = titled
    ? (table as { title?: unknown; rows: unknown[] }[])
    : [{ title: fallbackTitle, rows: table }];
  const built: RunTable[] = [];
  for (const block of blocks) {
    const records = block.rows.filter(
      (row): row is Record<string, unknown> =>
        Boolean(row) && typeof row === 'object' && !Array.isArray(row)
    );
    const means = records.some(row => row.mean != null || row.sd != null || row.std != null);
    const body: string[][] = [];
    for (const record of records) {
      const label = cell(record.label ?? record.value ?? record.variable);
      const folded = label.toLowerCase();
      if (
        !label ||
        folded === 'total' ||
        folded === 'total respondents' ||
        folded === 'missing' ||
        folded === 'base'
      )
        continue;
      body.push(
        means
          ? [
              label,
              cell(record.mean),
              cell(record.sd ?? record.std),
              cell(record.median),
              cell(record.min),
              cell(record.max),
              cell(record.n),
            ]
          : [label, cell(record.frequency ?? record.n), percentCell(record.percent)]
      );
    }
    if (!body.length) continue;
    built.push({
      title: questionTitle(
        cell(block.title) || fallbackTitle || (means ? 'Descriptives' : 'Table')
      ),
      columns: means
        ? ['Variable', 'Mean', 'SD', 'Median', 'Min', 'Max', 'n']
        : // Frequency summary quotes valid percent of who answered, not % of all.
          ['Answer', 'Frequency', 'Valid %'],
      rows: body,
    });
  }
  return built;
}

function themeShareTable(rows: unknown): RunTable | null {
  if (!Array.isArray(rows) || !rows.length) return null;
  const weighted = rows.some(
    row =>
      row &&
      typeof row === 'object' &&
      (row as { weighted_percent?: unknown }).weighted_percent != null &&
      String((row as { weighted_percent?: unknown }).weighted_percent).trim() !== ''
  );
  const fields = weighted
    ? [
        { header: 'Theme', keys: ['label', 'code'] },
        { header: 'Unweighted count', keys: ['n', 'count'] },
        { header: 'Weighted %', keys: ['weighted_percent'] },
      ]
    : [
        { header: 'Theme', keys: ['label', 'code'] },
        { header: 'Count', keys: ['n', 'count'] },
        { header: '% of people who answered', keys: ['percent'] },
      ];
  fields.push({ header: 'Quote', keys: ['quote', 'example', 'quote_span'] });
  return shareTable(rows, 'Themes', fields);
}

function shareTable(
  rows: unknown,
  title: string,
  fields: { header: string; keys: string[] }[]
): RunTable | null {
  if (!Array.isArray(rows) || !rows.length) return null;
  const body: string[][] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const record = row as Record<string, unknown>;
    const cells = fields.map(field => {
      for (const key of field.keys) {
        const value = record[key];
        if (value != null && String(value).trim()) {
          return isPHeader(field.header) ? shownP(value) : cell(value);
        }
      }
      return '';
    });
    if (cells[0]) body.push(cells);
  }
  if (!body.length) return null;
  return { title, columns: fields.map(field => field.header), rows: body };
}

function marginTable(margins: unknown): RunTable | null {
  if (!Array.isArray(margins) || !margins.length) return null;
  const rows = margins
    .filter(row => row && typeof row === 'object')
    .map(row => {
      const record = row as Record<string, unknown>;
      const category = cell(record.label || record.level);
      if (!category) return null;
      return [
        cell(record.column),
        category,
        cell(record.target_percent ?? record.target),
        cell(record.achieved_percent ?? record.achieved),
      ];
    })
    .filter((row): row is string[] => Boolean(row));
  if (!rows.length) return null;
  return {
    title: 'Weighting',
    columns: ['Variable', 'Category', 'Target %', 'Achieved %'],
    rows,
  };
}

function recordTable(rows: unknown, title: string, keys: string[]): RunTable | null {
  if (!rows) return null;
  const list = Array.isArray(rows)
    ? rows
    : typeof rows === 'object'
      ? Object.entries(rows as Record<string, unknown>).map(([name, value]) =>
          value && typeof value === 'object'
            ? { term: name, ...(value as Record<string, unknown>) }
            : { term: name, estimate: value }
        )
      : [];
  return shareTable(
    list,
    title,
    keys.map(key => ({
      header:
        key === 'projected_thousands' || key === 'projected'
          ? 'Projected (000s)'
          : key.replaceAll('_', ' '),
      keys: [key, key === 'term' ? 'name' : key],
    }))
  );
}

function statRow(record: Record<string, unknown>, title: string, keys: string[]): RunTable | null {
  const present = keys.filter(key => record[key] != null && typeof record[key] !== 'object');
  if (present.length < 2) return null;
  return {
    title,
    columns: present.map(key => key.replaceAll('_', ' ')),
    rows: [present.map(key => (isPHeader(key) ? shownP(record[key]) : cell(record[key])))],
  };
}

function describeTable(describe: unknown, labels?: unknown): RunTable | null {
  if (!describe || typeof describe !== 'object' || Array.isArray(describe)) return null;
  const block = describe as Record<string, unknown>;
  const mean = block.mean;
  if (!mean || typeof mean !== 'object' || Array.isArray(mean)) return null;
  const names = Object.keys(mean as Record<string, unknown>);
  if (!names.length) return null;
  const named =
    labels && typeof labels === 'object' && !Array.isArray(labels)
      ? (labels as Record<string, unknown>)
      : {};
  const stat = (name: string, column: string) => {
    const row = block[name];
    if (!row || typeof row !== 'object' || Array.isArray(row)) return '';
    return cell((row as Record<string, unknown>)[column]);
  };
  return {
    title: 'Descriptives',
    columns: ['Variable', 'Mean', 'SD', 'Median', 'Min', 'Max', 'n'],
    rows: names.map(name => [
      cell(named[name]) || name,
      stat('mean', name),
      stat('std', name),
      stat('50%', name),
      stat('min', name),
      stat('max', name),
      stat('count', name),
    ]),
  };
}

function isNpsBreakdown(table: RunTable): boolean {
  const headers = table.columns.map(column => column.trim().toLowerCase());
  return (
    headers.includes('nps') &&
    headers.some(column => column === 'group' || column.startsWith('group '))
  );
}

function isStageFunnel(table: RunTable): boolean {
  const headers = table.columns.map(column => column.trim().toLowerCase());
  return (
    !headers.includes('group') &&
    headers.includes('stage') &&
    headers.some(column => column.includes('conversion'))
  );
}

function groupFunnelFrom(value: unknown, depth = 0): RunTable | null {
  if (!value || typeof value !== 'object' || depth > 6) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = groupFunnelFrom(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  const record = value as Record<string, unknown>;
  const grouped = record.by_group;
  if (Array.isArray(grouped) && grouped.length) {
    const rows: string[][] = [];
    for (const item of grouped) {
      if (!item || typeof item !== 'object') continue;
      const group = cell((item as { group?: unknown }).group);
      const stages = (item as { stages?: unknown }).stages;
      if (!group || !Array.isArray(stages)) continue;
      for (const stage of stages) {
        if (!stage || typeof stage !== 'object') continue;
        const row = stage as Record<string, unknown>;
        rows.push([
          cell(row.label ?? row.stage),
          group,
          cell(row.count),
          oneDecimal(row.percent_of_base),
          oneDecimal(row.conversion_from_previous),
        ]);
      }
    }
    if (rows.some(row => row.some(Boolean))) {
      return {
        title: 'Funnel by group',
        columns: ['Stage', 'Group', 'Count', '% of base', 'Conversion from previous'],
        rows,
      };
    }
  }
  for (const nested of Object.values(record)) {
    if (nested && typeof nested === 'object') {
      const found = groupFunnelFrom(nested, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function isGroupFunnel(table: RunTable): boolean {
  const headers = table.columns.map(column => column.trim().toLowerCase());
  return headers.includes('stage') && headers.includes('group');
}

function stageShare(table: RunTable, stage: string): number | null {
  const headers = table.columns.map(column => column.trim().toLowerCase());
  const stageColumn = headers.indexOf('stage');
  const shareColumn = headers.findIndex(column => column.includes('% of base'));
  if (stageColumn < 0 || shareColumn < 0) return null;
  const wanted = stage.trim().toLowerCase();
  const values = table.rows
    .filter(row => (row[stageColumn] || '').trim().toLowerCase() === wanted)
    .map(row => Number(row[shareColumn]))
    .filter(value => Number.isFinite(value));
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** The stage funnel and the by-group table that matches it. Frequency tables stay off this card. */
function onlyTheFunnel(tables: RunTable[]): RunTable[] {
  const stage = tables.find(isStageFunnel);
  if (!stage) return tables;
  const groups = tables.filter(isGroupFunnel);
  if (!groups.length) return [stage];
  const names = stage.rows.map(row => (row[0] || '').trim()).filter(Boolean);
  const distance = (table: RunTable) => {
    const gaps = names
      .map(name => {
        const overall = stageShare(stage, name);
        const grouped = stageShare(table, name);
        if (overall == null || grouped == null) return null;
        return Math.abs(overall - grouped);
      })
      .filter((gap): gap is number => gap != null);
    if (!gaps.length) return Number.POSITIVE_INFINITY;
    return gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
  };
  const kept = groups.reduce((best, table) => (distance(table) < distance(best) ? table : best));
  const gap = distance(kept);
  if (Number.isFinite(gap) && gap > 5) return [stage];
  return [stage, kept];
}

/** A second copy of the same rows, usually the grid beside its markdown twin. */
function withoutRepeatedTables(tables: RunTable[]): RunTable[] {
  const stubs = (table: RunTable) => table.rows.map(row => (row[0] || '').trim()).join('\n');
  return tables.filter((table, index) => {
    const labels = stubs(table);
    if (!labels) return true;
    return !tables.some((other, otherIndex) => {
      if (otherIndex === index || stubs(other) !== labels) return false;
      if (other.columns.length < table.columns.length) return false;
      if (other.columns.length === table.columns.length && otherIndex > index) return false;
      return table.rows.every((row, rowIndex) =>
        row.slice(1).every(value => !value || (other.rows[rowIndex] || []).includes(value))
      );
    });
  });
}

/** Whole-base stage shares with conversions, then the highest and lowest group with figures. */
export function funnelHeadline(tables: RunTable[]): string {
  const stage = tables.find(isStageFunnel);
  if (!stage) return '';
  const headers = stage.columns.map(column => column.toLowerCase());
  const shareColumn = headers.findIndex(column => column.includes('% of base'));
  const conversionColumn = headers.findIndex(column => column.includes('conversion'));
  if (shareColumn < 0) return '';
  const parts = stage.rows
    .map((row, index) => {
      const name = (row[0] || '').trim();
      const share = (row[shareColumn] || '').trim();
      if (!name || !share) return '';
      let piece = `${name} ${share.includes('%') ? share : `${share}%`}`;
      if (index > 0 && conversionColumn >= 0) {
        const conversion = (row[conversionColumn] || '').trim().replace(/%/g, '');
        if (conversion) {
          piece = `${piece} (${conversion}% from the previous stage)`;
        }
      }
      return piece;
    })
    .filter(Boolean)
    .slice(0, 6);
  if (!parts.length) return '';
  let text = parts.join(', ');
  if (!text.endsWith('.')) text = `${text}.`;
  const group = tables.find(isGroupFunnel);
  if (!group) return text;
  const groupHeaders = group.columns.map(column => column.toLowerCase());
  const stageColumn = groupHeaders.indexOf('stage');
  const groupColumn = groupHeaders.findIndex(
    column => column === 'group' || column.startsWith('group')
  );
  const groupedShare = groupHeaders.findIndex(column => column.includes('% of base'));
  const last = (stage.rows[stage.rows.length - 1]?.[0] || '').trim().toLowerCase();
  const scored = group.rows
    .filter(row => (row[stageColumn] || '').trim().toLowerCase() === last)
    .map(row => ({
      name: (row[groupColumn] || '').trim(),
      share: Number(String(row[groupedShare] || '').replace('%', '')),
    }))
    .filter(item => item.name && Number.isFinite(item.share));
  if (scored.length < 2) return text;
  const high = scored.reduce((best, item) => (item.share > best.share ? item : best));
  const low = scored.reduce((best, item) => (item.share < best.share ? item : best));
  if (high.name === low.name) return text;
  const highShare = oneDecimal(high.share);
  const lowShare = oneDecimal(low.share);
  return `${text} ${high.name} is highest at ${highShare}%; ${low.name} is lowest at ${lowShare}%.`;
}

/** One stage funnel. A shorter table of the same stages is the earlier question-label copy. */
function oneFunnel(tables: RunTable[]): RunTable[] {
  const funnels = tables.filter(isStageFunnel);
  if (funnels.length < 2) return tables;
  const kept = funnels.reduce((best, table) =>
    table.rows.length >= best.rows.length ? table : best
  );
  return tables.filter(table => !isStageFunnel(table) || table === kept);
}

/** One NPS-by-group table. A second breakdown of the same groups is the same table. */
function oneNpsBreakdown(tables: RunTable[]): RunTable[] {
  const breakdowns = tables.filter(isNpsBreakdown);
  if (breakdowns.length < 2) return tables;
  const kept =
    breakdowns.find(table => table.title.trim().toLowerCase() !== 'nps') || breakdowns[0];
  return tables.filter(table => !isNpsBreakdown(table) || table === kept);
}

function npsTable(groups: unknown): RunTable | null {
  if (!Array.isArray(groups) || !groups.length) return null;
  const rows = groups
    .filter(row => row && typeof row === 'object' && (row as { nps?: unknown }).nps != null)
    .map(row => {
      const record = row as Record<string, unknown>;
      const promoters = Number(record.promoters);
      const passives = Number(record.passives);
      const detractors = Number(record.detractors);
      const total = promoters + passives + detractors;
      const share = (part: number) =>
        total > 0 && Number.isFinite(part)
          ? (Math.round((1000 * part) / total) / 10).toFixed(1)
          : '';
      const name = cell(record.label || record.group);
      const score = Number(record.nps);
      return [
        name && name !== 'all' ? name : 'Total',
        Number.isFinite(score) ? score.toFixed(1) : cell(record.nps),
        share(promoters),
        share(passives),
        share(detractors),
        cell(record.n),
      ];
    });
  if (!rows.length) return null;
  return {
    title: 'NPS',
    columns: ['Group', 'NPS', '% promoters', '% passives', '% detractors', 'n'],
    rows,
  };
}

function groupTable(groups: unknown): RunTable | null {
  if (!Array.isArray(groups) || !groups.length) return null;
  const records = groups.filter(row => row && typeof row === 'object') as Record<string, unknown>[];
  // Rank and normality results store medians, not means. Groups comes from the builder.
  if (!records.some(record => record.mean != null && Number.isFinite(Number(record.mean)))) {
    return null;
  }
  const weighted = records.some(record => record.weighted_n != null);
  const rows = records
    .map(record => {
      const label = cell(record.label || record.group);
      if (!label) return null;
      const mean = cell(record.mean);
      const sd = cell(record.std ?? record.sd);
      if (weighted) {
        return [label, cell(record.unweighted_n ?? record.n), cell(record.weighted_n), mean, sd];
      }
      return [label, cell(record.n), mean, sd];
    })
    .filter((row): row is string[] => Boolean(row));
  if (!rows.length) return null;
  return {
    title: 'Group means',
    columns: weighted
      ? ['Group', 'Unweighted n', 'Weighted n', 'Mean', 'SD']
      : ['Group', 'n', 'Mean', 'SD'],
    rows,
  };
}

function groupLabels(groups: unknown): Map<string, string> {
  const labels = new Map<string, string>();
  if (!Array.isArray(groups)) return labels;
  for (const row of groups) {
    if (!row || typeof row !== 'object') continue;
    const record = row as Record<string, unknown>;
    const code = cell(record.group);
    const label = cell(record.label);
    if (code && label && label !== code) {
      labels.set(code, label);
      const stripped = code.replace(/\.0$/, '');
      if (stripped && stripped !== code) labels.set(stripped, label);
    }
  }
  return labels;
}

/** Groups/Pairwise/Post hoc cells that still hold codes get the stamped value labels. */
function relabelRankTables(tables: RunTable[], labels: Map<string, string>): RunTable[] {
  if (!labels.size) return tables;
  const shown = (raw: string) =>
    labels.get(raw) || labels.get(raw.replace(/\.0$/, '')) || labels.get(`${raw}.0`) || raw;
  return tables.map(table => {
    const title = table.title.trim().toLowerCase();
    if (title === 'groups') {
      return {
        ...table,
        rows: table.rows.map(row => (row.length ? [shown(row[0] || ''), ...row.slice(1)] : row)),
      };
    }
    // Pairwise, Post hoc (tukey), Pairwise comparisons (tukey_hsd), Multiple Comparisons.
    if (
      title === 'pairwise' ||
      title.startsWith('post hoc') ||
      title.startsWith('pairwise comparisons') ||
      title === 'multiple comparisons'
    ) {
      return {
        ...table,
        rows: table.rows.map(row => {
          if (row.length < 2) return row;
          return [shown(row[0] || ''), shown(row[1] || ''), ...row.slice(2)];
        }),
      };
    }
    return table;
  });
}

function collectGroupLabels(
  value: unknown,
  depth = 0,
  into = new Map<string, string>()
): Map<string, string> {
  if (!value || typeof value !== 'object' || depth > 6) return into;
  if (Array.isArray(value)) {
    for (const item of value) collectGroupLabels(item, depth + 1, into);
    return into;
  }
  const record = value as Record<string, unknown>;
  for (const [code, label] of groupLabels(record.group_descriptives)) {
    into.set(code, label);
  }
  const prepared = record.group_labels;
  const names = record.group_names;
  if (Array.isArray(prepared) && Array.isArray(names)) {
    for (let index = 0; index < names.length; index += 1) {
      const code = cell(names[index]);
      const label = cell(prepared[index]);
      if (code && label && label !== code) {
        into.set(code, label);
        const stripped = code.replace(/\.0$/, '');
        if (stripped && stripped !== code) into.set(stripped, label);
      }
    }
  }
  for (const [key, nested] of Object.entries(record)) {
    if (key === 'rows' || key === 'columns' || key === 'preview') continue;
    if (nested && typeof nested === 'object') collectGroupLabels(nested, depth + 1, into);
  }
  return into;
}

function anovaSourceTable(record: Record<string, unknown>): RunTable | null {
  const table = record.anova_table;
  if (!table || typeof table !== 'object' || Array.isArray(table)) return null;
  const source = table as Record<string, unknown>;
  const between = [
    'Between groups',
    cell(source.ss_between ?? source.ss),
    cell(source.df_between ?? source.df),
    cell(source.ms_between ?? source.ms),
    cell(record.f_statistic ?? source.F ?? source.f),
    shownP(record.p_value ?? source.p_value ?? source.p),
    cell(record.eta_squared ?? record.effect_size ?? source.eta_squared),
  ];
  if (!between.slice(1).some(Boolean)) return null;
  const rows = [between];
  if (source.ss_within != null || source.df_within != null) {
    rows.push([
      'Within groups',
      cell(source.ss_within),
      cell(source.df_within),
      cell(source.ms_within),
      '',
      '',
      '',
    ]);
  }
  return {
    title: 'ANOVA',
    columns: ['Source', 'SS', 'df', 'MS', 'F', 'p', 'Effect size'],
    rows,
  };
}

function shownGroupCode(raw: string, labels: Map<string, string>): string {
  if (!raw) return raw;
  return labels.get(raw) || labels.get(raw.replace(/\.0$/, '')) || labels.get(`${raw}.0`) || raw;
}

function postHocTable(value: unknown, labels: Map<string, string> = new Map()): RunTable | null {
  const block =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as { pairwise?: unknown; method?: unknown })
      : null;
  const pairs = Array.isArray(block?.pairwise) ? block.pairwise : Array.isArray(value) ? value : [];
  const rows = pairs
    .filter(row => row && typeof row === 'object')
    .map(row => {
      const record = row as Record<string, unknown>;
      const left = shownGroupCode(cell(record.group1 ?? record.group_a ?? record.a), labels);
      const right = shownGroupCode(cell(record.group2 ?? record.group_b ?? record.b), labels);
      if (!left || !right) return null;
      return [
        left,
        right,
        cell(record.meandiff ?? record.mean_diff ?? record.diff),
        shownP(record['p-adj'] ?? record.p_adj ?? record.p_value),
      ];
    })
    .filter((row): row is string[] => Boolean(row));
  if (!rows.length) return null;
  const method = cell(block?.method);
  return {
    title: method ? `Post hoc (${method})` : 'Post hoc',
    columns: ['Group', 'Compared with', 'Difference', 'p'],
    rows,
  };
}

function isFrequencyRecord(record: Record<string, unknown>): boolean {
  if (
    record.analysis_type === 'frequencies' ||
    record.op === 'frequencies' ||
    record.procedure === 'frequencies'
  ) {
    return true;
  }
  const lists = [record.frequency_tables, record.tables];
  return lists.some(
    list =>
      Array.isArray(list) &&
      list.some(item => {
        if (!item || typeof item !== 'object') return false;
        const block = item as { title?: unknown; columns?: unknown };
        if (/frequency table/i.test(cell(block.title))) return true;
        return (
          Array.isArray(block.columns) &&
          block.columns.some(column => cell(column).toLowerCase() === 'frequency')
        );
      })
  );
}

function filterColumns(value: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) filterColumns(item, found);
    return found;
  }
  if (!value || typeof value !== 'object') return found;
  const record = value as Record<string, unknown>;
  const column = cell(record.column ?? record.columnId);
  if (column && ('value' in record || 'op' in record || 'operator' in record)) found.add(column);
  for (const nested of Object.values(record)) filterColumns(nested, found);
  return found;
}

/** Named audience used as a filter, audience_filter, or Total|Audience banner column. */
function audienceWasUsed(record: Record<string, unknown>): boolean {
  if (record.audience_filter && typeof record.audience_filter === 'object') return true;
  const banner = record.banner;
  if (Array.isArray(banner)) {
    const asColumn = banner.some(item => {
      if (!item || typeof item !== 'object') return false;
      const row = item as Record<string, unknown>;
      return Boolean(row.audience || row.filter);
    });
    if (asColumn) return true;
  }
  const columns = record.audience_columns;
  if (!Array.isArray(columns) || !columns.length) return true;
  const used = filterColumns(
    record.row_filters || record.filters || record.filter || record.audience_filter
  );
  return columns.every(column => used.has(cell(column)));
}

function filterText(named: unknown): string {
  if (typeof named === 'string') return named.trim();
  if (named && typeof named === 'object' && !Array.isArray(named)) {
    return filterText((named as { filters?: unknown }).filters);
  }
  if (!Array.isArray(named)) return '';
  const parts = named
    .filter(item => item && typeof item === 'object')
    .map(item => {
      const row = item as { column?: unknown; columnId?: unknown; value?: unknown; op?: unknown };
      const column = cell(row.column ?? row.columnId);
      const compared = cell(row.value);
      if (!column || !compared) return '';
      return `${column} ${cell(row.op) || '='} ${compared}`;
    })
    .filter(Boolean);
  return parts.join(', ');
}

type SampleBits = {
  weight: string;
  n: number;
  total: number;
  missing: number;
  ess: number;
  sawN: boolean;
  sawTotal: boolean;
  sawMissing: boolean;
  sawEss: boolean;
  small: string[];
  note: string;
  tableUnweighted: number;
  tableWeighted: number | null;
  sawTableBase: boolean;
  sawTotalColumn: boolean;
  tableEss: boolean;
};

function wholeNumber(value: unknown): number | null {
  // null/undefined/'' must stay absent. Number(null) is 0 and would mark an
  // unweighted frequency base as "0 weighted".
  if (value == null || value === '') return null;
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.round(number);
}

function columnBase(
  record: Record<string, unknown>
): { unweighted_n?: unknown; weighted_n?: unknown } | null {
  const bases = record.bases;
  if (!bases || typeof bases !== 'object' || Array.isArray(bases)) return null;
  const column = (bases as { column?: unknown }).column;
  if (!column || typeof column !== 'object' || Array.isArray(column)) return null;
  return column as { unweighted_n?: unknown; weighted_n?: unknown };
}

function bannerRecord(record: Record<string, unknown>): boolean {
  return (
    typeof record.answered_n === 'number' ||
    record.cells != null ||
    record.banner_columns != null ||
    record.base_label != null
  );
}

/** Turn a banner book into the same column grid the chat summary.screen carries. */
function bannerBookTable(record: Record<string, unknown>): RunTable | null {
  const columns = Array.isArray(record.banner_columns)
    ? record.banner_columns.filter(
        (column): column is Record<string, unknown> =>
          Boolean(column) && typeof column === 'object' && !Array.isArray(column)
      )
    : [];
  // Keep stub-group header rows so multi-stub books stay labelled on the output page.
  const rows = Array.isArray(record.rows)
    ? record.rows.filter((row): row is Record<string, unknown> => {
        if (!row || typeof row !== 'object' || Array.isArray(row)) return false;
        const kind = String((row as { kind?: unknown }).kind || 'value');
        return !['mean', 'sd', 'base'].includes(kind);
      })
    : [];
  const valueRows = rows.filter(row => String(row.kind || 'value') !== 'header');
  if (!columns.length || !valueRows.length) return null;
  let hasProjected = false;
  let hasIndex = false;
  for (const row of valueRows) {
    for (const item of Array.isArray(row.cells) ? row.cells : []) {
      if (!item || typeof item !== 'object') continue;
      const cell = item as Record<string, unknown>;
      if (typeof cell.projected_thousands === 'number') hasProjected = true;
      if (typeof cell.index === 'number') hasIndex = true;
    }
  }
  const headers = ['Item'];
  for (const column of columns) {
    const heading = cell(column.label) || 'Total';
    headers.push(columns.length === 1 && heading.toLowerCase() === 'total' ? '%' : `${heading} %`);
    if (hasProjected) {
      headers.push(columns.length === 1 ? 'People (000s)' : `${heading} (000s)`);
    }
    if (hasIndex) {
      headers.push(columns.length === 1 ? 'Index vs total' : `${heading} index`);
    }
  }
  const blank = Array.from({ length: headers.length - 1 }, () => '');
  const matrix: string[][] = [];
  for (const row of rows.slice(0, 40)) {
    const kind = String(row.kind || 'value');
    let label = cell(row.label);
    if (kind === 'header') {
      matrix.push([label, ...blank]);
      continue;
    }
    if (label.includes(': ')) label = label.split(': ').slice(-1)[0].trim() || label;
    const cells = Array.isArray(row.cells)
      ? row.cells.filter(
          (item): item is Record<string, unknown> =>
            Boolean(item) && typeof item === 'object' && !Array.isArray(item)
        )
      : [];
    const byId = new Map(cells.map(item => [cell(item.banner_id), item]));
    const line = [label];
    columns.forEach((column, index) => {
      const item = byId.get(cell(column.id)) || cells[index] || {};
      const percent =
        typeof item.percent === 'number' && Number.isFinite(item.percent)
          ? `${item.percent.toFixed(1)}%`
          : '—';
      line.push(percent);
      if (hasProjected) {
        const projected = item.projected_thousands;
        line.push(
          typeof projected === 'number' && Number.isFinite(projected)
            ? projected.toLocaleString('en-GB', {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })
            : '—'
        );
      }
      if (hasIndex) {
        const indexValue = item.index;
        line.push(
          typeof indexValue === 'number' && Number.isFinite(indexValue)
            ? String(Math.round(indexValue))
            : '—'
        );
      }
    });
    matrix.push(line);
  }
  if (!matrix.length) return null;
  return {
    title: cell(record.title) || 'Banner',
    columns: headers,
    rows: matrix,
  };
}

function rememberTableBase(record: Record<string, unknown>, sample: SampleBits): void {
  const weight = record.weight;
  if (
    !sample.sawTotalColumn &&
    bannerRecord(record) &&
    weight &&
    typeof weight === 'object' &&
    !Array.isArray(weight)
  ) {
    const block = weight as { unweighted_n?: unknown; weighted_n?: unknown; kish_ess?: unknown };
    const unweighted = wholeNumber(block.unweighted_n);
    const weighted = wholeNumber(block.weighted_n);
    if (unweighted != null) {
      sample.tableUnweighted = unweighted;
      sample.tableWeighted = weighted;
      sample.sawTableBase = true;
      sample.sawTotalColumn = true;
      const ess = Number(block.kish_ess);
      if (Number.isFinite(ess)) {
        sample.ess = ess;
        sample.sawEss = true;
        sample.tableEss = true;
      }
    }
  }
  const answered = typeof record.answered_n === 'number' ? wholeNumber(record.answered_n) : null;
  if (answered != null && !sample.sawTotalColumn) {
    sample.tableUnweighted = answered;
    sample.tableWeighted = null;
    sample.sawTableBase = true;
  }
  const listed = record.bases;
  if (!sample.sawTotalColumn && Array.isArray(listed) && listed.length) {
    const total = listed.find(row => {
      if (!row || typeof row !== 'object') return false;
      const named = row as { label?: unknown; column?: unknown };
      return cell(named.label || named.column).toLowerCase() === 'total';
    });
    const row = total || (listed.length === 1 ? listed[0] : null);
    if (row && typeof row === 'object') {
      const unweighted = wholeNumber((row as { unweighted?: unknown }).unweighted);
      const weighted = wholeNumber((row as { weighted?: unknown }).weighted);
      if (unweighted != null) {
        sample.tableUnweighted = unweighted;
        sample.tableWeighted = weighted;
        sample.sawTableBase = true;
      }
    }
  }
  const column = columnBase(record);
  if (!column || sample.sawTotalColumn) return;
  const banner = cell(record.banner_id || record.id).toLowerCase();
  const label = cell(record.label).toLowerCase();
  if (banner !== 'total' && label !== 'total') return;
  const unweighted = wholeNumber(column.unweighted_n);
  const weighted = wholeNumber(column.weighted_n);
  if (unweighted == null) return;
  sample.tableUnweighted = unweighted;
  sample.tableWeighted = weighted;
  sample.sawTableBase = true;
  sample.sawTotalColumn = true;
}

function takeSample(record: Record<string, unknown>, sample: SampleBits): void {
  const weight = record.weight;
  const looks =
    (weight && typeof weight === 'object' && !Array.isArray(weight)) ||
    record.n_observations != null ||
    record.n_total != null ||
    record.n_missing != null ||
    record.n_excluded_missing != null ||
    record.model_fit != null ||
    record.base_note != null ||
    record.kish_ess != null ||
    Array.isArray(record.groups) ||
    Array.isArray(record.stages) ||
    Array.isArray(record.bases) ||
    record.answered_n != null ||
    (record.bases != null && typeof record.bases === 'object');
  if (!looks && !Array.isArray(record.notes)) return;
  if (weight && typeof weight === 'object' && !Array.isArray(weight) && !sample.weight) {
    const block = weight as {
      label?: unknown;
      column?: unknown;
      kish_ess?: unknown;
      unweighted_n?: unknown;
    };
    const column = realWeightToken(block.column);
    const label = stripCodeBrackets(cell(block.label), column);
    if (label && label.toLowerCase() !== column.toLowerCase() && label.toLowerCase() !== 'weight') {
      sample.weight = label;
    } else if (column) sample.weight = column;
    if (!sample.sawEss) {
      const ess = Number(block.kish_ess);
      if (Number.isFinite(ess)) {
        sample.ess = ess;
        sample.sawEss = true;
      }
    }
    if (!sample.sawN) {
      const count = wholeNumber(block.unweighted_n);
      if (count != null) {
        sample.n = count;
        sample.sawN = true;
      }
    }
  }
  if (!sample.weight) {
    const named = weightName(record);
    if (named) sample.weight = named;
  }
  if (!sample.sawN && Array.isArray(record.stages) && record.stages.length) {
    const first = record.stages[0];
    const stageBase =
      first && typeof first === 'object' ? (first as { base?: unknown }).base : undefined;
    const count = wholeNumber(record.n ?? record.base ?? stageBase);
    if (count != null) {
      sample.n = count;
      sample.sawN = true;
    }
  }
  if (!sample.sawN) {
    const count = wholeNumber(record.n ?? record.n_observations ?? record.n_used);
    const fitted =
      record.model_fit && typeof record.model_fit === 'object'
        ? wholeNumber((record.model_fit as { n?: unknown }).n)
        : null;
    const chosen = count ?? fitted;
    if (chosen != null) {
      sample.n = chosen;
      sample.sawN = true;
    }
  }
  if (!sample.sawTotal) {
    const total = wholeNumber(record.n_total ?? record.n_rows);
    if (total != null) {
      sample.total = total;
      sample.sawTotal = true;
    }
  }
  if (!sample.sawMissing) {
    const missing = wholeNumber(record.n_missing ?? record.n_excluded_missing);
    if (missing != null) {
      sample.missing = missing;
      sample.sawMissing = true;
    }
  }
  rememberTableBase(record, sample);
  const note = cell(record.base_note);
  if (note && /base =|sample size/i.test(note) && !sample.note) sample.note = note;
  if (Array.isArray(record.notes)) {
    for (const item of record.notes) {
      const text = cell(item);
      if (text && /base =|sample size/i.test(text) && !sample.note) sample.note = text;
    }
  }
  const groups = record.groups;
  if (!Array.isArray(groups)) return;
  for (const group of groups) {
    if (!group || typeof group !== 'object') continue;
    const row = group as { label?: unknown; group?: unknown; n?: unknown };
    const count = wholeNumber(row.n);
    if (count == null || count >= 30) continue;
    const name = cell(row.label || row.group);
    const shown = name === 'all' ? 'Total' : name;
    if (!shown) continue;
    const line = `${shown} n = ${count}`;
    if (!sample.small.includes(line)) sample.small.push(line);
  }
}

function sampleWeightPhrase(sample: SampleBits): string {
  const named = (sample.weight || '').trim();
  if (named && !/^(none|unweighted|null)$/i.test(named)) {
    if (named.toLowerCase() === 'weighted') return 'Weight: Weighted';
    // A snake_case column code is not a label a person should read.
    if (/[a-z]_[a-z0-9]/i.test(named)) return 'Weight: Weighted';
    return `Weight: ${named}`;
  }
  const weighted = sample.tableWeighted;
  if (sample.sawTableBase && weighted != null && weighted !== sample.tableUnweighted) {
    return 'Weight: Weighted';
  }
  return 'Weight: Unweighted';
}

function sampleLine(sample: SampleBits): string {
  const weight = sampleWeightPhrase(sample);
  const parts = [weight];
  if (sample.sawTableBase) {
    const weighted = sample.tableWeighted;
    parts.push(
      weighted != null && weighted !== sample.tableUnweighted
        ? `base = ${sample.tableUnweighted} (${weighted} weighted)`
        : `base = ${sample.tableUnweighted}`
    );
  } else if (sample.sawN && sample.sawTotal && sample.sawMissing) {
    parts.push(`base = ${sample.n} (of ${sample.total}, ${sample.missing} missing)`);
  } else if (sample.sawN && sample.sawMissing && !sample.sawTotal) {
    parts.push(`base = ${sample.n} (of ${sample.n + sample.missing}, ${sample.missing} missing)`);
  } else if (sample.sawN) parts.push(`base = ${sample.n}`);
  else if (sample.sawTotal) parts.push(`base = ${sample.total}`);
  const denom = sample.sawTableBase
    ? sample.tableUnweighted
    : sample.sawN
      ? sample.n
      : sample.total;
  // Kish ESS only when the engine sent one. Do not invent "100%" for unweighted runs.
  if ((sample.tableEss || !sample.sawTableBase) && sample.sawEss && denom) {
    const percent = Math.round((100 * sample.ess) / denom);
    const shown =
      Math.abs(sample.ess - Math.round(sample.ess)) < 0.05
        ? String(Math.round(sample.ess))
        : sample.ess.toFixed(1);
    parts.push(`effective base = ${shown} (${percent}%)`);
  }
  parts.push('95% confidence level');
  const line = `${parts.join('; ')}.`;
  return sample.small.length
    ? `${line} ${sample.small.join('; ')}: treat this base with caution.`
    : line;
}

function realWeightToken(value: unknown): string {
  const text = cell(value).trim();
  if (!text || /^(none|unweighted|null)$/i.test(text)) return '';
  return text;
}

/** Drop a trailing "[column_name]" from a weight label a person reads. */
function stripCodeBrackets(label: string, code = ''): string {
  const text = label.trim();
  const match = /^(.*)\s*[\[(]\s*([A-Za-z_][\w.]*)\s*[\])]?\s*$/.exec(text);
  if (!match) return text;
  const left = match[1].trim();
  const right = match[2].trim();
  if (!left) return text;
  if (code && right.toLowerCase() === code.toLowerCase()) return left;
  if (right.includes('_') || right.toLowerCase() === 'label') return left;
  return text;
}

function weightName(record: Record<string, unknown>): string {
  if (record.weight && typeof record.weight === 'object' && !Array.isArray(record.weight)) {
    const weight = record.weight as { column?: unknown; label?: unknown };
    const column = realWeightToken(weight.column);
    const label = stripCodeBrackets(cell(weight.label).trim(), column);
    if (label && label.toLowerCase() !== 'weight' && label.toLowerCase() !== column.toLowerCase()) {
      return label;
    }
    if (column) {
      const meta = record.column_metadata;
      if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
        const entry = (meta as Record<string, unknown>)[column];
        if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
          const named = stripCodeBrackets(
            cell((entry as { label?: unknown }).label).trim(),
            column
          );
          if (
            named &&
            named.toLowerCase() !== 'weight' &&
            named.toLowerCase() !== column.toLowerCase()
          ) {
            return named;
          }
        }
      }
      return column;
    }
  }
  if (typeof record.resolved_weight === 'string') {
    const resolved = record.resolved_weight.trim();
    // An explicit none is this run's choice. Do not fall through to the project ledger.
    if (/^(none|unweighted|null)$/i.test(resolved)) return 'Unweighted';
    if (resolved) return resolved;
  }
  const named =
    typeof record.weight_label === 'string' && record.weight_label.trim()
      ? record.weight_label
      : typeof record.weight === 'string'
        ? record.weight
        : typeof record.weight_column === 'string'
          ? record.weight_column
          : typeof record.active_weight_column === 'string'
            ? record.active_weight_column
            : '';
  return realWeightToken(named);
}

function isGroupMeanTable(table: RunTable): boolean {
  const headers = table.columns.map(column => column.toLowerCase());
  return (
    headers.some(column => column === 'mean') &&
    headers.some(column => column === 'group' || column.startsWith('group ')) &&
    headers.some(column => column === 'n' || column.endsWith(' n'))
  );
}

function groupMeanScore(table: RunTable): number {
  if (!isGroupMeanTable(table)) return 0;
  const blob = table.columns.join(' ').toLowerCase();
  let score = blob.includes('weighted') ? 3 : 1;
  const title = table.title.trim().toLowerCase();
  if (title && title !== 'group means' && title !== 'group summaries') score += 1;
  return score;
}

/** Column-and-row tables the summary already built. Those are the tables to show. */
function summaryGrids(value: unknown, depth = 0): RunTable[] {
  if (!value || typeof value !== 'object' || depth > 6) return [];
  if (Array.isArray(value)) return value.flatMap(item => summaryGrids(item, depth + 1));
  const record = value as Record<string, unknown>;
  const found: RunTable[] = [];
  const summary = record.summary;
  if (summary && typeof summary === 'object') {
    const block = summary as { table?: unknown; screen?: unknown; title?: unknown };
    // Banner runs put the readable grid on screen; table may be markdown only.
    const screen = asTable(block.screen);
    if (screen) found.push(screen);
    found.push(...summaryTables(block.table, cell(block.title)));
    if (Array.isArray(block.table)) {
      for (const item of block.table) {
        const grid = asTable(item);
        if (grid) found.push(grid);
      }
    }
  }
  for (const [key, nested] of Object.entries(record)) {
    if (key === 'summary' || key === 'rows' || key === 'columns' || key === 'preview') continue;
    if (nested && typeof nested === 'object') found.push(...summaryGrids(nested, depth + 1));
  }
  return found;
}

/** Tables, the R script, checks, the weight and the filter carried on a finished turn. */
function procedureOfRecord(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const record = value as Record<string, unknown>;
  const args = record.args as Record<string, unknown> | undefined;
  const nested = record.result as Record<string, unknown> | undefined;
  const name =
    record.procedure || record.analysis_type || args?.analysis_type || nested?.analysis_type;
  return typeof name === 'string' ? name : '';
}

/** A funnel or crosstab card does not keep the frequency tables that ran beside it. */
function focusRun(results: unknown): unknown {
  if (!Array.isArray(results)) return results;
  const names = results.map(procedureOfRecord);
  const drop =
    names.includes('brand_duplication') || names.includes('paired_brand_test')
      ? new Set(['frequencies', 'descriptives', 'compute', 'banner_table', 'funnel'])
      : names.includes('funnel')
        ? new Set(['frequencies', 'descriptives', 'compute', 'banner_table'])
        : names.includes('banner_table')
          ? new Set(['frequencies', 'descriptives', 'compute'])
          : null;
  if (!drop) return results;
  return results.filter(item => !drop.has(procedureOfRecord(item)));
}

export function resultViewFromToolResults(results: unknown): ResultView {
  results = focusRun(results);
  let answered = 0;
  const sample: SampleBits = {
    weight: '',
    n: 0,
    total: 0,
    missing: 0,
    ess: 0,
    sawN: false,
    sawTotal: false,
    sawMissing: false,
    sawEss: false,
    small: [],
    note: '',
    tableUnweighted: 0,
    tableWeighted: null,
    sawTableBase: false,
    sawTotalColumn: false,
    tableEss: false,
  };
  const view: ResultView = {
    tables: [],
    charts: [],
    script: '',
    checks: [],
    weight: '',
    filter: '',
    audience: '',
    audienceDefinition: '',
    wave: '',
    source: '',
    rCheck: '',
    rStatement: '',
    base: '',
    letterNote: '',
    weightSource: '',
    duplication: undefined,
  };

  const takeDuplicationPanel = (record: Record<string, unknown>) => {
    if (view.duplication) return;
    const kind = cell(record.kind);
    const procedure = procedureOfRecord(record);
    const panel = record.panel;
    if (
      (kind === 'brand_duplication' || procedure === 'brand_duplication') &&
      panel &&
      typeof panel === 'object'
    ) {
      view.duplication = panel as DuplicationPanelData;
    }
  };
  const seen = new Set<string>();
  let usedSummary = false;
  const preferred = summaryGrids(results);
  let lockTables = false;
  const spareGroupTables: RunTable[] = [];
  const add = (table: RunTable | null, source: 'summary' | 'grid' = 'grid') => {
    if (lockTables) return;
    if (!table || table.title === 'Equivalent R and SPSS syntax') return;
    if (
      usedSummary &&
      source === 'grid' &&
      table.columns.some(column => /frequency|percent/i.test(column))
    ) {
      return;
    }
    if (isGroupMeanTable(table)) {
      const score = groupMeanScore(table);
      const existing = view.tables.findIndex(item => isGroupMeanTable(item));
      if (existing >= 0) {
        if (score > groupMeanScore(view.tables[existing])) view.tables[existing] = table;
        return;
      }
    }
    const title = table.title.trim().toLowerCase();
    if (
      title === 'statistics' &&
      table.columns.some(column => column.trim().toLowerCase() === 'statistic')
    ) {
      return;
    }
    if (
      title === 'nps by group' &&
      view.tables.some(item => item.title.trim().toLowerCase() === title)
    ) {
      return;
    }
    const key = `${table.title}\n${table.columns.join('\t')}\n${table.rows.map(row => row.join('\t')).join('\n')}`;
    if (seen.has(key)) return;
    seen.add(key);
    view.tables.push(table);
    if (source === 'summary') usedSummary = true;
  };
  for (const table of preferred) add(table, 'summary');
  if (preferred.length) lockTables = true;
  const appendFootnoteNote = (text: string) => {
    if (!text) return;
    if (view.baseDetail?.includes(text) || view.letterNote.includes(text)) return;
    view.baseDetail = view.baseDetail ? `${view.baseDetail} · ${text}` : text;
  };
  const isExplanatoryTableNote = (text: string) => {
    const folded = text.toLowerCase();
    return (
      folded.includes('percent of respondents who selected') ||
      folded.includes('people may select more than one') ||
      folded.includes('percents need not sum to 100') ||
      (folded.startsWith('weighted by ') && folded.includes('counts, percents'))
    );
  };
  const notes = (value: unknown) => {
    if (!Array.isArray(value)) return;
    for (const note of value) {
      const text = cell(note);
      if (!text) continue;
      // Frequency multi-select copy belongs on the footnote, not the Checks fold
      // (TEN-249: avoid "Check not run" vs "Checks (n)" for the same card).
      if (isExplanatoryTableNote(text)) {
        appendFootnoteNote(text);
        continue;
      }
      if (!view.checks.includes(text)) view.checks.push(text);
    }
  };
  const visit = (value: unknown, depth: number, inDescriptives = false) => {
    if (!value || typeof value !== 'object' || depth > 5) return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1, inDescriptives);
      return;
    }
    const record = value as Record<string, unknown>;
    takeSample(record, sample);
    const descriptives =
      inDescriptives ||
      record.procedure === 'descriptives' ||
      record.analysis_type === 'descriptives';
    const title = cell(record.title);
    const syntaxDump =
      record.id === 'equivalent_syntax' || title === 'Equivalent R and SPSS syntax';
    if (!syntaxDump) {
      const table = asTable(record) || (bannerRecord(record) ? bannerBookTable(record) : null);
      if (table && (record.id === 'group_statistics' || table.title === 'Group Statistics')) {
        spareGroupTables.push(table);
      } else {
        add(table);
      }
    }
    const summary = record.summary;
    if (summary && typeof summary === 'object') {
      const block = summary as {
        table?: unknown;
        title?: unknown;
        significance?: unknown;
        notes?: unknown;
        letter_test?: unknown;
      };
      if (typeof block.significance === 'string') notes([block.significance]);
      notes(block.notes);
      const letter = cell(block.letter_test);
      if (letter && !view.letterNote) view.letterNote = letter;
      const screen = asTable((block as { screen?: unknown }).screen);
      if (screen) add(screen, 'summary');
      for (const table of summaryTables(block.table, cell(block.title))) add(table, 'summary');
    }
    notes(record.notes);
    if (!view.script && typeof record.r_syntax === 'string' && record.r_syntax.trim()) {
      view.script = record.r_syntax.trim();
    }
    for (const table of summaryTables(record.table, cell(record.title))) add(table, 'summary');
    // Frequencies show the grid only. Means of multi-select 0/1 flags are noise.
    const showDescribe =
      descriptives ||
      (!isFrequencyRecord(record) &&
        record.procedure !== 'frequencies' &&
        record.analysis_type !== 'frequencies');
    const means = showDescribe ? describeTable(record.describe, record.variable_labels) : null;
    if (means && !view.tables.some(table => table.columns.includes('Mean'))) {
      add(means, descriptives ? 'summary' : 'grid');
    }
    if (!descriptives) {
      for (const key of ['frequency_tables', 'tables'] as const) {
        const list = record[key];
        if (Array.isArray(list)) for (const item of list) add(asTable(item));
      }
    }
    add(themeShareTable(record.code_frequency));
    const summaryTable =
      summary && typeof summary === 'object' ? (summary as { table?: unknown }).table : null;
    const summaryHasNps =
      Array.isArray(summaryTable) &&
      summaryTable.some(
        block =>
          block &&
          typeof block === 'object' &&
          cell((block as { title?: unknown }).title)
            .toLowerCase()
            .includes('nps')
      );
    if (!summaryHasNps) add(npsTable(record.groups));
    add(groupTable(record.group_descriptives));
    add(anovaSourceTable(record));
    add(postHocTable(record.post_hoc, groupLabels(record.group_descriptives)));
    const levene = record.levene_test;
    if (levene && typeof levene === 'object') {
      const p = shownP((levene as { p_value?: unknown }).p_value);
      if (p) notes([p.startsWith('<') ? `Levene p ${p}` : `Levene p = ${p}`]);
    }
    if (typeof record.exclusion_note === 'string' && record.exclusion_note.trim()) {
      notes([record.exclusion_note.trim()]);
    }
    const diagnostics = record.diagnostics;
    if (diagnostics && typeof diagnostics === 'object') {
      add(marginTable((diagnostics as { margins?: unknown }).margins));
    }
    const repro = record.reproducibility;
    if (repro && typeof repro === 'object' && !view.script) {
      const script = (repro as { r_script?: unknown }).r_script;
      if (typeof script === 'string' && script.trim()) view.script = script.trim();
    }
    const assumptions = record.assumption_checks;
    if (assumptions && typeof assumptions === 'object') {
      notes((assumptions as { notes?: unknown }).notes);
      notes((assumptions as { warnings?: unknown }).warnings);
    }
    add(
      recordTable(record.coefficients, 'Coefficients', ['term', 'estimate', 'std_error', 'p_value'])
    );
    add(recordTable(record.correlations, 'Correlations', ['column', 'with', 'r', 'p_value']));
    add(recordTable(record.descriptives, 'Descriptives', ['column', 'n', 'mean', 'std']));
    add(statRow(record, 'Test', ['statistic', 'df', 'p_value', 'effect_size']));
    add(recordTable(record.loadings, 'Loadings', ['variable', 'factor', 'loading']));
    // Item statistics are objects. A bare list of item names is not a reliability table.
    if (
      Array.isArray(record.item_statistics) ||
      (Array.isArray(record.items) &&
        record.items.some(item => item && typeof item === 'object' && !Array.isArray(item)))
    ) {
      add(
        recordTable(record.item_statistics || record.items, 'Items', [
          'item',
          'mean',
          'std_dev',
          'item_total_correlation',
          'alpha_if_deleted',
        ])
      );
    }
    takeDuplicationPanel(record);
    const mark = record.r_syntax_verification;
    if (mark && typeof mark === 'object') {
      const verification = mark as { kind?: unknown; statement?: unknown; status?: unknown };
      const kind = cell(verification.kind || verification.status);
      if (!view.rCheck || (view.rCheck === 'pending' && kind && kind !== 'pending')) {
        view.rCheck = kind;
        view.rStatement = cell(verification.statement);
      }
    }
    if (isFrequencyRecord(record)) {
      const exclusion = (record.exclusion_summary || record.exclusion) as
        | { rows_used?: unknown }
        | undefined;
      const used = exclusion?.rows_used;
      if (typeof used === 'number') {
        const current = Number(view.base.replace(/[^\d]/g, ''));
        if (!view.base || used > current) view.base = `Base ${used.toLocaleString('en-GB')}`;
      }
      const counted = answeredCount(record);
      if (counted > answered) answered = counted;
    }
    if (!view.weight) view.weight = weightName(record);
    if (view.universeThousands == null && record.weight && typeof record.weight === 'object') {
      const universe = (record.weight as { universe_thousands?: unknown }).universe_thousands;
      if (typeof universe === 'number' && Number.isFinite(universe))
        view.universeThousands = universe;
    }
    if (
      !view.weightSource &&
      (record.weight_source === 'study_brief' || record.weight_from_brief === true)
    ) {
      view.weightSource = 'study_brief';
    }
    const labelled = cell(record.filter_text);
    if (labelled) view.filter = labelled;
    else if (!view.filter) {
      const named = filterText(
        record.filter_ref ?? record.filter ?? record.filters ?? record.row_filters
      );
      if (named) view.filter = named;
    }
    if (!view.audience && audienceWasUsed(record)) {
      const audience = cell(record.audience_label);
      if (audience) view.audience = audience;
    }
    if (!view.audienceDefinition) {
      const definition = cell(record.audience_description || record.audience_definition);
      if (definition) view.audienceDefinition = definition;
    }
    if (!view.wave) {
      const wave = cell(record.wave_label);
      if (wave) view.wave = wave;
    }
    if (!view.source) {
      const source = cell(record.source_label);
      if (source) view.source = source;
    }
    for (const [key, nested] of Object.entries(record)) {
      if (key === 'rows' || key === 'columns' || key === 'code_counts' || key === 'preview')
        continue;
      if (descriptives && (key === 'frequency_tables' || key === 'tables')) continue;
      if (nested && typeof nested === 'object') visit(nested, depth + 1, descriptives);
    }
  };
  visit(results, 0);
  if (!lockTables && !view.tables.some(isGroupMeanTable)) {
    for (const table of spareGroupTables) add(table);
  }
  view.tables = relabelRankTables(view.tables, collectGroupLabels(results));
  view.tables = withoutEngineCopies(view.tables).filter((table, index, all) => {
    const blank = table.columns.some(
      (_column, column) =>
        column > 0 && table.rows.length > 0 && table.rows.every(row => !(row[column] || '').trim())
    );
    if (!blank) return true;
    const title = table.title.trim().toLowerCase();
    return !all.some(
      (other, otherIndex) => otherIndex !== index && other.title.trim().toLowerCase() === title
    );
  });
  if (view.tables.some(table => table.title === 'Themes')) {
    view.tables = view.tables.filter(
      table => !/themes among people who answered/i.test(table.title)
    );
  }
  view.tables = view.tables.filter(table => !/assignments \(quote spans\)/i.test(table.title));
  const hasGroupFunnel = view.tables.some(table => {
    const headers = table.columns.map(column => column.trim().toLowerCase());
    return headers.includes('stage') && headers.includes('group');
  });
  if (!hasGroupFunnel) {
    const grouped = groupFunnelFrom(results);
    if (grouped) view.tables.push(grouped);
  }
  view.tables = onlyTheFunnel(oneFunnel(oneNpsBreakdown(view.tables)));
  view.tables = withoutRepeatedTables(view.tables);
  const total = largestFrequencyTotal(view);
  const used = Number(view.base.replace(/[^\d.]/g, ''));
  if (total && used && used < total / 2) view.base = '';
  if (answered) view.base = `Base ${answered.toLocaleString('en-GB')}`;
  else if (!view.base) {
    const fromTable = frequencyAnswered(view);
    if (fromTable) view.base = `Base ${fromTable.toLocaleString('en-GB')}`;
  }
  const detail =
    view.tables.find(table => table.note && /sample size|base =/i.test(table.note))?.note ||
    sample.note;
  if (sample.sawTableBase) view.baseDetail = sampleLine(sample);
  else if (detail) view.baseDetail = normalizeWeightDetail(detail);
  else if (sample.sawN || sample.sawTotal) view.baseDetail = sampleLine(sample);
  if (!view.weight && sample.weight) view.weight = sample.weight;
  if (
    !view.weight &&
    sample.sawTableBase &&
    sample.tableWeighted != null &&
    sample.tableWeighted !== sample.tableUnweighted
  ) {
    // Bases are weighted but the book never named the column. Chip, footnote and base stay aligned.
    view.weight = 'Weighted';
  }
  view.charts = chartsFromToolPayloads(results);
  return view;
}

function answeredCount(record: Record<string, unknown>): number {
  const summary = record.summary;
  const stats =
    summary && typeof summary === 'object'
      ? (summary as { stats?: { n_valid?: unknown } }).stats
      : undefined;
  const block = record.statistics_block as { 'N Valid'?: unknown } | undefined;
  const raw = stats?.n_valid ?? block?.['N Valid'];
  const count = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

function frequencyCountIndex(columns: string[]): number {
  return columns.findIndex(column => {
    const name = column.trim().toLowerCase();
    return name === 'frequency' || name === 'count' || name === 'n';
  });
}

/** Valid answers on a frequency table. A partial table that does not add up to its total is left out. */
function frequencyAnswered(view: ResultView): number {
  let reconciled = 0;
  let open = 0;
  for (const table of view.tables) {
    const frequencyAt = frequencyCountIndex(table.columns);
    if (frequencyAt < 0) continue;
    let categories = 0;
    let missing = 0;
    let total = 0;
    let sawTotal = false;
    for (const row of table.rows) {
      const label = (row[0] || '').toLowerCase();
      const count = Number(String(row[frequencyAt]).replace(/,/g, ''));
      if (!Number.isFinite(count)) continue;
      if (label === 'total') {
        sawTotal = true;
        total = count;
      } else if (label === 'missing') missing = count;
      else categories += count;
    }
    if (!categories) continue;
    if (sawTotal) {
      const matches =
        Math.abs(categories - total) < 0.5 || Math.abs(categories + missing - total) < 0.5;
      if (matches && categories > reconciled) reconciled = categories;
    } else if (categories > open) open = categories;
  }
  return reconciled || open;
}

function largestFrequencyTotal(view: ResultView): number {
  let largest = 0;
  for (const table of view.tables) {
    const frequencyAt = frequencyCountIndex(table.columns);
    if (frequencyAt < 0) continue;
    for (const row of table.rows) {
      if ((row[0] || '').toLowerCase() !== 'total') continue;
      const count = Number(String(row[frequencyAt]).replace(/,/g, ''));
      if (count > largest) largest = count;
    }
  }
  return largest;
}

export type ColumnLabels = {
  name: string;
  label?: string | null;
  value_labels?: Record<string, string> | null;
};

function columnMeta(columns: ColumnLabels[], name: string): ColumnLabels | undefined {
  const key = name.trim().toLowerCase();
  return columns.find(column => column.name.trim().toLowerCase() === key);
}

function valueLabel(meta: ColumnLabels | undefined, raw: string): string {
  const labels = meta?.value_labels || {};
  const shown = labels[raw] || labels[raw.replace(/\.0$/, '')] || labels[`${raw}.0`] || '';
  return shown && shown.trim().toLowerCase() !== raw.trim().toLowerCase() ? shown.trim() : raw;
}

/** Column and value labels. A code stays a code when this file has no label for it. */
export function labelFilter(filter: string, columns: ColumnLabels[] = []): string {
  if (!filter.trim() || !columns.length) return filter;
  return filter
    .split(', ')
    .map(part => {
      const match = /^(.+?)\s+(\S+)\s+(.+)$/.exec(part.trim());
      if (!match) return part;
      const [, column, op, raw] = match;
      const meta = columnMeta(columns, column);
      if (!meta) return part;
      const named = (meta.label || '').trim();
      return `${named || column} ${op} ${valueLabel(meta, raw)}`;
    })
    .join(', ');
}

/** A stored weight of "none" is an unweighted run. */
export function shownMetric(label: string, value: string): string {
  const name = label.trim().toLowerCase();
  const text = value.trim();
  const folded = text.toLowerCase();
  if (name === 'weight' && (folded === 'none' || folded === 'unweighted' || folded === 'null')) {
    return 'Unweighted';
  }
  if (name === 'weight' && folded === 'active none; weight_column none') return 'Unweighted';
  // A snake_case column code is not a label a person should read.
  if (name === 'weight' && /[a-z]_[a-z0-9]/i.test(text) && !/\s/.test(text)) {
    return 'Weighted';
  }
  return value;
}

/** The name on the weight chip. This run's weight wins over the project ledger. */
export function weightChipName(
  resultWeight: string,
  ledgerWeight: string,
  columns: ColumnLabels[] = []
): string {
  const result = resultWeight.trim();
  if (result) {
    if (/^(none|unweighted|null)$/i.test(result)) return 'Unweighted';
    const note = weightNote(result, columns);
    if (note === 'Unweighted' || note === 'Weighted') return note;
    return note.replace(/^Weight:\s*/, '');
  }
  const ledger = ledgerWeight.trim();
  if (ledger && !/^(none|unweighted|null)$/i.test(ledger)) {
    const note = weightNote(ledger, columns);
    if (note === 'Unweighted' || note === 'Weighted') return note;
    return note.replace(/^Weight:\s*/, '');
  }
  return 'Unweighted';
}

/** The weight's label. The bare column name "weight" is not a label. */
export function weightNote(column: string, columns: ColumnLabels[] = []): string {
  const name = column.trim();
  if (!name || name.toLowerCase() === 'none' || name.toLowerCase() === 'unweighted')
    return 'Unweighted';
  const meta = columnMeta(columns, name);
  const label = stripCodeBrackets((meta?.label || '').trim(), name);
  if (label && label.toLowerCase() !== 'weight' && label.toLowerCase() !== name.toLowerCase()) {
    return `Weight: ${label}`;
  }
  if (name.toLowerCase() === 'weight') return 'Weighted';
  if (/[a-z]_[a-z0-9]/i.test(name)) return 'Weighted';
  return `Weight: ${stripCodeBrackets(name)}`;
}

/** A stored "Weight: none" is an unweighted run. Never show the sentinel to a person. */
function normalizeWeightDetail(detail: string): string {
  return detail.replace(/Weight:\s*(none|null)\b/gi, 'Weight: Unweighted');
}

function detailWithWeightLabel(detail: string, weight: string, columns: ColumnLabels[]): string {
  const cleaned = normalizeWeightDetail(detail);
  if (!cleaned || !/weight:/i.test(cleaned) || !weight) return cleaned;
  const named = weightNote(weight, columns);
  if (!named || named === 'Unweighted') return cleaned;
  return cleaned.replace(/Weight:\s*[^;]+/i, named);
}

export function resultFootnote(
  view: ResultView,
  base: string,
  test: string,
  columns: ColumnLabels[] = []
): string {
  const filter = labelFilter(view.filter, columns);
  const detail = detailWithWeightLabel(view.baseDetail || '', view.weight || '', columns);
  const namedWeight = view.weight ? weightNote(view.weight, columns) : 'Unweighted';
  const weight =
    detail && /weight:/i.test(detail)
      ? ''
      : view.weightSource === 'study_brief' && view.weight
        ? `${namedWeight}, the weight named in the study brief`
        : namedWeight;
  const universe =
    typeof view.universeThousands === 'number'
      ? `Universe ${view.universeThousands.toFixed(1)} thousand`
      : '';
  const parts = [
    detail ? '' : base.trim() || view.base,
    view.audience
      ? `Audience: ${view.audience}${view.audienceDefinition ? ` — ${view.audienceDefinition}` : ''}`
      : '',
    view.wave ? `Wave: ${view.wave}` : '',
    view.source ? `Source: ${view.source}` : '',
    filter ? `Filter: ${filter}` : '',
    weight,
    universe,
    test && test !== 'Output' ? test : '',
    view.letterNote,
    detail,
  ];
  return parts.filter(Boolean).join(' · ');
}
