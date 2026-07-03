import type { AnalysisReportChart } from '@/lib/analysis-report-types';
import { isChartIntent, shouldRouteToInlineChart } from '@/lib/chart-intent';
import { findColumnByLabel, type ColumnLike } from '@/lib/column-utils';
import { parseNumericCellValue } from '@/lib/column-heatmap';
import { tensrApiUrl } from '@/lib/tensr-api-url';
import { getIdToken } from '@/utils/auth';

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
export function buildChartFromDataset(
  message: string,
  columns: ColumnLike[],
  rows: Record<string, unknown>[]
): AnalysisReportChart | null {
  if (!columns.length || !rows.length) return null;

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
        if (!label || n === null) continue;
        counts.set(label, (counts.get(label) ?? 0) + 1);
        sums.set(label, (sums.get(label) ?? 0) + n);
      }
      const categories = [...counts.keys()].slice(0, 12);
      const values = categories.map(c => {
        const sum = sums.get(c) ?? 0;
        const count = counts.get(c) ?? 1;
        return sum / count;
      });
      return {
        kind: 'bar_grouped',
        title: `${num.header} by ${cat.header}`,
        x_label: cat.header,
        y_label: num.header,
        categories,
        series: [{ name: num.header, values }],
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
      if (x === null || y === null) continue;
      points.push({ x, y });
      if (points.length >= 400) break;
    }
    if (points.length >= 2) {
      return {
        kind: 'scatter',
        title: `${yCol.header} vs ${xCol.header}`,
        x_label: xCol.header,
        y_label: yCol.header,
        points,
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
    for (const v of values) {
      const idx = Math.min(binCount - 1, Math.floor((v - min) / width));
      bins[idx].count += 1;
    }
    return {
      kind: 'histogram',
      title: `Distribution of ${col.header}`,
      x_label: col.header,
      bins,
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

export function chartFromAnalysisEnvelope(
  envelope: Record<string, unknown> | undefined
): AnalysisReportChart | null {
  if (!envelope) return null;
  const report = envelope.report as { chart?: AnalysisReportChart } | undefined;
  if (report?.chart) return report.chart;
  return null;
}
