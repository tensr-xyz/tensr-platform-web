/** Find & replace across report text, table labels, and question labels (Paper 9e / TEN-151). */

export type FindReplaceScope = 'report_text' | 'table_labels' | 'variable_labels';

export type FindReplaceMatch = {
  scope: FindReplaceScope | string;
  path: string;
  before: string;
  after?: string;
  page_id?: string;
  page_index?: number;
  object_id?: string;
  column?: string;
};

export type FindReplaceResult = {
  ok?: boolean;
  dry_run?: boolean;
  find?: string;
  replace?: string;
  scopes?: FindReplaceScope[];
  n_matches?: number;
  matches?: FindReplaceMatch[];
  changed_document?: boolean;
  changed_variables?: boolean;
};

export const FIND_REPLACE_SCOPE_CHIPS: {
  scope: FindReplaceScope;
  label: string;
}[] = [
  { scope: 'report_text', label: 'Report text' },
  { scope: 'table_labels', label: 'Table labels' },
  { scope: 'variable_labels', label: 'Question & answer labels' },
];

export const DEFAULT_FIND_REPLACE_SCOPES: FindReplaceScope[] = ['report_text', 'table_labels'];

export function toggleFindReplaceScope(
  scopes: FindReplaceScope[],
  scope: FindReplaceScope
): FindReplaceScope[] {
  if (scopes.includes(scope)) {
    const next = scopes.filter(item => item !== scope);
    return next.length ? next : scopes;
  }
  return [...FIND_REPLACE_SCOPE_CHIPS.map(item => item.scope)].filter(
    item => scopes.includes(item) || item === scope
  );
}

export function findReplacePreviewBody(args: {
  find: string;
  replace: string;
  scopes: FindReplaceScope[];
  caseSensitive: boolean;
}): string {
  return JSON.stringify({
    find: args.find,
    replace: args.replace,
    dry_run: true,
    case_sensitive: args.caseSensitive,
    scopes: args.scopes,
  });
}

export function findReplaceApplyBody(args: {
  find: string;
  replace: string;
  scopes: FindReplaceScope[];
  caseSensitive: boolean;
  matchIndex?: number;
}): string {
  const body: Record<string, unknown> = {
    find: args.find,
    replace: args.replace,
    dry_run: false,
    case_sensitive: args.caseSensitive,
    scopes: args.scopes,
  };
  if (args.matchIndex != null) body.match_index = args.matchIndex;
  return JSON.stringify(body);
}

/** Ellipsis snippet around the first hit, for the matches list. */
export function findReplaceSnippet(before: string, find: string, max = 42): string {
  const text = String(before || '')
    .replace(/\s+/g, ' ')
    .trim();
  const needle = String(find || '');
  if (!text) return '""';
  if (!needle) {
    const clipped = text.length > max ? `${text.slice(0, max - 1)}…` : text;
    return `"${clipped}"`;
  }
  const lower = text.toLowerCase();
  const needleLower = needle.toLowerCase();
  let index = lower.indexOf(needleLower);
  if (index < 0) index = 0;
  const end = index + needle.length;
  const room = Math.max(8, max - needle.length);
  const leftPad = Math.min(index, Math.floor(room / 2));
  const start = Math.max(0, index - leftPad);
  const stop = Math.min(text.length, Math.max(end, start + max));
  const prefix = start > 0 ? '…' : '';
  const suffix = stop < text.length ? '…' : '';
  return `"${prefix}${text.slice(start, stop)}${suffix}"`;
}

export function findReplaceMatchWhere(match: FindReplaceMatch): string {
  const scope = String(match.scope || '');
  const path = String(match.path || '');
  if (scope === 'report_text') {
    const page =
      typeof match.page_index === 'number' && match.page_index > 0
        ? `Page ${match.page_index}`
        : 'Report';
    if (path === 'page.title') return `${page} title`;
    if (path === 'page.section') return `${page} section`;
    return page;
  }
  if (scope === 'table_labels') {
    if (path.startsWith('default_labels')) return 'Table totals';
    if (path.includes('merges')) return 'Table NET';
    return 'Table row';
  }
  if (path.startsWith('value_labels')) return 'Answer label';
  return 'Question label';
}

/** One line for the preview list: `Page 2 · "…Brand X leads…"`. */
export function formatFindReplaceMatchLine(match: FindReplaceMatch, find: string): string {
  return `${findReplaceMatchWhere(match)} · ${findReplaceSnippet(match.before, find)}`;
}

export function findReplaceMatchesLabel(n: number): string {
  const count = Math.max(0, Math.floor(n));
  return count === 1 ? '1 match' : `${count} matches`;
}

export function findReplaceAllLabel(n: number): string {
  const count = Math.max(0, Math.floor(n));
  return count > 0 ? `Replace all ${count}` : 'Replace all';
}

/** Preview rows: first two matches, then a “+ N more” overflow when needed. */
export function findReplaceVisibleRows(
  matches: FindReplaceMatch[] | undefined,
  find: string,
  limit = 2
): { key: string; line: string; overflow?: boolean }[] {
  const rows = matches || [];
  const shown = rows.slice(0, Math.max(0, limit)).map((match, index) => ({
    key: `${match.scope}:${match.path}:${match.page_id || ''}:${match.object_id || ''}:${match.column || ''}:${index}`,
    line: formatFindReplaceMatchLine(match, find),
  }));
  const rest = rows.length - shown.length;
  if (rest > 0) {
    shown.push({
      key: 'overflow',
      line: `+ ${rest} more`,
      overflow: true,
    } as { key: string; line: string; overflow?: boolean });
  }
  return shown;
}
