import { isIdColumn, isInternalColumn, type FlowColumn } from '@/lib/flow-columns';

export type AudienceCombine = 'and' | 'or';

export type AudienceCondition = {
  column: string;
  op: string;
  value: string;
  values?: string[];
  exclude: boolean;
  group?: AudienceCondition[];
};

type StoredFilter = {
  combine?: string;
  op?: string;
  column?: string;
  value?: unknown;
  filters?: StoredFilter[];
};

const BLANK: AudienceCondition = { column: '', op: '=', value: '', exclude: false };

/** Questions a person can put in an audience: a label, and that question's own answers. */
export function audienceQuestions(columns: FlowColumn[]): FlowColumn[] {
  return columns.filter(column => {
    const name = column.name?.trim();
    if (!name || isInternalColumn(name) || isIdColumn(name)) return false;
    if (String(column.role || '').toLowerCase() === 'weight') return false;
    const label = String(column.label || '').trim();
    if (!label || label === name) return false;
    const labels = column.value_labels;
    return Boolean(labels && Object.keys(labels).length);
  });
}

export function questionLabel(column: FlowColumn): string {
  return String(column.label || '').trim();
}

/** A questionnaire number already written on the question, never a variable name. */
export function questionCode(column: FlowColumn): string {
  const match = `${column.label || ''} ${column.name}`.match(/(?:^|[^A-Za-z0-9])[qQ](\d+)/);
  return match ? `Q${match[1]}` : '';
}

export function answerOptions(column: FlowColumn): { code: string; label: string }[] {
  const labels = column.value_labels || {};
  return Object.entries(labels)
    .filter(([, label]) => String(label || '').trim())
    .map(([code, label]) => ({ code: String(code), label: String(label).trim() }));
}

export function isScale(options: { code: string }[]): boolean {
  if (options.length < 3 || options.length > 11) return false;
  const numbers = options.map(option => Number(option.code));
  if (numbers.some(value => !Number.isInteger(value))) return false;
  const sorted = [...numbers].sort((a, b) => a - b);
  return sorted.every((value, index) => index === 0 || value === sorted[index - 1]! + 1);
}

function selectedValues(condition: AudienceCondition): string[] {
  const listed = condition.values?.length
    ? condition.values
    : condition.value
      ? [condition.value]
      : [];
  return listed.map(value => String(value).trim()).filter(Boolean);
}

function oneClause(condition: AudienceCondition): Record<string, unknown> | null {
  if (condition.group) {
    const filters = condition.group.map(oneClause).filter(Boolean);
    if (!filters.length) return null;
    return { combine: 'or', filters };
  }
  const values = selectedValues(condition);
  if (!condition.column.trim() || !values.length) return null;
  const clause =
    values.length === 1
      ? { column: condition.column.trim(), op: condition.op.trim() || '=', value: values[0] }
      : { column: condition.column.trim(), op: 'in', value: values };
  if (!condition.exclude) return clause;
  return { op: 'not', combine: 'and', filters: [clause] };
}

/** The filter the audience API stores. An excluded condition is a not group. */
export function audienceFilter(combine: AudienceCombine, conditions: AudienceCondition[]) {
  const filters = conditions.map(oneClause).filter(Boolean);
  return { combine, filters };
}

function columnByName(columns: FlowColumn[], name: string | undefined): FlowColumn | undefined {
  if (!name) return undefined;
  const matches = columns.filter(column => column.name === name);
  return (
    matches.find(column => {
      const label = questionLabel(column);
      return Boolean(label) && label !== column.name;
    }) || matches[0]
  );
}

function codeKey(value: string): string {
  const text = value.trim();
  if (/^-?\d+(?:\.0+)?$/.test(text)) return String(Number(text));
  return text;
}

function storedWords(codes: string[]): string {
  const words = codes.filter(code => !/^-?\d+(?:\.0+)?$/.test(code));
  return words.length === codes.length ? words.join(', ') : '';
}

function valuePhrase(column: FlowColumn, value: unknown): string {
  const options = answerOptions(column);
  const codes = (Array.isArray(value) ? value : [value]).map(item => String(item ?? '').trim());
  const clean = codes.filter(Boolean);
  if (!clean.length) return '';
  if (!options.length) return storedWords(clean);
  const byCode = new Map(options.map(option => [codeKey(option.code), option.label]));
  const byLabel = new Map(options.map(option => [option.label.trim().toLowerCase(), option.label]));
  const resolved = clean.map(
    code =>
      byCode.get(codeKey(code)) ||
      byLabel.get(code.toLowerCase()) ||
      (storedWords([code]) ? code : '')
  );
  if (resolved.some(label => !label)) return '';
  const numericScale = isScale(options) && options.every(option => option.label === option.code);
  if (numericScale) {
    const numbers = clean.map(code => Number(codeKey(code))).sort((a, b) => a - b);
    const run = numbers.every((item, index) => index === 0 || item === numbers[index - 1]! + 1);
    if (run && numbers.every(item => Number.isFinite(item)))
      return numbers.length === 1
        ? String(numbers[0])
        : `${numbers[0]}–${numbers[numbers.length - 1]}`;
  }
  return resolved.join(', ');
}

function clauseText(item: StoredFilter, columns: FlowColumn[]): string {
  if (Array.isArray(item.filters) && !item.column) {
    if (item.op === 'not' && item.filters.length === 1 && item.filters[0]?.column) {
      const leaf = item.filters[0];
      const column = columnByName(columns, leaf.column);
      const label = column ? questionLabel(column) : '';
      if (!column || !label || label === column.name) return '';
      const shown = valuePhrase(column, leaf.value);
      const head = [questionCode(column), questionLabel(column)].filter(Boolean).join(' ');
      const multi = Array.isArray(leaf.value) && leaf.value.length > 1;
      if (!shown) return head;
      return multi ? `${head} excludes ${shown}` : `${head} is not ${shown}`;
    }
    const inner = joinClauses(item.filters, item.combine === 'or' ? 'or' : 'and', columns);
    if (!inner) return '';
    return item.op === 'not' ? `not ${inner}` : inner;
  }
  const column = columnByName(columns, item.column);
  const label = column ? questionLabel(column) : '';
  if (!column || !label || label === column.name) return '';
  const shown = valuePhrase(column, item.value);
  const head = [questionCode(column), questionLabel(column)].filter(Boolean).join(' ');
  return shown ? `${head} is ${shown}` : head;
}

function described(item: StoredFilter, columns: FlowColumn[]) {
  if (Array.isArray(item.filters) && !item.column) {
    return { key: '', head: '', value: '', text: clauseText(item, columns) };
  }
  const column = columnByName(columns, item.column);
  const label = column ? questionLabel(column) : '';
  if (!column || !label || label === column.name) {
    return { key: '', head: '', value: '', text: '' };
  }
  const shown = valuePhrase(column, item.value);
  const head = [questionCode(column), questionLabel(column)].filter(Boolean).join(' ');
  return {
    key: column.name,
    head,
    value: shown,
    text: shown ? `${head} is ${shown}` : head,
  };
}

function joinClauses(
  filters: StoredFilter[],
  combine: 'and' | 'or',
  columns: FlowColumn[]
): string {
  const bits = filters.map(item => described(item, columns)).filter(bit => bit.text);
  if (
    combine === 'or' &&
    bits.length > 1 &&
    bits.every(bit => bit.key && bit.value && bit.key === bits[0]?.key)
  ) {
    return `${bits[0]?.head} is ${bits.map(bit => bit.value).join(' or ')}`;
  }
  const word = combine === 'or' ? ' or ' : ' and ';
  return bits.map(bit => bit.text).join(word);
}

/** The definition in the question's own words. A column code is left out. */
export function audienceDefinitionText(
  filter: { combine?: string; filters?: unknown[] } | undefined,
  columns: FlowColumn[]
): string {
  if (!filter || !Array.isArray(filter.filters)) return '';
  return joinClauses(
    filter.filters as StoredFilter[],
    filter.combine === 'or' ? 'or' : 'and',
    columns
  );
}

function conditionFromClause(item: StoredFilter, exclude: boolean): AudienceCondition | null {
  const column = String(item.column || '').trim();
  if (!column) return null;
  const raw = item.value;
  const values = Array.isArray(raw) ? raw.map(value => String(value)) : [String(raw ?? '')];
  const clean = values.map(value => value.trim()).filter(Boolean);
  return {
    column,
    op: String(item.op || '='),
    value: clean[0] || '',
    values: clean,
    exclude,
  };
}

export function conditionsFromFilter(
  filter: { combine?: string; filters?: unknown[] } | undefined
): {
  combine: AudienceCombine;
  conditions: AudienceCondition[];
} {
  const stored = filter?.combine === 'or' ? 'or' : 'and';
  const filters = Array.isArray(filter?.filters) ? (filter?.filters as StoredFilter[]) : [];
  const next = filters.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    if (Array.isArray(item.filters) && !item.column) {
      if (item.op === 'not') {
        const clause = item.filters[0] ? conditionFromClause(item.filters[0], true) : null;
        return clause ? [clause] : [];
      }
      const group = item.filters.flatMap(clause => {
        const built = conditionFromClause(clause, false);
        return built ? [built] : [];
      });
      return group.length ? [{ ...BLANK, group }] : [];
    }
    const built = conditionFromClause(item, false);
    return built ? [built] : [];
  });
  return { combine: stored, conditions: next.length ? next : [{ ...BLANK }] };
}
