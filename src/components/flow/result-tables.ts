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
  letterNote: string;
};

/** The builder table replaces the engine copy. A coefficients table with SE replaces the empty one. */
export function withoutEngineCopies<T extends { title?: string; columns?: string[] }>(
  tables: T[]
): T[] {
  const titles = tables.map(table => (table.title || '').trim().toLowerCase());
  const has = (name: string) => titles.includes(name);
  const labelledCoefficients = tables.some(
    table =>
      (table.title || '').trim().toLowerCase() === 'coefficients' &&
      (table.columns || []).some(column => column.trim().toLowerCase() === 'se')
  );
  return tables.filter(table => {
    const title = (table.title || '').trim().toLowerCase();
    if (
      has('correlations') &&
      (title.includes('correlation matrix') || title.includes('correlation p-value'))
    ) {
      return false;
    }
    if (has('groups') && (title === 'group statistics' || title === 'group means')) return false;
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

/** A decimal the result already printed, at the one display setting. Labels stay as written. */
export function formatDecimalText(value: string, places: number): string {
  const match = value.trim().match(/^(-?\d[\d,]*)(\.\d+)(%?)$/);
  if (!match?.[2]) return value;
  const number = Number(`${match[1].replace(/,/g, '')}${match[2]}`);
  if (!Number.isFinite(number)) return value;
  const digits = Math.max(0, Math.min(6, Math.trunc(places)));
  return `${number.toFixed(digits)}${match[3] || ''}`;
}

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

function asTable(value: unknown): RunTable | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as {
    title?: unknown;
    columns?: unknown;
    rows?: unknown;
    headers?: unknown;
    variable_names?: unknown;
  };
  if (Array.isArray(record.headers) && Array.isArray(record.variable_names)) return null;
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
    const records = block.rows.filter(
      (row): row is Record<string, unknown> =>
        Boolean(row) && typeof row === 'object' && !Array.isArray(row)
    );
    const means = records.some(row => row.mean != null || row.sd != null || row.std != null);
    const body: string[][] = [];
    for (const record of records) {
      const label = cell(record.label ?? record.value ?? record.variable);
      if (!label || label === 'Total' || label === 'Missing') continue;
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
        : ['Answer', 'Frequency', 'Percent'],
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
        Number.isFinite(score) ? String(Math.round(score)) : cell(record.nps),
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
    if (code && label && label !== code) labels.set(code, label);
  }
  return labels;
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
    cell(record.p_value ?? source.p_value ?? source.p),
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
      const left =
        labels.get(cell(record.group1 ?? record.group_a ?? record.a)) ||
        cell(record.group1 ?? record.group_a ?? record.a);
      const right =
        labels.get(cell(record.group2 ?? record.group_b ?? record.b)) ||
        cell(record.group2 ?? record.group_b ?? record.b);
      if (!left || !right) return null;
      return [
        left,
        right,
        cell(record.meandiff ?? record.mean_diff ?? record.diff),
        cell(record['p-adj'] ?? record.p_adj ?? record.p_value),
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

function weightName(record: Record<string, unknown>): string {
  if (record.weight && typeof record.weight === 'object') {
    return cell((record.weight as { column?: unknown }).column);
  }
  const named =
    typeof record.weight === 'string'
      ? record.weight
      : typeof record.weight_column === 'string'
        ? record.weight_column
        : typeof record.resolved_weight === 'string'
          ? record.resolved_weight
          : '';
  const text = named.trim();
  if (!text || text.toLowerCase() === 'none' || text.toLowerCase() === 'unweighted') return '';
  return text;
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
    const block = summary as { table?: unknown; title?: unknown };
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
    letterNote: '',
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
    const key = `${table.title}\n${table.columns.join('\t')}\n${table.rows.map(row => row.join('\t')).join('\n')}`;
    if (seen.has(key)) return;
    seen.add(key);
    view.tables.push(table);
    if (source === 'summary') usedSummary = true;
  };
  for (const table of preferred) add(table, 'summary');
  if (preferred.length) lockTables = true;
  const notes = (value: unknown) => {
    if (!Array.isArray(value)) return;
    for (const note of value) {
      const text = cell(note);
      if (text && !view.checks.includes(text)) view.checks.push(text);
    }
  };
  const visit = (value: unknown, depth: number, inDescriptives = false) => {
    if (!value || typeof value !== 'object' || depth > 5) return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1, inDescriptives);
      return;
    }
    const record = value as Record<string, unknown>;
    const descriptives =
      inDescriptives ||
      record.procedure === 'descriptives' ||
      record.analysis_type === 'descriptives';
    const title = cell(record.title);
    const syntaxDump =
      record.id === 'equivalent_syntax' || title === 'Equivalent R and SPSS syntax';
    if (!syntaxDump) {
      const table = asTable(record);
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
      for (const table of summaryTables(block.table, cell(block.title))) add(table, 'summary');
    }
    notes(record.notes);
    if (!view.script && typeof record.r_syntax === 'string' && record.r_syntax.trim()) {
      view.script = record.r_syntax.trim();
    }
    for (const table of summaryTables(record.table, cell(record.title))) add(table, 'summary');
    const means = describeTable(record.describe, record.variable_labels);
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
      const p = cell((levene as { p_value?: unknown }).p_value);
      if (p) notes([`Levene p = ${p}`]);
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
    if (!view.weight) view.weight = weightName(record);
    if (!view.filter) {
      const named = filterText(
        record.filter_ref ?? record.filter ?? record.filters ?? record.row_filters
      );
      if (named) view.filter = named;
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

/** A stored weight of "none" is an unweighted run. */
export function shownMetric(label: string, value: string): string {
  const name = label.trim().toLowerCase();
  const text = value.trim();
  const folded = text.toLowerCase();
  if (name === 'weight' && (folded === 'none' || folded === 'unweighted' || folded === 'null')) {
    return 'Unweighted';
  }
  if (name === 'weight' && folded === 'active none; weight_column none') return 'Unweighted';
  return value;
}

/** The weight's label. The bare column name "weight" is not a label. */
export function weightNote(column: string, columns: ColumnLabels[] = []): string {
  const name = column.trim();
  if (!name || name.toLowerCase() === 'none' || name.toLowerCase() === 'unweighted')
    return 'Unweighted';
  const meta = columnMeta(columns, name);
  const label = (meta?.label || '').trim();
  if (label && label.toLowerCase() !== 'weight' && label.toLowerCase() !== name.toLowerCase()) {
    return `Weight: ${label}`;
  }
  if (name.toLowerCase() === 'weight') return 'Weighted';
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
    view.letterNote,
  ];
  return parts.filter(Boolean).join(' · ');
}
