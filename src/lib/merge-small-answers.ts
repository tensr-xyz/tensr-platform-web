/** Merge small answers (Paper 9d / TEN-161 D084–D089). Labels only in UI copy. */

export const MERGE_SMALL_MAX_PCTS = [0.5, 1, 2, 3, 4, 5] as const;

export type MergeSmallMaxPct = (typeof MERGE_SMALL_MAX_PCTS)[number];

export type MergeSmallCategoryRow = {
  value: string;
  label: string;
  n: number;
  pct: number;
  action: 'stay' | 'merge';
};

export type MergeSmallPreview = {
  column: string;
  max_pct: number;
  combined_label: string;
  combined_value?: string;
  base_n: number;
  categories?: MergeSmallCategoryRow[];
  small_categories: Array<{
    value: string;
    label: string;
    n: number;
    pct: number;
  }>;
  mappings: Array<{
    from: string[];
    to: string;
    to_label?: string;
    reason?: string;
  }>;
  summary?: string;
};

export const DEFAULT_MERGE_SMALL_MAX_PCT: MergeSmallMaxPct = 3;

export function mergeSmallThresholdOptions(): { value: string; label: string }[] {
  return MERGE_SMALL_MAX_PCTS.map(value => ({
    value: String(value),
    label: Number.isInteger(value) ? `${value}%` : `${value}%`,
  }));
}

export function formatMergeSmallPct(pct: number): string {
  const rounded = Math.round(pct * 10) / 10;
  if (Number.isInteger(rounded)) return `${rounded}%`;
  return `${rounded.toFixed(1)}%`;
}

export function mergeSmallRowDetail(
  row: Pick<MergeSmallCategoryRow, 'pct' | 'action'>,
  combinedLabel: string
): string {
  const pct = formatMergeSmallPct(row.pct);
  if (row.action === 'merge') return `${pct} → ${combinedLabel || 'Other'}`;
  return `${pct} · stays`;
}

export function mergeSmallConfirmLabel(n: number): string {
  const count = Math.max(0, Math.floor(n));
  return count === 1 ? 'Merge 1 answer' : `Merge ${count} answers`;
}

/** Prefer API `categories`; fall back to small rows marked merge-only. */
export function mergeSmallPreviewRows(
  preview: MergeSmallPreview | null | undefined
): MergeSmallCategoryRow[] {
  if (!preview) return [];
  if (Array.isArray(preview.categories) && preview.categories.length) {
    return preview.categories.map(row => ({
      value: String(row.value ?? ''),
      label: String(row.label || row.value || 'Answer'),
      n: Number(row.n) || 0,
      pct: Number(row.pct) || 0,
      action: row.action === 'merge' ? 'merge' : 'stay',
    }));
  }
  return (preview.small_categories || []).map(row => ({
    value: String(row.value ?? ''),
    label: String(row.label || row.value || 'Answer'),
    n: Number(row.n) || 0,
    pct: Number(row.pct) || 0,
    action: 'merge' as const,
  }));
}

export function parseMergeSmallMaxPct(raw: string): MergeSmallMaxPct {
  const value = Number(raw);
  for (const allowed of MERGE_SMALL_MAX_PCTS) {
    if (Math.abs(value - allowed) < 1e-9) return allowed;
  }
  return DEFAULT_MERGE_SMALL_MAX_PCT;
}
