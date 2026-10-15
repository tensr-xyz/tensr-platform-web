import posthog from 'posthog-js';

const MISSING_OBJECT = 'Object Not Found Matching Id';

function mentionsMissingObject(value: unknown, depth = 0, seen = new Set<unknown>()): boolean {
  if (depth > 8 || value == null) return false;
  if (typeof value === 'string') return value.includes(MISSING_OBJECT);
  if (typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  const entries = Array.isArray(value) ? value : Object.values(value as Record<string, unknown>);
  for (const entry of entries) {
    if (mentionsMissingObject(entry, depth + 1, seen)) return true;
  }
  return false;
}

const posthogToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

if (posthogToken) {
  posthog.init(posthogToken, {
    api_host: '/ingest',
    ui_host: 'https://us.posthog.com',
    defaults: '2026-01-30',
    capture_exceptions: true,
    before_send: event => (mentionsMissingObject(event) ? null : event),
    loaded: client => {
      const capture = client.captureException?.bind(client);
      if (!capture) return;
      client.captureException = ((error, properties) => {
        const message = error instanceof Error ? error.message : String(error ?? '');
        if (message.includes('Object Not Found Matching Id')) return undefined;
        return capture(error, properties);
      }) as typeof client.captureException;
    },
    session_recording: {
      maskAllInputs: true,
    },
    debug: process.env.NODE_ENV === 'development',
  });
}
