/**
 * Axis helpers for ReportChart: nice ticks, number/date formatting,
 * and size-aware category label plans.
 */

export type ChartDensity = 'inline' | 'comfortable';

export type DateResolution = 'year' | 'month' | 'day' | 'hour' | 'minute';

export type ChartLayout = {
  width: number;
  height: number;
  padL: number;
  padR: number;
  padT: number;
  padB: number;
  plotW: number;
  plotH: number;
  fontSize: number;
  titleSize: number;
  maxTicksX: number;
  maxTicksY: number;
  density: ChartDensity;
};

export type CategoryLabelPlan = {
  rotate: boolean;
  maxChars: number;
  showEvery: number;
  padB: number;
};

function niceNum(range: number, round: boolean): number {
  if (!Number.isFinite(range) || range <= 0) return 1;
  const exp = Math.floor(Math.log10(range));
  const frac = range / 10 ** exp;
  let nice: number;
  if (round) {
    if (frac < 1.5) nice = 1;
    else if (frac < 3) nice = 2;
    else if (frac < 7) nice = 5;
    else nice = 10;
  } else if (frac <= 1) nice = 1;
  else if (frac <= 2) nice = 2;
  else if (frac <= 5) nice = 5;
  else nice = 10;
  return nice * 10 ** exp;
}

/** Generate readable tick values between min and max (inclusive of nice bounds). */
export function niceTicks(min: number, max: number, maxTicks = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0];
  if (min === max) {
    const pad = Math.abs(min) * 0.1 || 1;
    return niceTicks(min - pad, max + pad, maxTicks);
  }
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  const maxCount = Math.max(2, Math.floor(maxTicks));

  let step = niceNum((hi - lo) / (maxCount - 1), true);
  let niceMin = Math.floor(lo / step) * step;
  let niceMax = Math.ceil(hi / step) * step;
  let steps = Math.round((niceMax - niceMin) / step);

  // If nice bounds inflate the count, coarsen the step until it fits.
  while (steps + 1 > maxCount + 1) {
    step = niceNum(step * 1.5, true);
    niceMin = Math.floor(lo / step) * step;
    niceMax = Math.ceil(hi / step) * step;
    steps = Math.round((niceMax - niceMin) / step);
    if (step > hi - lo && steps <= 2) break;
  }

  const ticks: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const v = niceMin + i * step;
    ticks.push(Number(v.toPrecision(12)));
  }
  return ticks.length ? ticks : [lo, hi];
}

/** Format a numeric tick based on the data range / integer-ness. */
export function formatNumberTick(value: number, sampleValues: number[]): string {
  if (!Number.isFinite(value)) return '';
  const samples = sampleValues.filter(Number.isFinite);
  const allNearInt =
    samples.length > 0 &&
    samples.every(v => Math.abs(v - Math.round(v)) < 1e-8) &&
    Math.abs(value - Math.round(value)) < 1e-8;

  if (allNearInt) {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(value));
  }

  const lo = samples.length ? Math.min(...samples) : value;
  const hi = samples.length ? Math.max(...samples) : value;
  const range = Math.abs(hi - lo);
  let maxFrac = 2;
  if (range >= 1000) maxFrac = 0;
  else if (range >= 10) maxFrac = 1;
  else if (range >= 1) maxFrac = 2;
  else if (range >= 0.01) maxFrac = 3;
  else maxFrac = 4;

  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: maxFrac,
    minimumFractionDigits: 0,
  }).format(value);
}

export function truncateLabel(label: string, maxChars: number): string {
  const s = String(label ?? '');
  if (maxChars <= 0) return '';
  if (s.length <= maxChars) return s;
  if (maxChars === 1) return '…';
  return `${s.slice(0, maxChars - 1)}…`;
}

/** Max characters that fit in `pxWidth` at `fontSize` (approx sans metrics). */
export function maxCharsForWidth(pxWidth: number, fontSize: number): number {
  const avgChar = fontSize * 0.58;
  return Math.max(2, Math.floor(pxWidth / avgChar));
}

export function computeLayout(density: ChartDensity, measuredWidth: number): ChartLayout {
  const fallback = density === 'inline' ? 420 : 880;
  const width = Math.round(
    Math.max(
      density === 'inline' ? 300 : 560,
      Math.min(measuredWidth > 0 ? measuredWidth : fallback, density === 'inline' ? 640 : 1200)
    )
  );
  const height = Math.round(
    density === 'inline' ? Math.max(200, width * 0.5) : Math.max(360, width * 0.48)
  );
  const padL = density === 'inline' ? 48 : 64;
  const padR = density === 'inline' ? 16 : 24;
  const padT = density === 'inline' ? 22 : 30;
  const padB = density === 'inline' ? 44 : 56;
  return {
    width,
    height,
    padL,
    padR,
    padT,
    padB,
    plotW: width - padL - padR,
    plotH: height - padT - padB,
    fontSize: density === 'inline' ? 9 : 12,
    titleSize: density === 'inline' ? 11 : 14,
    maxTicksX: density === 'inline' ? 5 : 9,
    maxTicksY: density === 'inline' ? 4 : 7,
    density,
  };
}

export function planCategoryLabels(
  labels: string[],
  slotWidth: number,
  fontSize: number,
  density: ChartDensity,
  basePadB: number
): CategoryLabelPlan {
  if (!labels.length) {
    return { rotate: false, maxChars: 12, showEvery: 1, padB: basePadB };
  }
  const longest = Math.max(...labels.map(l => String(l).length));
  const flatChars = maxCharsForWidth(Math.max(8, slotWidth * 0.92), fontSize);

  if (longest <= flatChars) {
    return { rotate: false, maxChars: flatChars, showEvery: 1, padB: basePadB };
  }

  // 45° rotation frees diagonal space ≈ slotWidth * √2
  const rotChars = maxCharsForWidth(Math.max(12, slotWidth * 1.45), fontSize);
  const rotatePad = Math.max(
    basePadB,
    Math.round(fontSize * 0.55 * Math.min(rotChars, longest) * 0.75 + 18)
  );

  if (density === 'comfortable' || longest <= rotChars + 2) {
    return {
      rotate: true,
      maxChars: Math.max(rotChars, density === 'comfortable' ? 24 : 12),
      showEvery: 1,
      padB: rotatePad,
    };
  }

  // Dense inline: rotate + skip labels
  const targetSlots = density === 'inline' ? 6 : 14;
  const showEvery = Math.max(1, Math.ceil(labels.length / targetSlots));
  return {
    rotate: true,
    maxChars: rotChars,
    showEvery,
    padB: rotatePad,
  };
}

/** Parse string/number into Date when it looks like a datetime. */
export function parseAxisDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Epoch ms vs seconds heuristic
    if (value > 1e11) {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    if (value > 1e9 && value < 1e11) {
      const d = new Date(value * 1000);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
  }
  if (typeof value !== 'string') return null;
  const s = value.trim();
  if (!s) return null;
  // Avoid treating plain integers / codes as dates
  if (/^\d{1,4}$/.test(s)) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  // Require a date-like token so "Team A" never parses
  if (!/\d{4}|\d{1,2}[/.-]\d{1,2}/.test(s) && !/[T\s]\d{1,2}:\d{2}/.test(s)) {
    return null;
  }
  return d;
}

export function valuesLookLikeDatetime(values: unknown[]): boolean {
  if (values.length < 2) {
    const only = values[0];
    return parseAxisDate(only) != null && typeof only !== 'number';
  }
  let hits = 0;
  for (const v of values) {
    if (parseAxisDate(v) != null) hits += 1;
  }
  return hits / values.length >= 0.8;
}

export function inferDateResolution(dates: Date[]): DateResolution {
  if (dates.length === 0) return 'day';
  if (dates.length === 1) {
    const d = dates[0];
    if (d.getUTCHours() || d.getUTCMinutes() || d.getUTCSeconds()) return 'minute';
    return 'day';
  }
  const times = dates.map(d => d.getTime()).sort((a, b) => a - b);
  const span = times[times.length - 1]! - times[0]!;
  const day = 86_400_000;
  if (span >= day * 400) return 'year';
  if (span >= day * 45) return 'month';
  if (span >= day * 1.5) return 'day';
  if (span >= 3_600_000 * 2) return 'hour';
  return 'minute';
}

export function formatDateTick(date: Date, resolution: DateResolution): string {
  const opts: Intl.DateTimeFormatOptions =
    resolution === 'year'
      ? { year: 'numeric', timeZone: 'UTC' }
      : resolution === 'month'
        ? { month: 'short', year: 'numeric', timeZone: 'UTC' }
        : resolution === 'day'
          ? { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }
          : resolution === 'hour'
            ? {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'UTC',
                hour12: false,
              }
            : { hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false };
  return new Intl.DateTimeFormat('en-GB', opts).format(date);
}

export function scaleLinear(
  d0: number,
  d1: number,
  r0: number,
  r1: number,
  clamp = true
): (v: number) => number {
  if (d1 === d0) {
    return () => (r0 + r1) / 2;
  }
  return (v: number) => {
    let t = (v - d0) / (d1 - d0);
    if (clamp) t = Math.max(0, Math.min(1, t));
    return r0 + t * (r1 - r0);
  };
}

export function withExtraPadB(layout: ChartLayout, padB: number): ChartLayout {
  const next = { ...layout, padB, plotH: layout.height - layout.padT - padB };
  return next;
}
