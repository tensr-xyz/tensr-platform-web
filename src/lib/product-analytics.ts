import posthog from 'posthog-js';

/** Product events for the login, upload, analysis, and report flows. */
export function captureProductEvent(event: string, properties?: Record<string, unknown>): void {
  try {
    posthog.capture(event, properties);
  } catch {
    // Analytics must not break the flow the user is in.
  }
}

export function captureProductException(
  error: unknown,
  properties?: Record<string, string | number | boolean | null>
): void {
  const err =
    error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'Unknown error');
  if (err.message.includes('Object Not Found Matching Id')) return;
  try {
    const captureException = (
      posthog as { captureException?: (error: Error, properties?: object) => void }
    ).captureException;
    if (typeof captureException === 'function') {
      captureException(err, properties);
      return;
    }
    posthog.capture('$exception', { message: err.message, name: err.name, ...properties });
  } catch {
    // Analytics must not break the flow the user is in.
  }
}

export function errorClass(error: unknown): string {
  if (
    error &&
    typeof error === 'object' &&
    'error_type' in error &&
    typeof (error as { error_type?: unknown }).error_type === 'string'
  ) {
    return (error as { error_type: string }).error_type;
  }
  if (error instanceof Error && error.name) return error.name;
  return 'Error';
}
