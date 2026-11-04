export type OutputRun = {
  id: string;
  title: string;
  op: string;
  created_at: string;
  status: string;
  file?: string;
  base?: number | null;
  weightedBase?: number | null;
  weighting?: string;
  inReport?: boolean;
  datasetId?: string;
};

/** "aware_A × region — Unweighted, n = 30" → title, weighting note, and base. */
export function splitRunTitle(raw: string): {
  title: string;
  weighting: string;
  base: number | null;
} {
  const [head, ...rest] = raw.split(' — ');
  const tail = rest.join(' — ');
  const match = tail.match(/n\s*=\s*([\d,]+)/i);
  const weighting = tail
    .replace(/,?\s*n\s*=\s*[\d,]+/i, '')
    .replace(/[,\s]+$/, '')
    .trim();
  return {
    title: head.trim(),
    weighting,
    base: match ? Number(match[1].replace(/,/g, '')) : null,
  };
}

/** The chip a run shows: In report when pinned, Saved once complete, otherwise Draft. */
export function runState(status: string, pinned: boolean): 'In report' | 'Saved' | 'Draft' {
  if (pinned) return 'In report';
  return status === 'complete' ? 'Saved' : 'Draft';
}

export function outputRuns(rows: unknown[]): OutputRun[] {
  const runs: OutputRun[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const record = row as Record<string, unknown>;
    const id = String(record.id || '');
    const op = String(record.op || '');
    if (!id || !op) continue;
    const split = splitRunTitle(String(record.title || '').trim() || op.replaceAll('_', ' '));
    const storedBase = typeof record.base_n === 'number' ? record.base_n : null;
    const weightedBase = typeof record.weighted_base === 'number' ? record.weighted_base : null;
    runs.push({
      id,
      title: split.title,
      op,
      created_at: String(record.created_at || ''),
      status: String(record.status || 'complete'),
      base: storedBase,
      weightedBase,
      weighting: split.weighting,
      inReport: record.in_report === true,
      datasetId: String(record.dataset_id || ''),
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

/** One count per status from one de-duplicated list, so All always equals Saved plus Draft. */
export function outputCounts(
  runs: OutputRun[],
  pinned: Set<string>
): { all: number; counts: { status: 'Saved' | 'In report' | 'Draft'; count: number }[] } {
  const unique = uniqueRuns(runs);
  const states = unique.map(run => runState(run.status, pinned.has(run.id)));
  const inReport = states.filter(state => state === 'In report').length;
  const draft = states.filter(state => state === 'Draft').length;
  return {
    all: unique.length,
    counts: [
      { status: 'Saved', count: unique.length - draft },
      { status: 'In report', count: inReport },
      { status: 'Draft', count: draft },
    ],
  };
}

export function uniqueRuns(runs: OutputRun[]): OutputRun[] {
  const seen = new Set<string>();
  return runs.filter(run => {
    if (!run.id || seen.has(run.id)) return false;
    seen.add(run.id);
    return true;
  });
}
