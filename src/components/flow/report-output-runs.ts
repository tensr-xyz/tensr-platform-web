export type OutputRun = {
  id: string;
  title: string;
  op: string;
  created_at: string;
  status: string;
  file?: string;
};

export function outputRuns(rows: unknown[]): OutputRun[] {
  const runs: OutputRun[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const record = row as Record<string, unknown>;
    const id = String(record.id || '');
    const op = String(record.op || '');
    if (!id || !op) continue;
    const title = String(record.title || '').trim() || op.replaceAll('_', ' ');
    runs.push({
      id,
      title,
      op,
      created_at: String(record.created_at || ''),
      status: String(record.status || 'complete'),
    });
  }
  return runs;
}

export function statusCounts(runs: OutputRun[]): { status: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const run of runs) counts.set(run.status, (counts.get(run.status) || 0) + 1);
  return [...counts.entries()].map(([status, count]) => ({ status, count }));
}

function dayStart(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function dayLabel(iso: string, now = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const days = Math.round((dayStart(now) - dayStart(date)) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return 'Earlier';
}

export function clockLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function baseCount(run: Record<string, unknown>): number | null {
  const result = run.result as { n_used?: unknown; n_rows?: unknown } | undefined;
  if (typeof result?.n_used === 'number' && Number.isFinite(result.n_used)) return result.n_used;
  const report = run.report as { meta?: { rows_dataset?: unknown } } | undefined;
  const rows = report?.meta?.rows_dataset;
  if (typeof rows === 'number' && Number.isFinite(rows)) return rows;
  if (typeof result?.n_rows === 'number' && Number.isFinite(result.n_rows)) return result.n_rows;
  return null;
}

export function summaryText(run: Record<string, unknown>): string {
  const report = run.report as { summary?: unknown } | undefined;
  return typeof report?.summary === 'string' ? report.summary.trim() : '';
}

export function metricLines(run: Record<string, unknown>): { label: string; value: string }[] {
  const report = run.report as { metrics?: unknown } | undefined;
  if (!Array.isArray(report?.metrics)) return [];
  const lines: { label: string; value: string }[] = [];
  for (const metric of report.metrics) {
    if (!metric || typeof metric !== 'object') continue;
    const record = metric as Record<string, unknown>;
    const label = String(record.label || record.name || '').trim();
    const value = record.value;
    if (!label || value == null || value === '') continue;
    lines.push({ label, value: String(value) });
  }
  return lines;
}
