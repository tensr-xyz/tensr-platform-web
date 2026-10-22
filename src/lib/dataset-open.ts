/** First grid page on dataset open. Later pages use the same size. */
export const FIRST_OPEN_ROWS = 200;

export type DatasetOpenTimings = {
  schema?: Record<string, number>;
  preview?: Record<string, number>;
};

export function previewPageUrl(
  datasetId: string,
  offset: number,
  limit: number = FIRST_OPEN_ROWS
): string {
  const params = new URLSearchParams({
    offset: String(Math.max(0, offset)),
    limit: String(limit),
    slim: '1',
  });
  return `/datasets/${datasetId}/preview?${params.toString()}`;
}

/** Parse a Server-Timing header into name → milliseconds. */
export function readServerTiming(header: string | null): Record<string, number> {
  const timings: Record<string, number> = {};
  if (!header) return timings;
  for (const part of header.split(',')) {
    const [rawName, ...params] = part.trim().split(';');
    const name = rawName.trim();
    const dur = params.map(item => item.trim()).find(item => item.startsWith('dur='));
    if (!name || !dur) continue;
    const value = Number(dur.slice(4));
    if (Number.isFinite(value)) timings[name] = value;
  }
  return timings;
}

export function noteServerTiming(kind: 'schema' | 'preview', header: string | null): void {
  if (typeof window === 'undefined') return;
  const host = window as Window & { __tensrDatasetOpen?: DatasetOpenTimings };
  const current = host.__tensrDatasetOpen ?? {};
  current[kind] = readServerTiming(header);
  host.__tensrDatasetOpen = current;
}

/** Run after first paint. Returns a cancel function. */
export function runWhenIdle(task: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(() => task());
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(task, 1);
  return () => window.clearTimeout(id);
}
