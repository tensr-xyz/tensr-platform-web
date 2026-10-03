import type { AnalysisReportChart } from '@/lib/analysis-report-types';
import { isChartIntent, shouldRouteToInlineChart } from '@/lib/chart-intent';
import { findColumnByLabel, type ColumnLike } from '@/lib/column-utils';
import { parseNumericCellValue } from '@/lib/column-heatmap';
import { tensrApiUrl } from '@/lib/tensr-api-url';
import { getIdToken } from '@/utils/auth';
import {
  applyClientColumnFilters,
  filterRowsByRowUids,
  type TabColumnFilter,
} from '@/utils/column-filters';

const CHART_BLOCK_RE = /```chart\s*\n([\s\S]*?)```/gi;

export function stripChartBlocks(content: string): {
  text: string;
  charts: AnalysisReportChart[];
} {
  const charts: AnalysisReportChart[] = [];
  const text = content
    .replace(CHART_BLOCK_RE, (_, json: string) => {
      try {
        charts.push(JSON.parse(json.trim()) as AnalysisReportChart);
      } catch {
        /* ignore malformed blocks */
      }
      return '';
    })
    .trim();
  return { text, charts };
}

export { isChartIntent, shouldRouteToInlineChart } from '@/lib/chart-intent';

function tokenizeColumnHints(message: string): string[] {
  const hints: string[] = [];
  const quoted = message.matchAll(/["']([^"']+)["']/g);
  for (const m of quoted) hints.push(m[1]);
  const between = message.match(/\bbetween\s+([a-z0-9_ ]+?)\s+and\s+([a-z0-9_ ]+)/i);
  if (between) {
    hints.push(between[1].trim(), between[2].trim());
  }
  const by = message.match(/\bby\s+([a-z0-9_ ]+)/i);
  if (by) hints.push(by[1].trim());
  return hints;
}

function numericColumns(columns: ColumnLike[], rows: Record<string, unknown>[]): ColumnLike[] {
  return columns.filter(col => {
    for (const row of rows.slice(0, 50)) {
      if (parseNumericCellValue(row[col.id]) !== null) return true;
    }
    return false;
  });
}

function categoricalColumns(columns: ColumnLike[], rows: Record<string, unknown>[]): ColumnLike[] {
  return columns.filter(col => {
    const seen = new Set<string>();
    for (const row of rows.slice(0, 80)) {
      const v = row[col.id];
      if (v === null || v === undefined || v === '') continue;
      seen.add(String(v));
      if (seen.size > 12) return false;
    }
    return seen.size >= 2;
  });
}

/**
 * Best-effort client chart from the active sheet when the assistant reply has no chart payload.
 */
function observationWeight(
  row: Record<string, unknown>,
  weightColumn: string | null | undefined
): number | null {
  if (!weightColumn) return 1;
  const weight = parseNumericCellValue(row[weightColumn]);
  if (weight === null || weight <= 0) return null;
  return weight;
}

export type PaletteChartKind =
  | 'bar'
  | 'line'
  | 'scatter'
  | 'histogram'
  | 'boxplot'
  | 'pie'
  | 'area'
  | 'violin'
  | 'density';

export type ErrorBarKind = 'none' | 'se' | 'ci';

/** Palette entries that have a real chart kind. Heatmap stays off until one exists. */
export const PALETTE_MENU_TO_KIND: Record<string, PaletteChartKind> = {
  'Bar Chart': 'bar',
  'Line Chart': 'line',
  'Scatter Chart': 'scatter',
  Histogram: 'histogram',
  Boxplot: 'boxplot',
  'Pie Chart': 'pie',
  'Area Chart': 'area',
  'Violin Plot': 'violin',
  'Density Plot': 'density',
};

const PALETTE_KIND_WORDS: Record<string, PaletteChartKind> = {
  bar: 'bar',
  line: 'line',
  pie: 'pie',
  area: 'area',
  scatter: 'scatter',
  histogram: 'histogram',
  boxplot: 'boxplot',
};

function leadingPaletteKind(message: string): PaletteChartKind | null {
  const match = message.trim().match(/^(bar|line|pie|area|scatter|histogram|boxplot)\b/i);
  if (!match?.[1]) return null;
  return PALETTE_KIND_WORDS[match[1].toLowerCase()] ?? null;
}

function headerFor(columns: ColumnLike[], id: string): string {
  return columns.find(column => column.id === id)?.header || id || 'Column';
}

function axesFromMessage(message: string, columns: ColumnLike[]): { xId: string; yId: string } {
  const match = message.match(/\bof\s+(.+?)\s+by\s+(.+?)\s*$/i);
  if (match?.[1] && match[2]) {
    const yHint = match[1].trim();
    const xHint = match[2].trim();
    const y = findColumnByLabel(columns, yHint) ?? columns.find(column => column.id === yHint);
    const x = findColumnByLabel(columns, xHint) ?? columns.find(column => column.id === xHint);
    if (x && y) return { xId: x.id, yId: y.id };
  }
  return {
    xId: columns[0]?.id ?? '',
    yId: columns[1]?.id ?? columns[0]?.id ?? '',
  };
}

function columnIsNumeric(rows: Record<string, unknown>[], id: string): boolean {
  return rows.slice(0, 50).some(row => parseNumericCellValue(row[id]) !== null);
}

function categorySeries(
  rows: Record<string, unknown>[],
  xId: string,
  yId: string,
  weightColumn: string | null | undefined,
  mode: 'mean' | 'sum',
  cap: number,
  errorBars: ErrorBarKind = 'none'
): {
  categories: string[];
  values: number[];
  errors?: number[];
  errorKind?: 'se' | 'ci';
  weighted: boolean;
  totalGroups: number;
} {
  const numericY = columnIsNumeric(rows, yId);
  const order: string[] = [];
  const groups = new Map<
    string,
    { sum: number; weight: number; sumSq: number; sumW2: number; count: number }
  >();
  let weighted = false;
  for (const row of rows) {
    const label = String(row[xId] ?? '').trim();
    if (!label) continue;
    const weight = observationWeight(row, weightColumn);
    if (weight === null) continue;
    if (weightColumn) weighted = true;
    const y = parseNumericCellValue(row[yId]);
    let group = groups.get(label);
    if (!group) {
      group = { sum: 0, weight: 0, sumSq: 0, sumW2: 0, count: 0 };
      groups.set(label, group);
      order.push(label);
    }
    if (numericY && y !== null) {
      group.sum += y * weight;
      group.sumSq += weight * y * y;
      group.sumW2 += weight * weight;
      group.weight += weight;
      group.count += 1;
    } else if (!numericY) {
      group.sum += weight;
      group.weight += weight;
      group.count += 1;
    }
  }
  const shown = order.slice(0, cap);
  const values = shown.map(label => {
    const group = groups.get(label);
    if (!group || group.weight === 0) return 0;
    return mode === 'mean' && numericY ? group.sum / group.weight : group.sum;
  });
  const errors =
    errorBars === 'none' || !numericY
      ? undefined
      : shown.map(label => {
          const group = groups.get(label);
          if (!group || group.count < 2 || group.weight <= 0) return 0;
          const mean = group.sum / group.weight;
          const variance = Math.max(0, group.sumSq / group.weight - mean * mean);
          const neff = group.sumW2 > 0 ? (group.weight * group.weight) / group.sumW2 : group.count;
          const se = Math.sqrt(variance / Math.max(neff, 1));
          return errorBars === 'ci' ? 1.96 * se : se;
        });
  return {
    categories: shown,
    values,
    errors,
    errorKind: errors && errorBars !== 'none' ? errorBars : undefined,
    weighted,
    totalGroups: order.length,
  };
}

function quantile(sorted: number[], p: number): number {
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (idx - lo);
}

function densityCurve(values: number[]): { x: number; y: number }[] {
  if (values.length < 2) return [];
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, values.length - 1);
  const sd = Math.sqrt(variance) || 1;
  const bandwidth = 1.06 * sd * values.length ** -0.2 || 1;
  const min = Math.min(...values) - 2 * bandwidth;
  const max = Math.max(...values) + 2 * bandwidth;
  const steps = 40;
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const x = min + ((max - min) * i) / steps;
    let density = 0;
    for (const value of values) {
      const z = (x - value) / bandwidth;
      density += Math.exp(-0.5 * z * z);
    }
    density /= values.length * bandwidth * Math.sqrt(2 * Math.PI);
    points.push({ x, y: density });
  }
  return points;
}

function buildExplicitPaletteChart(
  kind: PaletteChartKind,
  columns: ColumnLike[],
  rows: Record<string, unknown>[],
  xId: string,
  yId: string,
  weightColumn?: string | null,
  errorBars: ErrorBarKind = 'none'
): AnalysisReportChart {
  const xLabel = headerFor(columns, xId);
  const yLabel = headerFor(columns, yId);
  const weighted = Boolean(weightColumn);

  if (kind === 'scatter') {
    const points: { x: number; y: number }[] = [];
    let numericPairs = 0;
    for (const row of rows) {
      const x = parseNumericCellValue(row[xId]);
      const y = parseNumericCellValue(row[yId]);
      if (x === null || y === null) continue;
      numericPairs += 1;
      if (points.length < 5000) points.push({ x, y });
    }
    const base = `${yLabel} vs ${xLabel}`;
    const title =
      numericPairs > points.length
        ? `${weighted ? 'Unweighted scatter of ' : ''}${base} (5,000 of ${numericPairs.toLocaleString()} points)`
        : weighted
          ? `Unweighted scatter of ${base}`
          : points.length
            ? base
            : `No rows for ${base}`;
    return {
      kind: 'scatter',
      title,
      x_label: xLabel,
      y_label: yLabel,
      points,
      weighting: weighted ? 'unweighted' : 'none',
    };
  }

  if (kind === 'histogram') {
    const values: number[] = [];
    for (const row of rows) {
      const n = parseNumericCellValue(row[yId] ?? row[xId]);
      const weight = observationWeight(row, weightColumn);
      if (n === null || weight === null) continue;
      values.push(n);
    }
    const label = columnIsNumeric(rows, yId) ? yLabel : xLabel;
    if (values.length < 2) {
      return {
        kind: 'histogram',
        title: values.length ? `Distribution of ${label}` : `No rows for ${label}`,
        x_label: label,
        bins: [{ start: values[0] ?? 0, end: (values[0] ?? 0) + 1, count: values.length }],
        weighting: weighted ? 'weighted' : 'none',
      };
    }
    const min = Math.min(...values);
    const max = Math.max(...values);
    const binCount = 12;
    const width = (max - min) / binCount || 1;
    const bins = Array.from({ length: binCount }, (_, i) => ({
      start: min + i * width,
      end: min + (i + 1) * width,
      count: 0,
    }));
    for (const row of rows) {
      const n = parseNumericCellValue(row[yId] ?? row[xId]);
      const weight = observationWeight(row, weightColumn);
      if (n === null || weight === null) continue;
      const idx = Math.min(binCount - 1, Math.floor((n - min) / width));
      bins[idx]!.count += weight;
    }
    return {
      kind: 'histogram',
      title: weighted ? `Weighted distribution of ${label}` : `Distribution of ${label}`,
      x_label: label,
      bins,
      weighting: weighted ? 'weighted' : 'none',
    };
  }

  if (kind === 'boxplot') {
    const groups: {
      label: string;
      min: number;
      q1: number;
      median: number;
      q3: number;
      max: number;
    }[] = [];
    const byGroup = new Map<string, number[]>();
    for (const row of rows) {
      const label = String(row[xId] ?? '').trim() || yLabel;
      const n = parseNumericCellValue(row[yId]);
      if (n === null || observationWeight(row, weightColumn) === null) continue;
      const list = byGroup.get(label) ?? [];
      list.push(n);
      byGroup.set(label, list);
    }
    for (const [label, list] of byGroup) {
      if (list.length < 2 || groups.length >= 12) continue;
      const sorted = [...list].sort((a, b) => a - b);
      groups.push({
        label,
        min: sorted[0]!,
        q1: quantile(sorted, 0.25),
        median: quantile(sorted, 0.5),
        q3: quantile(sorted, 0.75),
        max: sorted[sorted.length - 1]!,
      });
    }
    const title = `${yLabel} by ${xLabel}`;
    return {
      kind: 'boxplot',
      title: groups.length ? (weighted ? `Unweighted ${title}` : title) : `No rows for ${title}`,
      y_label: yLabel,
      groups,
      weighting: weighted ? 'unweighted' : 'none',
    };
  }

  if (kind === 'pie') {
    const series = categorySeries(rows, xId, yId, weightColumn, 'sum', 11);
    const categories = [...series.categories];
    const values = [...series.values];
    if (series.totalGroups > categories.length) {
      const remainder = categorySeries(rows, xId, yId, weightColumn, 'sum', series.totalGroups);
      const rest = remainder.values.slice(categories.length).reduce((sum, value) => sum + value, 0);
      categories.push('Other');
      values.push(rest);
    }
    const base = `${yLabel} by ${xLabel}`;
    return {
      kind: 'pie',
      title: values.length ? (series.weighted ? `Weighted ${base}` : base) : `No rows for ${base}`,
      categories,
      values,
      weighting: series.weighted ? 'weighted' : 'none',
      x_scale: 'category',
    };
  }

  if (kind === 'density') {
    const values: number[] = [];
    for (const row of rows) {
      const n = parseNumericCellValue(row[yId] ?? row[xId]);
      if (n === null || observationWeight(row, weightColumn) === null) continue;
      values.push(n);
    }
    const label = columnIsNumeric(rows, yId) ? yLabel : xLabel;
    return {
      kind: 'density',
      title: values.length ? `Density of ${label}` : `No rows for ${label}`,
      x_label: label,
      y_label: 'Density',
      series: [{ name: label, points: densityCurve(values) }],
      weighting: weighted ? 'unweighted' : 'none',
    };
  }

  if (kind === 'violin') {
    const byGroup = new Map<string, number[]>();
    for (const row of rows) {
      const label = String(row[xId] ?? '').trim() || yLabel;
      const n = parseNumericCellValue(row[yId]);
      if (n === null || observationWeight(row, weightColumn) === null) continue;
      const list = byGroup.get(label) ?? [];
      list.push(n);
      byGroup.set(label, list);
    }
    const groups = [...byGroup.entries()].slice(0, 12).flatMap(([label, list]) => {
      if (list.length < 2) return [];
      const sorted = [...list].sort((a, b) => a - b);
      const curve = densityCurve(list);
      const maxDensity = Math.max(...curve.map(point => point.y), 1);
      return [
        {
          label,
          min: sorted[0]!,
          q1: quantile(sorted, 0.25),
          median: quantile(sorted, 0.5),
          q3: quantile(sorted, 0.75),
          max: sorted[sorted.length - 1]!,
          density: curve.map(point => ({ y: point.x, width: point.y / maxDensity })),
        },
      ];
    });
    return {
      kind: 'violin',
      title: groups.length ? `${yLabel} by ${xLabel}` : `No rows for ${yLabel} by ${xLabel}`,
      y_label: yLabel,
      groups,
      weighting: weighted ? 'unweighted' : 'none',
    };
  }

  const series = categorySeries(
    rows,
    xId,
    yId,
    weightColumn,
    'mean',
    40,
    kind === 'bar' || kind === 'line' ? errorBars : 'none'
  );
  const numericY = columnIsNumeric(rows, yId);
  const measure = numericY ? `Mean ${yLabel}` : `Count of ${xLabel}`;
  const base = `${measure} by ${xLabel}`;
  const capped =
    series.totalGroups > series.categories.length
      ? ` (first ${series.categories.length} of ${series.totalGroups} groups)`
      : '';
  return {
    kind,
    title: series.categories.length
      ? `${series.weighted ? 'Weighted ' : ''}${base}${capped}`
      : `No rows for ${base}`,
    x_label: xLabel,
    y_label: series.weighted && numericY ? `Weighted ${measure}` : measure,
    categories: series.categories,
    series: [
      {
        name: yLabel,
        values: series.values,
        ...(series.errors ? { errors: series.errors, error_kind: series.errorKind } : {}),
      },
    ],
    weighting: series.weighted ? 'weighted' : 'none',
    x_scale: 'category',
  };
}

export function buildChartFromDataset(
  message: string,
  columns: ColumnLike[],
  rows: Record<string, unknown>[],
  weightColumn?: string | null,
  palette?: { kind: PaletteChartKind; xId: string; yId: string; errorBars?: ErrorBarKind }
): AnalysisReportChart | null {
  const named = palette?.kind ?? leadingPaletteKind(message);
  if (named) {
    const axes = palette ?? axesFromMessage(message, columns);
    return buildExplicitPaletteChart(
      named,
      columns,
      rows,
      axes.xId,
      axes.yId,
      weightColumn,
      palette?.errorBars ?? 'none'
    );
  }
  if (!columns.length || !rows.length) return null;
  const weighted = Boolean(weightColumn);

  const hints = tokenizeColumnHints(message);
  const resolveHint = (hint: string) => {
    const direct = findColumnByLabel(columns, hint);
    if (direct) return direct;
    const lower = hint.trim().toLowerCase();
    const aliasToIds: Record<string, string[]> = {
      minutes: ['mp', 'min'],
      minute: ['mp', 'min'],
      points: ['pts', 'point'],
      point: ['pts', 'point'],
      rebounds: ['trb', 'reb'],
      assists: ['ast'],
      age: ['age'],
    };
    const ids = aliasToIds[lower];
    if (ids) {
      const byId = columns.find(c => ids.includes(c.id.toLowerCase()));
      if (byId) return byId;
    }
    return columns.find(
      c =>
        c.header.toLowerCase().includes(lower) ||
        lower.includes(c.header.toLowerCase()) ||
        c.id.toLowerCase().includes(lower)
    );
  };
  const resolved = hints.map(h => resolveHint(h)).filter((c): c is ColumnLike => !!c);

  const nums = numericColumns(columns, rows);
  const cats = categoricalColumns(columns, rows);

  if (/\bbox\s*plots?\b/i.test(message)) {
    const num = resolved.find(c => nums.some(x => x.id === c.id)) ?? nums[0];
    const cat =
      resolved.find(c => cats.some(x => x.id === c.id) && c.id !== num?.id) ??
      cats.find(c => c.id !== num?.id);
    if (num) {
      const groups: {
        label: string;
        min: number;
        q1: number;
        median: number;
        q3: number;
        max: number;
      }[] = [];
      const collect = (label: string, values: number[]) => {
        if (values.length < 2) return;
        const s = [...values].sort((a, b) => a - b);
        const q = (p: number) => {
          const idx = (s.length - 1) * p;
          const lo = Math.floor(idx);
          const hi = Math.ceil(idx);
          if (lo === hi) return s[lo]!;
          return s[lo]! + (s[hi]! - s[lo]!) * (idx - lo);
        };
        groups.push({
          label,
          min: s[0]!,
          q1: q(0.25),
          median: q(0.5),
          q3: q(0.75),
          max: s[s.length - 1]!,
        });
      };
      if (cat) {
        const byGroup = new Map<string, number[]>();
        for (const row of rows) {
          const label = String(row[cat.id] ?? '').trim();
          const n = parseNumericCellValue(row[num.id]);
          if (!label || n === null || observationWeight(row, weightColumn) === null) continue;
          const list = byGroup.get(label) ?? [];
          list.push(n);
          byGroup.set(label, list);
        }
        for (const [label, values] of byGroup) {
          collect(label, values);
          if (groups.length >= 12) break;
        }
      } else {
        const values: number[] = [];
        for (const row of rows) {
          const n = parseNumericCellValue(row[num.id]);
          if (n !== null && observationWeight(row, weightColumn) !== null) values.push(n);
        }
        collect(num.header, values);
      }
      if (groups.length) {
        const title = cat ? `${num.header} by ${cat.header}` : `Boxplot of ${num.header}`;
        return {
          kind: 'boxplot',
          title: weighted ? `Unweighted ${title}` : title,
          y_label: num.header,
          groups,
          weighting: weighted ? 'unweighted' : 'none',
        };
      }
    }
  }

  if (/\bdistribution\b/i.test(message) && resolved.length >= 1) {
    const cat = resolved.find(c => cats.some(x => x.id === c.id)) ?? cats[0];
    const num =
      resolved.find(c => nums.some(x => x.id === c.id)) ?? nums.find(c => c.id !== cat?.id);
    if (cat && num) {
      const counts = new Map<string, number>();
      const sums = new Map<string, number>();
      for (const row of rows) {
        const label = String(row[cat.id] ?? '');
        const n = parseNumericCellValue(row[num.id]);
        const weight = observationWeight(row, weightColumn);
        if (!label || n === null || weight === null) continue;
        counts.set(label, (counts.get(label) ?? 0) + weight);
        sums.set(label, (sums.get(label) ?? 0) + n * weight);
      }
      const categories = [...counts.keys()].slice(0, 12);
      const values = categories.map(c => {
        const sum = sums.get(c) ?? 0;
        const count = counts.get(c) ?? 1;
        return sum / count;
      });
      return {
        kind: 'bar_grouped',
        title: weighted
          ? `Weighted mean ${num.header} by ${cat.header}`
          : `${num.header} by ${cat.header}`,
        x_label: cat.header,
        y_label: weighted ? `Weighted mean ${num.header}` : num.header,
        categories,
        series: [{ name: num.header, values }],
        weighting: weighted ? 'weighted' : 'none',
      };
    }
  }

  const xCol = resolved[0] ?? nums[0];
  const yCol = resolved[1] ?? nums.find(c => c.id !== xCol?.id);
  if (xCol && yCol && xCol.id !== yCol.id) {
    const points: { x: number; y: number }[] = [];
    for (const row of rows) {
      const x = parseNumericCellValue(row[xCol.id]);
      const y = parseNumericCellValue(row[yCol.id]);
      if (x === null || y === null || observationWeight(row, weightColumn) === null) continue;
      points.push({ x, y });
      if (points.length >= 400) break;
    }
    if (points.length >= 2) {
      const title = `${yCol.header} vs ${xCol.header}`;
      return {
        kind: 'scatter',
        title: weighted ? `Unweighted scatter of ${title}` : title,
        x_label: xCol.header,
        y_label: yCol.header,
        points,
        weighting: weighted ? 'unweighted' : 'none',
      };
    }
  }

  if (nums[0]) {
    const col = nums[0];
    const values: number[] = [];
    for (const row of rows) {
      const n = parseNumericCellValue(row[col.id]);
      if (n !== null) values.push(n);
      if (values.length >= 500) break;
    }
    if (values.length < 2) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const binCount = 12;
    const width = (max - min) / binCount || 1;
    const bins = Array.from({ length: binCount }, (_, i) => ({
      start: min + i * width,
      end: min + (i + 1) * width,
      count: 0,
    }));
    for (const row of rows) {
      const n = parseNumericCellValue(row[col.id]);
      const weight = observationWeight(row, weightColumn);
      if (n === null || weight === null) continue;
      const idx = Math.min(binCount - 1, Math.floor((n - min) / width));
      bins[idx].count += weight;
    }
    return {
      kind: 'histogram',
      title: weighted ? `Weighted distribution of ${col.header}` : `Distribution of ${col.header}`,
      x_label: col.header,
      bins,
      weighting: weighted ? 'weighted' : 'none',
    };
  }

  return null;
}

/** Fetch preview rows when the tab store has columns but no in-memory grid data yet. */
export async function fetchDatasetPreviewRows(
  datasetId: string,
  limit = 2500
): Promise<Record<string, unknown>[]> {
  const token = getIdToken();
  if (!token) return [];
  const res = await fetch(tensrApiUrl(`/datasets/${datasetId}/preview?limit=${limit}`), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const preview = (await res.json()) as { headers?: string[]; rows?: unknown[][] };
  const headers = preview.headers ?? [];
  const rows = preview.rows ?? [];
  return rows.map(rowArr => {
    const obj: Record<string, unknown> = {};
    headers.forEach((header, i) => {
      obj[header] = (rowArr as unknown[])[i];
    });
    return obj;
  });
}

const CHART_PAGE_ROWS = 5000;
const CHART_FRAME_MAX_ROWS = 100_000;

/** Every preview page, then the sheet's filters. Charts do not use the tab preview. */
export async function loadFilteredChartRows(
  datasetId: string,
  filters: TabColumnFilter[] = [],
  rowUids?: string[]
): Promise<Record<string, unknown>[]> {
  const token = getIdToken();
  if (!token) throw new Error('Sign in to load the dataset for this chart.');
  const all: Record<string, unknown>[] = [];
  let offset = 0;
  for (;;) {
    const res = await fetch(
      tensrApiUrl(`/datasets/${datasetId}/preview?limit=${CHART_PAGE_ROWS}&offset=${offset}`),
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Could not load the dataset for this chart (${res.status}). ${text}`.trim());
    }
    const preview = (await res.json()) as {
      headers?: string[];
      variable_names?: string[];
      rows?: unknown[][];
      truncated?: boolean;
      offset?: number;
    };
    // A deploy that predates offset ignores the query and omits the field.
    // Keep the first page so the chart still draws.
    if (offset > 0 && preview.offset !== offset) break;
    const names = preview.variable_names?.length ? preview.variable_names : (preview.headers ?? []);
    const headers = preview.headers ?? [];
    const page = (preview.rows ?? []).map(rowArr => {
      const obj: Record<string, unknown> = {};
      const cells = rowArr as unknown[];
      names.forEach((name, i) => {
        obj[name] = cells[i];
        const header = headers[i];
        if (header && header !== name && !(header in obj)) obj[header] = cells[i];
      });
      return obj;
    });
    all.push(...page);
    if (!preview.truncated || page.length === 0) break;
    offset += page.length;
    if (all.length >= CHART_FRAME_MAX_ROWS) {
      throw new Error(
        `This dataset has more than ${CHART_FRAME_MAX_ROWS.toLocaleString()} rows. The chart needs the full frame, and this one is past that limit.`
      );
    }
  }
  const filtered = applyClientColumnFilters(all, filters);
  return rowUids?.length ? filterRowsByRowUids(filtered, rowUids) : filtered;
}

export function chartFromAnalysisEnvelope(
  envelope: Record<string, unknown> | undefined
): AnalysisReportChart | null {
  if (!envelope) return null;
  const report = envelope.report as { chart?: AnalysisReportChart } | undefined;
  if (report?.chart) return report.chart;
  return null;
}
