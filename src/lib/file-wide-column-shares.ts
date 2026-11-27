/** Whole-file category shares for Variable / Evidence / code-frame rails (Paper 4d). */

export type FileWideColumnPage = {
  counts?: Record<string, number>;
  value_labels?: Record<string, string>;
  missing?: number;
  n?: number;
  /** True when the client gave up and must not treat preview rows as the file base. */
  fallback?: boolean;
};

export type FileWideShareRows = { label: string; count: number }[];

/** A `/columns/.../values` body is usable when it carries whole-file `n` and a counts map. */
export function isFileWideColumnPage(
  page: FileWideColumnPage | null | undefined
): page is FileWideColumnPage & { n: number; counts: Record<string, number> } {
  if (!page || page.fallback) return false;
  if (page.counts == null || typeof page.counts !== 'object' || Array.isArray(page.counts)) {
    return false;
  }
  const n = Number(page.n);
  return Number.isFinite(n) && n >= 0;
}

/** Accept an API page even when every cell is missing (empty counts, positive n). */
export function shouldAcceptColumnValuesPage(page: {
  counts?: Record<string, number> | null;
  n?: number | null;
}): boolean {
  if (page.counts == null || typeof page.counts !== 'object' || Array.isArray(page.counts)) {
    return false;
  }
  const n = Number(page.n);
  return Number.isFinite(n) && n >= 0;
}

/** Caption next to code % — never "% of loaded rows" as a settled file base. */
export function variableShareCaption(
  page: FileWideColumnPage | null | undefined,
  settled: boolean
): string {
  if (isFileWideColumnPage(page)) {
    return `% of all ${Number(page.n).toLocaleString('en-GB')} rows`;
  }
  if (!settled) return '% of all rows';
  return '% of all rows';
}

export function fileWideBaseN(
  page: FileWideColumnPage | null | undefined,
  previewLength: number
): number {
  if (isFileWideColumnPage(page)) return Number(page.n) || 1;
  return previewLength || 1;
}

export function fileWideMissingCount(
  page: FileWideColumnPage | null | undefined,
  previewBlanks: number
): number {
  if (isFileWideColumnPage(page)) return Number(page.missing) || 0;
  return previewBlanks;
}

export function missingRowsCaption(missing: number, baseN: number): string {
  if (!missing) return 'None';
  const base = baseN || 1;
  return `${Math.round((missing / base) * 100)}% · ${missing.toLocaleString('en-GB')} rows`;
}

export function percentOfBase(count: number, baseN: number): number {
  const base = baseN || 1;
  return Math.round((count / base) * 100);
}

/** Merge code → label keys the way Variable / Evidence rails show them. */
export function rowsFromFileWideCounts(
  page: Pick<FileWideColumnPage, 'counts' | 'value_labels'> | null | undefined,
  limit = 8
): FileWideShareRows {
  if (!page?.counts) return [];
  const labels = page.value_labels || {};
  const merged = new Map<string, number>();
  for (const [code, count] of Object.entries(page.counts)) {
    const label = labels[code] || code;
    if (!label || label === '—') continue;
    merged.set(label, (merged.get(label) || 0) + Number(count || 0));
  }
  return [...merged.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
