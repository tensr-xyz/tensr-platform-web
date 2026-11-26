import { waitForAnalysisRun } from '@/lib/analysis-runs';

/** True when a Tables POST/GET queued the 180s worker (TEN-274). */
export function isPendingTablePayload(
  body: Record<string, unknown> | null | undefined
): body is Record<string, unknown> & { status: string; run_id: string } {
  if (!body || typeof body !== 'object') return false;
  const status = String(body.status || '').toLowerCase();
  const runId = String(body.run_id || '').trim();
  return status === 'pending' && Boolean(runId);
}

/**
 * When the gateway returns 202 `{ status: pending, run_id }`, poll until the
 * worker writes the slim book onto that analysis run. Otherwise return the body.
 */
export async function resolveTablePayload(
  body: Record<string, unknown>,
  opts?: { signal?: AbortSignal }
): Promise<Record<string, unknown>> {
  if (!isPendingTablePayload(body)) return body;
  const run = await waitForAnalysisRun(String(body.run_id), { signal: opts?.signal });
  const status = String(run?.status || '').toLowerCase();
  if (!run || status === 'failed' || status === 'pending') {
    const err = new Error(
      status === 'failed'
        ? 'Tensr could not build that table. Try again in a moment.'
        : 'Tensr is still building that table. Try again in a moment.'
    );
    (err as Error & { status?: number }).status = status === 'failed' ? 500 : 202;
    throw err;
  }
  const result = run.result;
  if (result && typeof result === 'object' && !Array.isArray(result)) {
    return result as Record<string, unknown>;
  }
  return { ok: true, run_id: run.id };
}
