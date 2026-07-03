import { getSessionJwt, getSessionToken, getTensrApiHeaders } from '@/utils/auth';
import { tensrApiUrl } from '@/lib/tensr-api-url';
import { ApiRequestError } from '@/lib/api-error';
import { handleUnauthorizedResponse } from '@/lib/session-expired';

export type AssistantFollowupStreamResult = {
  answer_markdown: string;
  source: string;
};

type StreamHandlers = {
  onDelta: (text: string, fullText: string) => void;
  signal?: AbortSignal;
};

/**
 * POST /assistant/followup/stream — SSE token stream from tensr-api.
 */
export async function streamAssistantFollowup(
  data: {
    datasetId: string;
    message: string;
    context?: Record<string, unknown> | null;
    conversationHistory?: Array<{ role: string; content: string }>;
  },
  handlers: StreamHandlers
): Promise<AssistantFollowupStreamResult> {
  const token = getSessionJwt() || getSessionToken();
  if (!token) {
    throw new Error('No authentication token found');
  }

  const response = await fetch(tensrApiUrl('/assistant/followup/stream'), {
    method: 'POST',
    headers: {
      ...getTensrApiHeaders(),
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      dataset_id: data.datasetId,
      message: data.message,
      context: data.context ?? null,
      conversation_history: data.conversationHistory ?? null,
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
  let fullText = '';
  let doneResult: AssistantFollowupStreamResult | null = null;

  const processLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) return;
    const jsonStr = trimmed.slice(5).trim();
    if (!jsonStr) return;

    let payload: {
      type?: string;
      text?: string;
      answer_markdown?: string;
      source?: string;
      message?: string;
    };
    try {
      payload = JSON.parse(jsonStr);
    } catch {
      return;
    }

    if (payload.type === 'delta' && payload.text) {
      fullText += payload.text;
      handlers.onDelta(payload.text, fullText);
      return;
    }

    if (payload.type === 'error') {
      throw new Error(payload.message || 'Stream failed');
    }

    if (payload.type === 'done') {
      const answer = payload.answer_markdown?.trim() ?? fullText;
      fullText = answer || fullText;
      doneResult = {
        answer_markdown: fullText || '_No answer returned._',
        source: payload.source ?? 'llm',
      };
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        processLine(line);
        if (doneResult) return doneResult;
      }
    }

    if (buffer.trim()) {
      processLine(buffer);
      if (doneResult) return doneResult;
    }
  } finally {
    reader.releaseLock();
  }

  return {
    answer_markdown: fullText.trim() || '_No answer returned._',
    source: 'llm',
  };
}

/** Typewriter reveal when the API only returns a complete body (fallback). */
export async function revealAssistantText(
  fullText: string,
  onUpdate: (partial: string) => void,
  options?: { charsPerTick?: number; msPerTick?: number; signal?: AbortSignal }
): Promise<void> {
  const step = options?.charsPerTick ?? 4;
  const delay = options?.msPerTick ?? 12;
  let i = 0;
  while (i < fullText.length) {
    if (options?.signal?.aborted) {
      onUpdate(fullText);
      return;
    }
    i = Math.min(fullText.length, i + step);
    onUpdate(fullText.slice(0, i));
    await new Promise<void>(resolve => {
      window.setTimeout(resolve, delay);
    });
  }
  onUpdate(fullText);
}
