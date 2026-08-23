import { getStytchBearerForTensrApi, getTensrApiHeaders } from '@/utils/auth';
import { tensrApiUrl } from '@/lib/tensr-api-url';
import { ApiRequestError } from '@/lib/api-error';
import { handleUnauthorizedResponse } from '@/lib/session-expired';
import type { AgentLoopResponse, RunAgentLoopParams } from '@/lib/run-agent-loop';

export type AgentLoopStreamProgress = {
  type: string;
  step: string;
  message: string;
};

export type AgentLoopStreamHandlers = {
  onProgress?: (progress: AgentLoopStreamProgress) => void;
  signal?: AbortSignal;
};

function processSseLine(
  line: string,
  onProgress: AgentLoopStreamHandlers['onProgress'],
  acc: { result: AgentLoopResponse | null; timeout: AgentLoopResponse | null }
) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('data:')) return;
  const jsonStr = trimmed.slice(5).trim();
  if (!jsonStr) return;

  let payload: {
    type?: string;
    step?: string;
    message?: string;
    response?: AgentLoopResponse;
  };
  try {
    payload = JSON.parse(jsonStr);
  } catch {
    return;
  }

  if (
    payload.type === 'progress' ||
    payload.type === 'tool_start' ||
    payload.type === 'tool_result'
  ) {
    if (payload.message) {
      onProgress?.({
        type: payload.type,
        step: payload.step ?? 'progress',
        message: payload.message,
      });
    }
    return;
  }

  if (payload.type === 'error') {
    throw new Error(payload.message || 'Agent loop stream failed');
  }

  if (payload.type === 'timeout' && payload.response) {
    acc.timeout = payload.response;
    return;
  }

  if (payload.type === 'result' && payload.response) {
    acc.result = payload.response;
  }
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

  const response = await fetch(tensrApiUrl('/assistant/agent-loop/stream'), {
    method: 'POST',
    headers: {
      ...getTensrApiHeaders(),
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      message: params.message,
      mode: params.mode,
      dataset_id: params.datasetId ?? null,
      open_datasets: params.openDatasets ?? [],
      conversation_history: params.conversationHistory ?? null,
      glossary: params.glossary ?? null,
      approved_tool_call: params.approvedToolCall ?? null,
      approved_tool_calls: params.approvedToolCalls ?? null,
    }),
    signal: handlers.signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
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
  const acc: { result: AgentLoopResponse | null; timeout: AgentLoopResponse | null } = {
    result: null,
    timeout: null,
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        processSseLine(line, handlers.onProgress, acc);
      }
    }

    if (buffer.trim()) {
      processSseLine(buffer, handlers.onProgress, acc);
    }
  } finally {
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

  if (!acc.result) {
    throw new Error('Agent loop stream ended without a result');
  }

  return acc.result;
}
