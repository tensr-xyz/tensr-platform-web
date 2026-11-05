export type RunTable = {
  title: string;
  columns: string[];
  rows: string[][];
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

function groupTable(result: Record<string, unknown>): RunTable | null {
  const groups = result.group_descriptives;
  if (!Array.isArray(groups) || !groups.length) return null;
  const rows = groups
    .filter(group => group && typeof group === 'object')
    .map(group => {
      const row = group as { group?: unknown; n?: unknown; mean?: unknown; std?: unknown };
      return [text(row.group), text(row.n), text(row.mean), text(row.std)];
    })
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
  const meta = (report.meta && typeof report.meta === 'object' ? report.meta : {}) as Record<
    string,
    unknown
  >;
  const tables = [
    ...((Array.isArray(report.tables) ? report.tables : [])
      .map(tableFromReport)
      .filter(Boolean) as RunTable[]),
  ];
  const groups = groupTable(result);
  const anova = anovaTable(result);
  if (groups && !tables.some(table => table.title === groups.title)) tables.unshift(groups);
  if (anova && !tables.some(table => table.title === anova.title)) tables.push(anova);
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
  const base =
    typeof result.n_used === 'number'
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
