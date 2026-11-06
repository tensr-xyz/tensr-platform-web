/** One rule for a count, a degree of freedom, a mean, or another statistic. */

export type StatKind = 'count' | 'df' | 'mean' | 'statistic';

export function formatStat(value: number, kind: StatKind, places: number): string {
  if (!Number.isFinite(value)) return '';
  const digits = Number.isFinite(places) ? Math.max(0, Math.trunc(places)) : 0;
  if ((kind === 'count' || kind === 'df') && Math.abs(value - Math.round(value)) < 1e-9) {
    return String(Math.round(value));
  }
  const shown = kind === 'mean' ? Math.max(digits, 1) : digits;
  return value.toFixed(shown);
}
