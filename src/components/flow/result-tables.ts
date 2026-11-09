import type { RunTable } from '@/components/flow/run-document';

export type ResultView = {
  tables: RunTable[];
  script: string;
  checks: string[];
  weight: string;
  filter: string;
  /** match, mismatch, pending, or empty when this result has no R reproduction. */
  rCheck: string;
  rStatement: string;
  base: string;
};

function cell(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    const rounded = Math.round(value * 1000) / 1000;
    return String(rounded);
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const label = record.label ?? record.name ?? record.text ?? record.value ?? record.title;
    if (label != null && typeof label !== 'object') return cell(label);
    return '';
  }
  return String(value).trim();
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

function asTable(value: unknown): RunTable | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as { title?: unknown; columns?: unknown; rows?: unknown };
  const columns = Array.isArray(record.columns) ? record.columns.map(cell) : [];
  const percentAt = columns.map(column => column.toLowerCase().includes('percent'));
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
  return { title: questionTitle(cell(record.title)), columns, rows };
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
    const body: string[][] = [];
    for (const row of block.rows) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
      const record = row as Record<string, unknown>;
      const label = cell(record.value ?? record.label);
      if (!label || label === 'Total' || label === 'Missing') continue;
      body.push([label, cell(record.frequency ?? record.n), percentCell(record.percent)]);
    }
    if (!body.length) continue;
    built.push({
      title: questionTitle(cell(block.title) || fallbackTitle),
      columns: ['Answer', 'Frequency', 'Percent'],
      rows: body,
    });
  }
  return built;
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
        if (value != null && String(value).trim()) return cell(value);
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
      header: key.replaceAll('_', ' '),
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
    rows: [present.map(key => cell(record[key]))],
  };
}

function groupTable(groups: unknown): RunTable | null {
  if (!Array.isArray(groups) || !groups.length) return null;
  const rows = groups
    .filter(row => row && typeof row === 'object')
    .map(row => {
      const record = row as Record<string, unknown>;
      const label = cell(record.label || record.group);
      if (!label) return null;
      return [label, cell(record.n), cell(record.mean), cell(record.std ?? record.sd)];
    })
    .filter((row): row is string[] => Boolean(row));
  if (!rows.length) return null;
  return { title: 'Group means', columns: ['Group', 'n', 'Mean', 'SD'], rows };
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

/** Tables, the R script, checks, the weight and the filter carried on a finished turn. */
export function resultViewFromToolResults(results: unknown): ResultView {
  let answered = 0;
  const view: ResultView = {
    tables: [],
    script: '',
    checks: [],
    weight: '',
    filter: '',
    rCheck: '',
    rStatement: '',
    base: '',
  };
  const seen = new Set<string>();
  let usedSummary = false;
  const add = (table: RunTable | null, source: 'summary' | 'grid' = 'grid') => {
    if (!table || table.title === 'Equivalent R and SPSS syntax') return;
    if (
      usedSummary &&
      source === 'grid' &&
      table.columns.some(column => /frequency|percent/i.test(column))
    ) {
      return;
    }
    const key = `${table.title}\n${table.columns.join('\t')}\n${table.rows.map(row => row.join('\t')).join('\n')}`;
    if (seen.has(key)) return;
    seen.add(key);
    view.tables.push(table);
    if (source === 'summary') usedSummary = true;
  };
  const notes = (value: unknown) => {
    if (!Array.isArray(value)) return;
    for (const note of value) {
      const text = cell(note);
      if (text && !view.checks.includes(text)) view.checks.push(text);
    }
  };
  const visit = (value: unknown, depth: number) => {
    if (!value || typeof value !== 'object' || depth > 5) return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1);
      return;
    }
    const record = value as Record<string, unknown>;
    const title = cell(record.title);
    const syntaxDump =
      record.id === 'equivalent_syntax' || title === 'Equivalent R and SPSS syntax';
    if (!syntaxDump) add(asTable(record));
    const summary = record.summary;
    if (summary && typeof summary === 'object') {
      const block = summary as { table?: unknown; title?: unknown };
      for (const table of summaryTables(block.table, cell(block.title))) add(table, 'summary');
    }
    for (const table of summaryTables(record.table, cell(record.title))) add(table, 'summary');
    for (const key of ['frequency_tables', 'tables'] as const) {
      const list = record[key];
      if (Array.isArray(list)) for (const item of list) add(asTable(item));
    }
    add(
      shareTable(record.code_frequency, 'Themes', [
        { header: 'Theme', keys: ['label', 'code'] },
        { header: 'Count', keys: ['n', 'count'] },
        { header: '% of people who answered', keys: ['percent'] },
        { header: 'Quote', keys: ['quote', 'example', 'quote_span'] },
      ])
    );
    add(groupTable(record.group_descriptives));
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
    add(recordTable(record.items, 'Reliability', ['item', 'alpha_if_deleted', 'item_total']));
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
    if (!view.weight && record.weight && typeof record.weight === 'object') {
      view.weight = cell((record.weight as { column?: unknown }).column);
    }
    if (!view.filter) {
      const named = record.filter_ref ?? record.filter ?? record.filters ?? record.row_filters;
      if (typeof named === 'string' && named.trim()) view.filter = named.trim();
      else if (Array.isArray(named)) {
        const parts = named
          .filter(item => item && typeof item === 'object')
          .map(item => {
            const row = item as { column?: unknown; value?: unknown; op?: unknown };
            const column = cell(row.column);
            const compared = cell(row.value);
            if (!column || !compared) return '';
            return `${column} ${cell(row.op) || '='} ${compared}`;
          })
          .filter(Boolean);
        if (parts.length) view.filter = parts.join(', ');
      }
    }
    for (const [key, nested] of Object.entries(record)) {
      if (key === 'rows' || key === 'columns' || key === 'code_counts') continue;
      if (nested && typeof nested === 'object') visit(nested, depth + 1);
    }
  };
  visit(results, 0);
  const total = largestFrequencyTotal(view);
  const used = Number(view.base.replace(/[^\d.]/g, ''));
  if (total && used && used < total / 2) view.base = '';
  if (answered) view.base = `Base ${answered.toLocaleString('en-GB')}`;
  else if (!view.base) {
    const fromTable = frequencyAnswered(view);
    if (fromTable) view.base = `Base ${fromTable.toLocaleString('en-GB')}`;
  }
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

/** Valid answers on a frequency table. A partial table that does not add up to its total is left out. */
function frequencyAnswered(view: ResultView): number {
  let reconciled = 0;
  let open = 0;
  for (const table of view.tables) {
    const frequencyAt = table.columns.findIndex(column => column.toLowerCase() === 'frequency');
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
    const frequencyAt = table.columns.findIndex(column => column.toLowerCase() === 'frequency');
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

/** The weight's label. The bare column name "weight" is not a label. */
export function weightNote(column: string, columns: ColumnLabels[] = []): string {
  const name = column.trim();
  if (!name) return 'Unweighted';
  const meta = columnMeta(columns, name);
  const label = (meta?.label || '').trim();
  if (label && label.toLowerCase() !== 'weight' && label.toLowerCase() !== name.toLowerCase()) {
    return `Weight: ${label}`;
  }
  if (name.toLowerCase() === 'weight') return '';
  return `Weight: ${name}`;
}

export function resultFootnote(
  view: ResultView,
  base: string,
  test: string,
  columns: ColumnLabels[] = []
): string {
  const filter = labelFilter(view.filter, columns);
  const parts = [
    base.trim() || view.base,
    filter ? `Filter: ${filter}` : '',
    view.weight ? weightNote(view.weight, columns) : 'Unweighted',
    test && test !== 'Output' ? test : '',
  ];
  return parts.filter(Boolean).join(' · ');
}
