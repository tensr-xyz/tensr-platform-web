import { getSessionJwt, getSessionToken, getTensrApiHeaders } from '@/utils/auth';
import { tensrApiUrl } from '@/lib/tensr-api-url';
import { ApiRequestError } from '@/lib/api-error';
import { handleUnauthorizedResponse } from '@/lib/session-expired';
import type { AnalyzeResponse } from '@/lib/analysis-report-types';

export type AnalysisStreamProgress = {
  step: string;
  message: string;
};

export type AnalysisStreamHandlers = {
  onProgress: (progress: AnalysisStreamProgress) => void;
  signal?: AbortSignal;
};

/**
 * POST /datasets/{id}/analyze/{op}/stream — SSE progress + result envelope.
 */
export async function streamAgentAnalysisRun(
  datasetId: string,
  op: string,
  body: Record<string, unknown>,
  handlers: AnalysisStreamHandlers
): Promise<AnalyzeResponse> {
  const token = getSessionJwt() || getSessionToken();
  if (!token) {
    throw new Error('No authentication token found');
  }

  const response = await fetch(tensrApiUrl(`/datasets/${datasetId}/analyze/${op}/stream`), {
    method: 'POST',
    headers: {
      ...getTensrApiHeaders(),
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
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
  let result: AnalyzeResponse | null = null;

  const processLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) return;
    const jsonStr = trimmed.slice(5).trim();
    if (!jsonStr) return;

    let payload: {
      type?: string;
      step?: string;
      message?: string;
      result?: Record<string, unknown>;
      report?: Record<string, unknown>;
      run_id?: string;
    };
    try {
      payload = JSON.parse(jsonStr);
    } catch {
      return;
    }

    if (payload.type === 'progress' && payload.message) {
      handlers.onProgress({
        step: payload.step ?? 'progress',
        message: payload.message,
      });
      return;
    }

    if (payload.type === 'error') {
      throw new Error((payload as { message?: string }).message || 'Analysis stream failed');
    }

    if (payload.type === 'result') {
      result = {
        result: (payload.result ?? {}) as Record<string, unknown>,
        report: payload.report as AnalyzeResponse['report'],
        run_id: payload.run_id,
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
      }
    }

    if (buffer.trim()) {
      processLine(buffer);
    }
  } finally {
    reader.releaseLock();
  }

  if (!result) {
    throw new Error('Analysis stream ended without a result');
  }

  return result;
}
