/** Banner picks on the Tables screen: a question, or a saved audience as a column. */

import { formatProjectedK } from '@/lib/flow-survey';

export type TableBannerRef =
  | { kind: 'column'; column: string }
  | {
      kind: 'audience';
      name: string;
      label: string;
      filter?: { combine?: string; filters?: unknown[] };
    };

export function tableBannerKey(ref: TableBannerRef): string {
  return ref.kind === 'audience' ? `audience:${ref.name}` : `column:${ref.column}`;
}

/** Paper 5d size chip: "1,566k · n 1,211". */
export function audienceBannerSizeLabel(audience: {
  n?: number | null;
  projected_people?: number | null;
}): string {
  const parts: string[] = [];
  const people = audience.projected_people;
  if (typeof people === 'number' && Number.isFinite(people) && people > 0) {
    parts.push(formatProjectedK(people / 1000));
  }
  const n = audience.n;
  if (typeof n === 'number' && Number.isFinite(n)) {
    parts.push(`n ${Math.round(n).toLocaleString('en-GB')}`);
  }
  return parts.join(' · ');
}

export function tableBannerKeys(refs: TableBannerRef[]): string[] {
  return refs.map(tableBannerKey);
}

/** Restore banner chips from a saved table spec (columns and audience filters). */
export function bannerRefsFromSpec(
  spec:
    | {
        banners?: Array<{
          column?: string;
          columns?: string[];
          filter?: { combine?: string; filters?: unknown[] } | null;
          audience?: string;
          label?: string;
        }>;
      }
    | undefined
): TableBannerRef[] {
  const refs: TableBannerRef[] = [];
  const seen = new Set<string>();
  const push = (ref: TableBannerRef) => {
    const key = tableBannerKey(ref);
    if (seen.has(key)) return;
    seen.add(key);
    refs.push(ref);
  };
  for (const banner of spec?.banners || []) {
    const audience = String(banner.audience || '').trim();
    const label = String(banner.label || '').trim();
    const filter = banner.filter && typeof banner.filter === 'object' ? banner.filter : undefined;
    if (audience) {
      push({
        kind: 'audience',
        name: audience,
        label: label || audience,
        ...(filter ? { filter } : {}),
      });
      continue;
    }
    if (filter && !banner.column && !(banner.columns || []).length) {
      const name = label || 'Audience';
      push({ kind: 'audience', name, label: name, filter });
      continue;
    }
    if (banner.column) push({ kind: 'column', column: String(banner.column) });
    for (const column of banner.columns || []) {
      const name = String(column || '').trim();
      if (name) push({ kind: 'column', column: name });
    }
  }
  return refs;
}

/** Request body banner entries for /tables. */
export function bannerRequestItems(refs: TableBannerRef[]): Record<string, unknown>[] {
  return refs.map(ref => {
    if (ref.kind === 'column') return { column: ref.column };
    const entry: Record<string, unknown> = { label: ref.label };
    if (ref.name) entry.audience = ref.name;
    if (ref.filter) entry.filter = ref.filter;
    return entry;
  });
}

export function columnNamesFromBannerRefs(refs: TableBannerRef[]): string[] {
  return refs
    .filter((ref): ref is Extract<TableBannerRef, { kind: 'column' }> => ref.kind === 'column')
    .map(ref => ref.column);
}

export function bannerRefLabel(ref: TableBannerRef, labelFor: (column: string) => string): string {
  return ref.kind === 'audience' ? ref.label : labelFor(ref.column);
}
