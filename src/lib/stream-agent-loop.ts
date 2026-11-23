import posthog from 'posthog-js';
import { captureProductEvent } from '@/lib/product-analytics';
import { getStytchBearerForTensrApi, getTensrApiHeaders } from '@/utils/auth';
import { tensrApiUrl } from '@/lib/tensr-api-url';
import { ApiRequestError } from '@/lib/api-error';
import { handleUnauthorizedResponse } from '@/lib/session-expired';
import type { AgentLoopResponse, RunAgentLoopParams } from '@/lib/run-agent-loop';
import { CONTINUING_TURN_ANSWER, visibleTurnAnswer } from '@/components/flow/chat-output';
import { isColdStartStatus } from '@/lib/cold-start-fetch';

export type AgentLoopStreamProgress = {
  type: string;
  step: string;
  message: string;
};

export type AgentLoopStreamHandlers = {
  /** Called synchronously per event and never awaited, so a slow render cannot hold the reader. */
  onProgress?: (progress: AgentLoopStreamProgress) => void;
  onDelta?: (text: string) => void;
  onReplace?: (text: string) => void;
  onPreview?: (preview: {
    text?: string;
    tool_results?: AgentLoopResponse['tool_results'];
  }) => void;
  onSession?: (sessionId: string) => void;
  /** The saved session, when the stream has gone quiet or closed before a result. */
  recover?: () => Promise<AgentLoopResponse | null>;
  signal?: AbortSignal;
};

/** How long a quiet stream waits before the saved session is read. */
export const STREAM_QUIET_MS = 8_000;

function readDistinctId(): string | undefined {
  try {
    const id = posthog.get_distinct_id?.();
    return typeof id === 'string' && id ? id : undefined;
  } catch {
    return undefined;
  }
}

function captureStreamStatus(
  status: number,
  sessionId: string | null | undefined,
  distinctId: string | undefined
) {
  if (status < 400) return;
  const properties = {
    where: 'agent_stream',
    status,
    http_status: status,
    analysis_type: null,
    error_message: `agent stream ${status}`.slice(0, 200),
    session_id: sessionId ?? null,
    distinct_id: distinctId ?? null,
  };
  captureProductEvent('analysis_failed', properties);
  captureProductEvent('stream_error', properties);
  try {
    posthog.captureException(new Error(`agent stream ${status}`), properties);
  } catch {
    // A failed capture must not hide the stream error.
  }
}

function processSseLine(
  line: string,
  handlers: AgentLoopStreamHandlers,
  acc: {
    result: AgentLoopResponse | null;
    timeout: AgentLoopResponse | null;
    draft: { text: string; status: string } | null;
  }
) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('data:')) return;
  const jsonStr = trimmed.slice(5).trim();
  if (!jsonStr) return;

  let payload: {
    type?: string;
    step?: string;
    name?: string;
    message?: string;
    text?: string;
    status?: string;
    replace?: boolean;
    tool_results?: AgentLoopResponse['tool_results'];
    response?: AgentLoopResponse;
    session_id?: string;
    answer_markdown?: string;
  };
  try {
    payload = JSON.parse(jsonStr);
  } catch {
    return;
  }

  if (payload.type === 'session' && payload.session_id) {
    handlers.onSession?.(payload.session_id);
    return;
  }

  if (payload.type === 'preview') {
    handlers.onPreview?.({ text: payload.text, tool_results: payload.tool_results });
    if (payload.text) handlers.onReplace?.(payload.text);
    return;
  }

  if (payload.type === 'delta' && payload.text) {
    if (payload.replace) handlers.onReplace?.(payload.text);
    else handlers.onDelta?.(payload.text);
    return;
  }

  if (payload.type === 'tool') {
    const step = payload.name || payload.step || 'tool';
    const message = payload.message || `Running ${step.replace(/_/g, ' ')}`;
    handlers.onProgress?.({
      type: 'tool',
      step,
      message,
    });
    return;
  }

  if (
    payload.type === 'progress' ||
    payload.type === 'tool_start' ||
    payload.type === 'tool_result'
  ) {
    if (payload.message) {
      handlers.onProgress?.({
        type: payload.type,
        step: payload.step ?? 'progress',
        message: payload.message,
      });
    }
    return;
  }

  if (payload.type === 'error') {
    captureProductEvent('analysis_failed', {
      where: 'agent_stream',
      status: 'error',
      analysis_type: null,
      error_message: String(payload.message || 'Agent loop stream failed').slice(0, 200),
      message: payload.message || 'Agent loop stream failed',
    });
    captureProductEvent('stream_error', {
      where: 'agent_stream',
      message: payload.message || 'Agent loop stream failed',
    });
    throw new Error(payload.message || 'Agent loop stream failed');
  }

  if (payload.type === 'timeout' && payload.response) {
    acc.timeout = payload.response;
    return;
  }

  if (payload.type === 'final') {
    acc.draft = {
      text: typeof payload.text === 'string' ? payload.text : '',
      status: typeof payload.status === 'string' ? payload.status : 'ok',
    };
    return;
  }

  if (payload.type === 'result') {
    if (payload.response) {
      acc.result = payload.response;
      return;
    }
    // Older synthetic gateway events put status on the event itself.
    if (typeof payload.status === 'string') {
      acc.result = {
        status: payload.status,
        mode: 'agent',
        session_id: payload.session_id,
        answer_markdown:
          typeof payload.answer_markdown === 'string'
            ? payload.answer_markdown
            : typeof payload.text === 'string'
              ? payload.text
              : '',
      };
    }
  }
}

function withVisibleAnswer(result: AgentLoopResponse): AgentLoopResponse {
  const answer = visibleTurnAnswer(result.status, result.answer_markdown || '');
  if (answer === (result.answer_markdown || '')) return result;
  return { ...result, answer_markdown: answer };
}

async function readSavedTurn(handlers: AgentLoopStreamHandlers): Promise<AgentLoopResponse | null> {
  if (!handlers.recover) return null;
  try {
    return (await handlers.recover()) ?? null;
  } catch {
    return null;
  }
}

function nextStreamRead(
  pending: Promise<ReadableStreamReadResult<Uint8Array>>,
  quietMs: number
): Promise<ReadableStreamReadResult<Uint8Array> | 'quiet'> {
  if (quietMs <= 0) return pending;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve('quiet'), quietMs);
    pending.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      error => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/**
 * POST /assistant/agent-loop/stream — SSE progress + final result envelope.
 */
export async function streamAgentLoop(
  params: RunAgentLoopParams,
  handlers: AgentLoopStreamHandlers = {}
): Promise<AgentLoopResponse> {
  const token = getStytchBearerForTensrApi();
  if (!token) {
    throw new Error('No authentication token found');
  }

  const v2 = params.agentVersion === 'v2';
  const distinctId = readDistinctId();
  const response = await fetch(
    tensrApiUrl(v2 ? '/assistant/agent-loop-v2/stream' : '/assistant/agent-loop/stream'),
    {
      method: 'POST',
      cache: 'no-store',
      headers: {
        ...getTensrApiHeaders(),
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        Authorization: `Bearer ${token}`,
        ...(distinctId ? { 'X-Tensr-Distinct-Id': distinctId } : {}),
      },
      body: JSON.stringify(
        v2
          ? {
              message: params.resume ? '' : params.message,
              mode: params.mode,
              dataset_id: params.datasetId ?? null,
              session_id: params.sessionId ?? null,
              resume: Boolean(params.resume || params.approvedBatch),
              approved_batch: params.approvedBatch ?? null,
              attachments: params.attachments ?? null,
              approved_tool_call: params.approvedToolCall ?? null,
              approved_tool_calls: params.approvedToolCalls ?? null,
            }
          : {
              message: params.message,
              mode: params.mode,
              dataset_id: params.datasetId ?? null,
              open_datasets: params.openDatasets ?? [],
              conversation_history: params.conversationHistory ?? null,
              glossary: params.glossary ?? null,
              approved_tool_call: params.approvedToolCall ?? null,
              approved_tool_calls: params.approvedToolCalls ?? null,
              attachments: params.attachments ?? null,
            }
      ),
      signal: handlers.signal,
    }
  );

  const upstreamBusy = Number(response.headers?.get('X-Tensr-Upstream-Status') || 0);

  if (!response.ok) {
    const errorText = await response.text();
    captureStreamStatus(response.status, params.sessionId, distinctId);
    if (handleUnauthorizedResponse(response)) {
      throw new ApiRequestError(401, errorText);
    }
    throw new ApiRequestError(response.status, errorText);
  }

  if (!response.body) {
    throw new Error('Streaming not supported in this browser');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const acc: {
    result: AgentLoopResponse | null;
    timeout: AgentLoopResponse | null;
    draft: { text: string; status: string } | null;
  } = {
    result: null,
    timeout: null,
    draft: null,
  };

  try {
    let pending: Promise<ReadableStreamReadResult<Uint8Array>> | null = null;
    while (!acc.result) {
      if (!pending) pending = reader.read();
      const winner = await nextStreamRead(pending, handlers.recover ? STREAM_QUIET_MS : 0);
      if (winner === 'quiet') {
        const saved = await readSavedTurn(handlers);
        if (saved) acc.result = saved;
        continue;
      }
      pending = null;
      if (winner.done) break;
      buffer += decoder.decode(winner.value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        processSseLine(line, handlers, acc);
        if (acc.result) break;
      }
    }

    if (!acc.result && buffer.trim()) {
      processSseLine(buffer, handlers, acc);
    }
    if (!acc.result) {
      const saved = await readSavedTurn(handlers);
      if (saved) acc.result = saved;
    }
  } catch (error) {
    const saved = await readSavedTurn(handlers);
    if (!saved) throw error;
    acc.result = saved;
  } finally {
    if (acc.result) {
      try {
        void reader.cancel().catch(() => undefined);
      } catch {
        // Some readers do not implement cancel; releasing the lock is enough.
      }
    }
    reader.releaseLock();
  }

  if (acc.timeout) {
    throw new ApiRequestError(
      504,
      JSON.stringify({
        detail: {
          error: 'agent_loop_timeout',
          message: acc.timeout.answer_markdown || 'The AI service timed out.',
          status: 'timeout',
        },
      })
    );
  }

  if (acc.result?.status === 'timeout') {
    throw new ApiRequestError(
      504,
      JSON.stringify({
        detail: {
          error: 'agent_loop_timeout',
          message: acc.result.answer_markdown || 'The AI service timed out.',
          status: 'timeout',
        },
      })
    );
  }

  if (!acc.result && acc.draft) {
    acc.result = {
      status: acc.draft.status === 'continuing' ? 'ok' : acc.draft.status,
      mode: params.mode,
      answer_markdown: acc.draft.text,
    };
  }

  if (!acc.result) {
    if (isColdStartStatus(upstreamBusy)) {
      captureStreamStatus(upstreamBusy, params.sessionId, distinctId);
      throw new ApiRequestError(upstreamBusy, 'Service Unavailable');
    }
    const closed = new Error('The reply did not finish. Ask again.');
    closed.name = 'AgentStreamClosed';
    throw closed;
  }

  // Proxy maps a hard 502/503/504 into a fake "continuing" SSE. Treat that as
  // unreachable so the caller can backoff-retry on the same session id instead
  // of hopping resume and minting duplicate chats.
  if (
    isColdStartStatus(upstreamBusy) &&
    acc.result.status === 'continuing' &&
    isGatewayBusyPlaceholder(acc.result)
  ) {
    captureStreamStatus(upstreamBusy, params.sessionId, distinctId);
    throw new ApiRequestError(upstreamBusy, 'Service Unavailable');
  }

  if (params.agentVersion === 'v2' && acc.result.status === 'continuing') {
    const hops = (params.resumeHops ?? 0) + 1;
    if (hops > 3) {
      return withVisibleAnswer({ ...acc.result, status: 'ok' });
    }
    handlers.onDelta?.('\n\n');
    handlers.onProgress?.({
      type: 'progress',
      step: 'resume',
      message: 'Continuing this turn',
    });
    return streamAgentLoop(
      {
        ...params,
        message: '',
        resume: true,
        approvedBatch: null,
        sessionId: acc.result.session_id ?? params.sessionId,
        resumeHops: hops,
      },
      handlers
    );
  }

  return withVisibleAnswer(acc.result);
}

function isGatewayBusyPlaceholder(result: AgentLoopResponse): boolean {
  if (result.tool_results?.length) return false;
  const answer = (result.answer_markdown || '').trim();
  return !answer || answer === CONTINUING_TURN_ANSWER || /still running/i.test(answer);
}
