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

export function readableAnovaError(detail: string): string {
  const limited = detail.match(
    /^Need at least two groups with at least (\d+) observations each \(excluded: (.+)\)$/
  );
  if (limited) {
    const minimum = limited[1];
    const groups = [...limited[2].matchAll(/([^,]+?) \(n=(\d+)\)/g)].map(match => ({
      name: match[1].trim(),
      n: match[2],
    }));
    if (groups.length) {
      const names = groups.map(group => group.name);
      const counts = [...new Set(groups.map(group => group.n))];
      const joined =
        names.length <= 1
          ? names[0] || ''
          : names.length === 2
            ? `${names[0]} and ${names[1]}`
            : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
      if (counts.length === 1) {
        const verb = names.length === 1 ? 'has' : 'have';
        return `Each group needs at least ${minimum} responses; ${joined} ${verb} only ${counts[0]}`;
      }
      return `Each group needs at least ${minimum} responses; ${groups
        .map(group => `${group.name} has ${group.n}`)
        .join(', ')}`;
    }
  }
  if (detail === 'Need at least two groups') return 'Choose a factor with at least two groups.';
  return detail;
}

export function anovaError(err: unknown): string {
  const raw = err instanceof Error ? err.message : 'ANOVA did not run';
  try {
    const body = JSON.parse(raw) as { detail?: unknown };
    if (typeof body.detail === 'string') return readableAnovaError(body.detail);
  } catch {
    return readableAnovaError(raw);
  }
  return readableAnovaError(raw);
}

export function countedPairs(rows: AnovaPair[] | undefined): {
  significant: AnovaPair[];
  other: number;
} {
  const significant = (rows || []).filter(row => row.reject === true);
  const other = (rows || []).filter(row => row.reject === false).length;
  return { significant, other };
}
