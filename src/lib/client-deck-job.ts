import { apiClient } from '@/lib/api-client';
import type { AgentLoopResponse, AgentLoopToolResult } from '@/lib/run-agent-loop';

const CLIENT_DECK_POLL_MS = 1500;
/** ~5 minutes: multi-chunk table builds on the 180s worker need room to finish. */
const CLIENT_DECK_POLL_LIMIT = 200;

export type ClientDeckJobSnapshot = {
  ok?: boolean;
  job_id?: string;
  status?: string;
  stage?: string;
  message?: string;
  tables_done?: number;
  tables_total?: number;
  n_saved_tables?: number;
  question_tables_total?: number;
  report_pages?: number;
  error?: string;
  result?: Record<string, unknown>;
};

/** Pending build_client_deck result that still needs a background job poll. */
export function pendingClientDeckFromToolResults(
  results: AgentLoopToolResult[] | undefined
): { datasetId: string; jobId: string; entryIndex: number } | null {
  if (!results?.length) return null;
  for (let index = 0; index < results.length; index += 1) {
    const entry = results[index];
    const result = entry?.result;
    if (!result || typeof result !== 'object') continue;
    const procedure = String(entry.name || result.procedure || '');
    if (procedure !== 'build_client_deck' && result.procedure !== 'build_client_deck') continue;
    const pending = result.pending === true || String(result.status || '') === 'pending';
    const jobId = String(result.job_id || '').trim();
    const datasetId = String(
      result.dataset_id || entry.args?.dataset_id || entry.args?.input || ''
    ).trim();
    if (pending && jobId && datasetId) {
      return { datasetId, jobId, entryIndex: index };
    }
  }
  return null;
}

export function clientDeckProgressLine(job: ClientDeckJobSnapshot | null | undefined): string {
  if (!job) return 'Building the deck';
  const stage = String(job.stage || '');
  const done = Number(job.tables_done || 0);
  const total = Number(job.tables_total || 0);
  const saved = Number(job.n_saved_tables || 0);
  const savedNote =
    saved > 0 && total > 0 && saved > total
      ? `; ${saved} saved tables including ${saved - total} insight crosstabs`
      : '';
  // Prefer the API message when it already explains the plan vs saved difference.
  const apiMessage = String(job.message || '').trim();
  if (stage === 'tables' && total > 0) {
    if (apiMessage && /computing tables/i.test(apiMessage)) return apiMessage;
    return `Computing tables ${done} of ${total}${savedNote}`;
  }
  if (stage === 'narrative') {
    if (apiMessage && /writing insights/i.test(apiMessage)) return apiMessage;
    return `Writing insights${savedNote}`;
  }
  if (stage === 'pptx') return 'Building the PowerPoint file';
  if (String(job.status || '') === 'complete') return 'Deck build complete';
  if (String(job.status || '') === 'failed') {
    return String(job.error || job.message || 'The deck build failed.');
  }
  return String(job.message || 'Building the deck');
}

export async function fetchClientDeckJob(
  datasetId: string,
  jobId: string
): Promise<ClientDeckJobSnapshot | null> {
  try {
    return await apiClient.datasets.clientDeckJob(datasetId, jobId);
  } catch {
    return null;
  }
}

/** Wait until a pending client-deck job is complete or failed. */
export async function waitForClientDeckJob(
  datasetId: string,
  jobId: string,
  opts?: {
    intervalMs?: number;
    attempts?: number;
    signal?: AbortSignal;
    onProgress?: (message: string) => void;
    onJob?: (job: ClientDeckJobSnapshot) => void;
  }
): Promise<ClientDeckJobSnapshot | null> {
  const intervalMs = opts?.intervalMs ?? CLIENT_DECK_POLL_MS;
  const attempts = opts?.attempts ?? CLIENT_DECK_POLL_LIMIT;
  let last = '';
  let lastPages = -1;
  for (let i = 0; i < attempts; i += 1) {
    if (opts?.signal?.aborted) return null;
    const job = await fetchClientDeckJob(datasetId, jobId);
    if (job) opts?.onJob?.(job);
    const status = String(job?.status || 'pending');
    const line = clientDeckProgressLine(job);
    if (line && line !== last) {
      opts?.onProgress?.(line);
      last = line;
    }
    const pages = Number(job?.report_pages || 0);
    if (pages > lastPages) lastPages = pages;
    if (job && status !== 'pending' && status !== 'running') return job;
    if (i + 1 >= attempts) return job;
    await new Promise<void>(resolve => {
      const timer = setTimeout(resolve, intervalMs);
      opts?.signal?.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true }
      );
    });
  }
  return null;
}

function answerFromClientDeckResult(result: Record<string, unknown>): string {
  const key = String((result.exports as { key?: string } | undefined)?.key || result.key || '');
  const filename = String(
    (result.exports as { filename?: string } | undefined)?.filename || result.filename || ''
  );
  const pages = result.report_pages;
  const bits: string[] = [];
  if (key) bits.push(`PowerPoint: ${filename || 'client-deck.pptx'}`);
  if (typeof pages === 'number' && pages > 0) bits.push(`Report pages: ${pages}`);
  if (typeof result.n_saved_tables === 'number' && result.n_saved_tables > 0) {
    bits.push(`Saved tables: ${result.n_saved_tables}`);
  }
  if (typeof result.n_insights === 'number') bits.push(`Insight slides: ${result.n_insights}`);
  if (typeof result.n_questions === 'number') {
    bits.push(`Appendix questions: ${result.n_questions}`);
  }
  if (bits.length) {
    bits.push('Open the Report tab to edit the pages.');
    return bits.join('\n');
  }
  return String(result.message || result.error || 'The PowerPoint file could not be built.');
}

/** Patch a pending build_client_deck tool result from a job snapshot. */
export function applyClientDeckJobSnapshot(
  response: AgentLoopResponse,
  job: ClientDeckJobSnapshot
): AgentLoopResponse {
  const found = pendingClientDeckFromToolResults(response.tool_results);
  if (!found) return response;
  const results = [...(response.tool_results || [])];
  const entry = { ...(results[found.entryIndex] || { name: 'build_client_deck' }) };
  const prior = { ...(entry.result || {}) };

  if (String(job.status || '') === 'failed') {
    let message = String(job.error || job.message || 'The deck build failed.');
    const tablesDone = Number(job.tables_done || 0);
    if (tablesDone > 0 && !/continue/i.test(message)) {
      message = `${message.replace(/\.\s*$/, '')}. Ask me to continue to resume from the saved tables.`;
    } else if (!/continue/i.test(message)) {
      message = `${message.replace(/\.\s*$/, '')}. Ask me to continue to try again.`;
    }
    entry.result = {
      ...prior,
      ok: false,
      pending: false,
      status: 'failed',
      message,
      answer_markdown: message,
      report_pages: job.report_pages ?? prior.report_pages,
      tables_done: job.tables_done ?? prior.tables_done,
      tables_total: job.tables_total ?? prior.tables_total,
    };
    results[found.entryIndex] = entry;
    return { ...response, answer_markdown: message, tool_results: results };
  }

  if (String(job.status || '') !== 'complete' || !job.result) {
    const line = clientDeckProgressLine(job);
    const pages = job.report_pages;
    const status = String(job.status || 'pending');
    const running = status === 'running' || status === 'pending';
    // Mid-run copy is progress only. "Ask me to continue" is for stalled/failed
    // polls — saying it while tables still compute looks like a finished pause.
    const answer = [
      line,
      typeof pages === 'number' && pages > 0 ? `Report pages: ${pages}` : '',
      running
        ? ''
        : 'Report pages already saved will stay. Ask me to continue when you want the PowerPoint file.',
    ]
      .filter(Boolean)
      .join('\n');
    entry.result = {
      ...prior,
      ok: true,
      pending: true,
      status: 'pending',
      progress_message: line,
      answer_markdown: answer,
      report_pages: pages ?? prior.report_pages,
      deliver_exports: false,
    };
    delete (entry.result as { exports?: unknown }).exports;
    results[found.entryIndex] = entry;
    return { ...response, answer_markdown: answer, tool_results: results };
  }

  const payload = job.result;
  const key = String(payload.key || '').trim();
  const filename = String(payload.filename || 'client-deck.pptx');
  const merged: Record<string, unknown> = {
    ...prior,
    ...payload,
    ok: true,
    pending: false,
    status: 'complete',
    procedure: 'build_client_deck',
    deliver_exports: Boolean(key),
    job_id: found.jobId,
  };
  if (key) {
    merged.exports = {
      filename,
      key,
      expires_in: Number(payload.expires_in || 900),
      media_type: String(
        payload.media_type ||
          'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      ),
      ...(payload.export_id ? { export_id: String(payload.export_id) } : {}),
    };
  } else {
    delete merged.exports;
  }
  merged.answer_markdown = answerFromClientDeckResult(merged);
  entry.result = merged;
  const patched: AgentLoopToolResult & {
    downloads?: Array<{ filename: string; key: string; expires: number }>;
  } = { ...entry };
  if (key) {
    patched.downloads = [{ filename, key, expires: Number(payload.expires_in || 900) }];
  }
  results[found.entryIndex] = patched;
  return {
    ...response,
    answer_markdown: String(merged.answer_markdown),
    tool_results: results,
  };
}

/**
 * Keep polling a pending deck job in the background so chat and Report can
 * refresh themselves without blocking the turn for follow-up questions.
 */
export async function watchClientDeckJobInBackground(
  response: AgentLoopResponse,
  opts?: {
    datasetId?: string | null;
    signal?: AbortSignal;
    onProgress?: (step: string, message: string) => void;
    onUpdate?: (next: AgentLoopResponse) => void;
    onReportPages?: (pages: number) => void;
  }
): Promise<AgentLoopResponse> {
  const found = pendingClientDeckFromToolResults(response.tool_results);
  if (!found) return response;
  const datasetId = found.datasetId || String(opts?.datasetId || '').trim();
  if (!datasetId) return response;

  let latest = response;
  let lastPages = Number(
    (response.tool_results?.[found.entryIndex]?.result as { report_pages?: number } | undefined)
      ?.report_pages || 0
  );
  if (lastPages > 0) opts?.onReportPages?.(lastPages);

  let lastProgressKey = '';
  const job = await waitForClientDeckJob(datasetId, found.jobId, {
    signal: opts?.signal,
    onProgress: message => {
      opts?.onProgress?.('build_client_deck', message);
    },
    onJob: snapshot => {
      const pages = Number(snapshot.report_pages || 0);
      const progressKey = [
        String(snapshot.status || ''),
        String(snapshot.stage || ''),
        String(snapshot.tables_done || 0),
        String(snapshot.tables_total || 0),
        String(pages),
        String(snapshot.message || ''),
      ].join('|');
      const pagesGrew = pages > lastPages;
      if (pagesGrew) {
        lastPages = pages;
        opts?.onReportPages?.(pages);
      }
      // Refresh chat whenever progress moves — not only when Report pages grow.
      // Otherwise a silent 0/0 start never updates the turn until the poll ends.
      if (pagesGrew || progressKey !== lastProgressKey) {
        lastProgressKey = progressKey;
        latest = applyClientDeckJobSnapshot(response, snapshot);
        opts?.onUpdate?.(latest);
      }
    },
  });
  if (!job) return latest;

  latest = applyClientDeckJobSnapshot(response, job);
  opts?.onUpdate?.(latest);
  const finalPages = Number(
    (latest.tool_results?.[found.entryIndex]?.result as { report_pages?: number } | undefined)
      ?.report_pages ||
      job.report_pages ||
      0
  );
  if (finalPages > 0) opts?.onReportPages?.(finalPages);
  return latest;
}

/**
 * If the loop returned a pending client-deck job, check once (or briefly) and
 * return. Do not hold the chat turn for minutes — a stuck job must not block
 * follow-up questions. Ask the user to continue when the file is ready.
 * Use ``watchClientDeckJobInBackground`` to refresh chat/Report afterward.
 */
export async function resolvePendingClientDeckInResponse(
  response: AgentLoopResponse,
  opts?: {
    datasetId?: string | null;
    signal?: AbortSignal;
    onProgress?: (step: string, message: string) => void;
    /** When true, poll until complete (Report tab / resume). Chat turns stay quick. */
    waitForComplete?: boolean;
  }
): Promise<AgentLoopResponse> {
  const found = pendingClientDeckFromToolResults(response.tool_results);
  if (!found) return response;
  const datasetId = found.datasetId || String(opts?.datasetId || '').trim();
  if (!datasetId) return response;

  const job = opts?.waitForComplete
    ? await waitForClientDeckJob(datasetId, found.jobId, {
        signal: opts?.signal,
        onProgress: message => opts?.onProgress?.('build_client_deck', message),
      })
    : await waitForClientDeckJob(datasetId, found.jobId, {
        signal: opts?.signal,
        // One quick look so a finished job still resolves; otherwise return pending.
        attempts: 2,
        intervalMs: 400,
        onProgress: message => opts?.onProgress?.('build_client_deck', message),
      });
  if (!job) return response;
  return applyClientDeckJobSnapshot(response, job);
}
