/** Format wave-to-wave movers for the refresh screen (labels only). */

export type WaveMover = {
  label: string;
  from_percent: number;
  to_percent: number;
  change: number;
  significant?: boolean | null;
  slide?: number | null;
};

export function formatMoverChange(change: number): string {
  const pts = Math.abs(change).toFixed(1);
  if (change > 0) return `+${pts} pts ▲`;
  if (change < 0) return `−${pts} pts ▼`;
  return `${pts} pts`;
}

export function formatMoverDetail(mover: WaveMover): string {
  const from = `${mover.from_percent.toFixed(1)}%`;
  const to = `${mover.to_percent.toFixed(1)}%`;
  let line = `${from} → ${to}`;
  if (mover.significant === true) line += ' · significant at 95%';
  else if (mover.significant === false) line += ' · not significant';
  if (typeof mover.slide === 'number' && mover.slide > 0) line += ` · slide ${mover.slide}`;
  return line;
}

/** Rank percent rows by absolute change. Optional n enables a pooled z-test at 95%.
 * Last-wins on both sides so a flat multi-table list cannot pair different bases.
 */
export function rankWaveMovers(
  previous: { label: string; percent: number; n?: number }[],
  current: { label: string; percent: number; n?: number }[]
): WaveMover[] {
  const before = new Map(
    previous.filter(row => row.label.trim()).map(row => [row.label.trim(), row] as const)
  );
  const after = new Map(
    current.filter(row => row.label.trim()).map(row => [row.label.trim(), row] as const)
  );
  const movers: WaveMover[] = [];
  for (const [label, prior] of before) {
    const row = after.get(label);
    if (!row) continue;
    const change = row.percent - prior.percent;
    if (Math.abs(change) < 0.05) continue;
    const item: WaveMover = {
      label,
      from_percent: prior.percent,
      to_percent: row.percent,
      change,
      significant: null,
    };
    if (typeof prior.n === 'number' && prior.n >= 2 && typeof row.n === 'number' && row.n >= 2) {
      item.significant = twoPropSignificant(prior.percent, prior.n, row.percent, row.n);
    }
    movers.push(item);
  }
  movers.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  return movers;
}

function twoPropSignificant(
  fromPercent: number,
  fromN: number,
  toPercent: number,
  toN: number
): boolean | null {
  const p1 = Math.min(1, Math.max(0, fromPercent / 100));
  const p2 = Math.min(1, Math.max(0, toPercent / 100));
  const pooled = (p1 * fromN + p2 * toN) / (fromN + toN);
  if (pooled <= 0 || pooled >= 1) return Math.abs(p1 - p2) > 1e-12;
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / fromN + 1 / toN));
  if (!(se > 0)) return null;
  return Math.abs(p1 - p2) / se >= 1.959963984540054;
}
