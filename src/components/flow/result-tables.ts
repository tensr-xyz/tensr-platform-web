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

function asTable(value: unknown): RunTable | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as { title?: unknown; columns?: unknown; rows?: unknown };
  const columns = Array.isArray(record.columns) ? record.columns.map(cell) : [];
  const rows = Array.isArray(record.rows)
    ? record.rows
        .filter(row => Array.isArray(row))
        .map(row => (row as unknown[]).map(cell))
        .filter(row => row.some(Boolean))
    : [];
  if (columns.filter(Boolean).length < 2 || !rows.length) return null;
  return { title: cell(record.title) || 'Table', columns, rows };
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

/** Tables, the R script, checks, the weight and the filter carried on a finished turn. */
export function resultViewFromToolResults(results: unknown): ResultView {
  const view: ResultView = {
    tables: [],
    script: '',
    checks: [],
    weight: '',
    filter: '',
    rCheck: '',
    rStatement: '',
  };
  const seen = new Set<string>();
  const add = (table: RunTable | null) => {
    if (!table || table.title === 'Equivalent R and SPSS syntax') return;
    const key = `${table.title}\n${table.columns.join('\t')}\n${table.rows.map(row => row.join('\t')).join('\n')}`;
    if (seen.has(key)) return;
    seen.add(key);
    view.tables.push(table);
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
    for (const key of ['frequency_tables', 'tables'] as const) {
      const list = record[key];
      if (Array.isArray(list)) for (const item of list) add(asTable(item));
    }
    add(
      shareTable(record.code_frequency, 'Themes', [
        { header: 'Theme', keys: ['label', 'code'] },
        { header: 'Count', keys: ['n', 'count'] },
        { header: '%', keys: ['percent'] },
        { header: 'Example', keys: ['example', 'quote', 'quote_span'] },
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
    if (!view.weight && record.weight && typeof record.weight === 'object') {
      view.weight = cell((record.weight as { column?: unknown }).column);
    }
    if (!view.filter) {
      const named = record.filter_ref ?? record.filter ?? record.filters;
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
  return view;
}

export function resultFootnote(view: ResultView, base: string, test: string): string {
  const parts = [
    base.trim(),
    view.filter ? `Filter: ${view.filter}` : '',
    view.weight ? `Weight: ${view.weight}` : '',
    test && test !== 'Output' ? test : '',
  ];
  return parts.filter(Boolean).join(' · ');
}
