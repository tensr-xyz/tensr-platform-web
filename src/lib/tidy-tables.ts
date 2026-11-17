/** Tidy tables (Paper 9b): prune dull, small-base, or broken saved tables. */

export type TidyMode = 'park' | 'hide' | 'delete';

export type TidyReason = 'not_significant' | 'small_base' | 'broken';

export type TidyCriteria = {
  mode: TidyMode;
  alpha: number;
  minBase: number;
  deleteIfBroken: boolean;
  deleteIfNotSignificant: boolean;
};

export type TidyReasonRow = {
  reason: TidyReason;
  count: number;
  label: string;
};

export type TidyDecision = {
  id?: string;
  label?: string;
  reason?: string;
  action?: string;
  detail?: string;
};

export type TidyScanResult = {
  ok?: boolean;
  dry_run?: boolean;
  n_tables?: number;
  n_pruned?: number;
  reason_counts?: Partial<Record<TidyReason | 'keep', number>>;
  reason_rows?: TidyReasonRow[];
  confirm_label?: string;
  decisions?: TidyDecision[];
  criteria?: Record<string, unknown>;
};

/** Paper 9b defaults: 95%, base under 50, include broken. */
export const DEFAULT_TIDY_CRITERIA: TidyCriteria = {
  mode: 'park',
  alpha: 0.05,
  minBase: 50,
  deleteIfBroken: true,
  deleteIfNotSignificant: true,
};

export function confidenceFromAlpha(alpha: number): number {
  const pct = Math.round((1 - alpha) * 1000) / 10;
  if (pct >= 99.9) return 99.9;
  if (pct >= 99) return 99;
  if (pct >= 95) return 95;
  if (pct >= 90) return 90;
  return pct;
}

export function reasonRowLabel(
  reason: TidyReason,
  criteria: TidyCriteria = DEFAULT_TIDY_CRITERIA
): string {
  if (reason === 'not_significant') {
    const pct = confidenceFromAlpha(criteria.alpha);
    const label = Number.isInteger(pct) ? `${pct}` : String(pct);
    return `No significant differences at ${label}%`;
  }
  if (reason === 'small_base') {
    return `Every column base under ${criteria.minBase}`;
  }
  return 'Broken (a source question was removed)';
}

export function tidyModeLabel(mode: TidyMode, n: number): string {
  const count = Math.max(0, Math.floor(n));
  const noun = count === 1 ? 'table' : 'tables';
  if (mode === 'delete') return `Delete ${count} ${noun}`;
  if (mode === 'hide') return `Hide ${count} ${noun}`;
  return `Park ${count} ${noun}`;
}

export function tidyCriteriaBody(criteria: TidyCriteria): Record<string, unknown> {
  return {
    mode: criteria.mode,
    alpha: criteria.alpha,
    min_base: criteria.minBase,
    delete_if_broken: criteria.deleteIfBroken,
    delete_if_not_significant: criteria.deleteIfNotSignificant,
  };
}

export function tidyScanBody(criteria: TidyCriteria, dryRun: boolean): string {
  return JSON.stringify({
    scan_saved: true,
    dry_run: dryRun,
    apply_to_report: true,
    criteria: tidyCriteriaBody(criteria),
  });
}

/** Prefer API reason_rows; fall back to counts + local labels. */
export function tidyReasonRows(
  result: TidyScanResult | null | undefined,
  criteria: TidyCriteria = DEFAULT_TIDY_CRITERIA
): TidyReasonRow[] {
  const fromApi = (result?.reason_rows || []).filter(
    (row): row is TidyReasonRow =>
      Boolean(row) &&
      (row.reason === 'not_significant' || row.reason === 'small_base' || row.reason === 'broken')
  );
  if (fromApi.length) {
    return (['not_significant', 'small_base', 'broken'] as const).map(reason => {
      const hit = fromApi.find(row => row.reason === reason);
      return {
        reason,
        count: hit?.count ?? result?.reason_counts?.[reason] ?? 0,
        label: hit?.label || reasonRowLabel(reason, criteria),
      };
    });
  }
  return (['not_significant', 'small_base', 'broken'] as const).map(reason => ({
    reason,
    count: result?.reason_counts?.[reason] ?? 0,
    label: reasonRowLabel(reason, criteria),
  }));
}

export function tidyConfirmLabel(
  result: TidyScanResult | null | undefined,
  mode: TidyMode
): string {
  if (result?.confirm_label && result.criteria && String(result.criteria.mode || '') === mode) {
    return result.confirm_label;
  }
  return tidyModeLabel(mode, result?.n_pruned ?? 0);
}
