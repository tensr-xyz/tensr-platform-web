export type ChoiceRole =
  | 'respondent'
  | 'task'
  | 'alternative'
  | 'chosen'
  | 'best'
  | 'worst'
  | 'attribute'
  | 'ignore';

const ROLE_HINTS: { role: ChoiceRole; pattern: RegExp }[] = [
  { role: 'respondent', pattern: /respondent|respid|participant|user_id/i },
  { role: 'task', pattern: /task|set_id|profile_id|question/i },
  { role: 'alternative', pattern: /alternative|alt$|concept/i },
  { role: 'chosen', pattern: /chosen|choice|selected/i },
  { role: 'best', pattern: /^best$|best_item/i },
  { role: 'worst', pattern: /^worst$|worst_item/i },
];

export function suggestChoiceRoles(columns: string[]): Record<string, ChoiceRole> {
  const roles: Record<string, ChoiceRole> = {};
  const used = new Set<ChoiceRole>();
  for (const column of columns) {
    const hint = ROLE_HINTS.find(item => item.pattern.test(column) && !used.has(item.role));
    if (hint) {
      roles[column] = hint.role;
      used.add(hint.role);
    } else if (/^set_\d+$/i.test(column)) {
      roles[column] = 'attribute';
    } else {
      roles[column] = 'ignore';
    }
  }
  return roles;
}

export function rolesFromSavedChoiceBody(body: Record<string, unknown>): {
  roles: Record<string, ChoiceRole>;
  items: string;
  individual: boolean;
  savedOp?: string;
  setColumns: string[];
} {
  const roles: Record<string, ChoiceRole> = {};
  const assign = (role: ChoiceRole, value: unknown) => {
    if (typeof value === 'string' && value.trim()) roles[value] = role;
  };
  assign('best', body.best_column);
  assign('worst', body.worst_column);
  assign('chosen', body.chosen_column);
  assign('task', body.profile_id_column || body.task_column);
  assign('respondent', body.respondent_column);
  const attributes = Array.isArray(body.attribute_columns) ? body.attribute_columns : [];
  for (const attribute of attributes) {
    if (typeof attribute === 'string' && attribute.trim()) roles[attribute] = 'attribute';
  }
  const items = Array.isArray(body.items) ? body.items.map(item => String(item)).join(', ') : '';
  const setColumns = Array.isArray(body.set_columns)
    ? body.set_columns.map(item => String(item))
    : [];
  const savedOp = typeof body.__op === 'string' ? body.__op : undefined;
  return {
    roles,
    items,
    individual: savedOp === 'maxdiff_hb' || savedOp === 'conjoint_hb',
    savedOp,
    setColumns,
  };
}

const MAXDIFF_COUNT_KEYS = ['best_column', 'worst_column', 'items', 'segment_column'] as const;
const MAXDIFF_MNL_KEYS = ['best_column', 'worst_column', 'set_columns', 'items'] as const;
const MAXDIFF_INDIVIDUAL_KEYS = [
  'best_column',
  'worst_column',
  'set_columns',
  'items',
  'respondent_column',
] as const;

export function maxdiffAnalyzeBody(input: {
  roles: Record<string, ChoiceRole>;
  columns: string[];
  items: string;
  segment?: string;
  individual: boolean;
  savedOp?: string;
  savedSetColumns?: string[];
}): { op: 'maxdiff_count' | 'maxdiff_mnl' | 'maxdiff_hb'; body: Record<string, unknown> } {
  const named = (role: ChoiceRole) =>
    Object.entries(input.roles).find(([, value]) => value === role)?.[0];
  const detectedSets = input.columns.filter(column => /^set_\d+$/i.test(column));
  const setColumns = input.savedSetColumns?.length ? input.savedSetColumns : detectedSets;
  const op =
    input.individual || input.savedOp === 'maxdiff_hb'
      ? 'maxdiff_hb'
      : input.savedOp === 'maxdiff_count'
        ? 'maxdiff_count'
        : setColumns.length && named('best')
          ? 'maxdiff_mnl'
          : 'maxdiff_count';
  const itemList = input.items
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
  const body: Record<string, unknown> = {
    best_column: named('best'),
    worst_column: named('worst'),
  };
  if (itemList.length) body.items = itemList;
  if (op === 'maxdiff_count') {
    if (input.segment) body.segment_column = input.segment;
  } else if (setColumns.length) {
    body.set_columns = setColumns;
  }
  if (op === 'maxdiff_hb') body.respondent_column = named('respondent') || 'respondent';
  const allowed: readonly string[] =
    op === 'maxdiff_count'
      ? MAXDIFF_COUNT_KEYS
      : op === 'maxdiff_mnl'
        ? MAXDIFF_MNL_KEYS
        : MAXDIFF_INDIVIDUAL_KEYS;
  for (const key of Object.keys(body)) {
    if (!allowed.includes(key)) delete body[key];
  }
  return { op, body };
}

export function conjointBodyFromRoles(
  roles: Record<string, ChoiceRole>,
  options: { priceAttribute?: string; segment?: string; layout: 'long' | 'wide' }
): Record<string, unknown> {
  const columnsFor = (role: ChoiceRole) =>
    Object.entries(roles)
      .filter(([, value]) => value === role)
      .map(([column]) => column);
  const attributes = columnsFor('attribute');
  if (options.layout === 'wide') {
    return {
      layout: 'wide',
      chosen_column: 'chosen',
      profile_id_column: 'task_key',
      attribute_columns: attributes,
      price_attribute: options.priceAttribute || undefined,
      segment_column: options.segment || undefined,
      wide_map: {
        respondent: columnsFor('respondent')[0],
        task: columnsFor('task')[0],
        chosen: columnsFor('chosen')[0],
        alternatives: [],
      },
    };
  }
  return {
    chosen_column: columnsFor('chosen')[0],
    profile_id_column: columnsFor('task')[0],
    attribute_columns: attributes,
    respondent_column: columnsFor('respondent')[0],
    price_attribute: options.priceAttribute || undefined,
    segment_column: options.segment || undefined,
  };
}
