/** Turn tensr-api error bodies into user-facing chat messages. */

const ASSISTANT_ERROR_MESSAGES: Record<string, string> = {
  subscription_required:
    'An active subscription is required to use Tensr. Choose a plan to continue.',
  ai_assistant_not_in_plan:
    'Your plan does not include the AI assistant. Upgrade to **Pro** to enable natural-language chat, or use direct commands like `sort by Age desc` or `Run a t-test`.',
  assistant_budget_exhausted:
    'Your AI assistant allowance for this billing period is used up. Upgrade your plan or wait until next month.',
  assistant_request_cap_exhausted:
    'Your AI assistant request limit for this billing period is reached. Try again next month or upgrade your plan.',
};

export function formatApiErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Something went wrong. Please try again.';
  }

  const raw = error.message || '';
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const outer = JSON.parse(jsonMatch[0]) as { detail?: unknown };
      const detail = outer.detail;
      if (typeof detail === 'string' && detail.trim()) {
        return detail;
      }
      if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
        const d = detail as { error?: string; message?: string };
        if (d.error && ASSISTANT_ERROR_MESSAGES[d.error]) {
          return ASSISTANT_ERROR_MESSAGES[d.error];
        }
        if (typeof d.message === 'string' && d.message.trim()) {
          return d.message;
        }
      }
    } catch {
      // fall through
    }
  }

  if (raw.startsWith('API Error: 401')) {
    return 'Your session expired. Please sign in again.';
  }
  if (raw.startsWith('API Error: 403')) {
    return 'You do not have access to this dataset in your active organization.';
  }
  if (raw.startsWith('API Error: 402')) {
    return ASSISTANT_ERROR_MESSAGES.subscription_required;
  }
  if (raw.startsWith('API Error: 502')) {
    return 'The AI service is temporarily unavailable. Check that LLM_API_KEY is configured on the API, then try again.';
  }
  if (raw.startsWith('API Error: 503')) {
    return 'The AI service is warming up — wait a few seconds and try again.';
  }
  if (raw.startsWith('API Error: 504')) {
    return 'The AI service timed out. Try again, or use Manage to run the analysis manually.';
  }

  if (raw.startsWith('API Error:')) {
    const withoutPrefix = raw.replace(/^API Error:\s*\d+\s*-?\s*/, '').trim();
    if (withoutPrefix && !withoutPrefix.startsWith('{')) {
      return withoutPrefix;
    }
  }

  return raw || 'Something went wrong. Please try again.';
}

export class ApiRequestError extends Error {
  readonly status: number;

  constructor(status: number, bodyText: string) {
    super(`API Error: ${status} - ${bodyText}`);
    this.name = 'ApiRequestError';
    this.status = status;
  }
}

export function userMessageFromApiError(error: unknown): string {
  return formatApiErrorMessage(error);
}
