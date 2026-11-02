export function formatStat(value: unknown, digits = 1): string {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return '';
  return number.toLocaleString('en-GB', {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

export function pPhrase(value: unknown): string {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return '';
  if (number < 0.001) return 'p < .001';
  return `p = ${number.toFixed(3).replace(/^0/, '')}`;
}

export type AnovaPair = {
  group1?: string;
  group2?: string;
  meandiff?: number;
  'p-adj'?: number;
  reject?: boolean;
};

export function pairText(row: AnovaPair): string {
  const diff = Number(row.meandiff);
  const higher = Number.isFinite(diff) && diff < 0 ? row.group2 : row.group1;
  const lower = Number.isFinite(diff) && diff < 0 ? row.group1 : row.group2;
  const amount = Number.isFinite(diff) ? `+${Math.abs(diff).toFixed(1)}` : '';
  const compared = higher && lower ? `${higher} > ${lower}` : '';
  return [compared, amount, pPhrase(row['p-adj'])].filter(Boolean).join(' · ');
}

export function anovaError(err: unknown): string {
  const raw = err instanceof Error ? err.message : 'ANOVA did not run';
  try {
    const body = JSON.parse(raw) as { detail?: unknown };
    if (typeof body.detail === 'string') return body.detail;
  } catch {
    return raw;
  }
  return raw;
}

export function countedPairs(rows: AnovaPair[] | undefined): {
  significant: AnovaPair[];
  other: number;
} {
  const significant = (rows || []).filter(row => row.reject === true);
  const other = (rows || []).filter(row => row.reject === false).length;
  return { significant, other };
}
