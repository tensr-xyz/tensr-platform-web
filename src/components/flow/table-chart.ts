export type Fit = { slope: number; intercept: number; r: number };

export function linearFit(points: { x: number; y: number; weight?: number }[]): Fit | null {
  const rows = points.filter(point => Number.isFinite(point.x) && Number.isFinite(point.y));
  if (rows.length < 2) return null;
  let weightSum = 0;
  let xSum = 0;
  let ySum = 0;
  let xxSum = 0;
  let yySum = 0;
  let xySum = 0;
  for (const row of rows) {
    const weight = row.weight && row.weight > 0 ? row.weight : 1;
    weightSum += weight;
    xSum += weight * row.x;
    ySum += weight * row.y;
    xxSum += weight * row.x * row.x;
    yySum += weight * row.y * row.y;
    xySum += weight * row.x * row.y;
  }
  const denom = weightSum * xxSum - xSum * xSum;
  if (!weightSum || !denom) return null;
  const slope = (weightSum * xySum - xSum * ySum) / denom;
  const intercept = (ySum - slope * xSum) / weightSum;
  const xVar = weightSum * xxSum - xSum * xSum;
  const yVar = weightSum * yySum - ySum * ySum;
  const r = xVar > 0 && yVar > 0 ? (weightSum * xySum - xSum * ySum) / Math.sqrt(xVar * yVar) : 0;
  return { slope, intercept, r };
}

export function fitLabel(fit: Fit): string {
  const sign = fit.intercept < 0 ? '−' : '+';
  return `y = ${fit.slope.toFixed(2)}x ${sign} ${Math.abs(fit.intercept).toFixed(2)}, r = ${fit.r.toFixed(2)}`;
}
