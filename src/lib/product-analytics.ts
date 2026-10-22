import posthog from 'posthog-js';
import { recentApiRequestFailure } from '@/lib/api-error';
import { isLinkScannerMessage, LINK_SCANNER_SESSION_PROPERTY } from '@/lib/link-scanner';

const analysisStartedAt = new Map<string, number>();

export function productEnvironment(): 'prod' | 'dev' | 'local' {
  const host = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
  if (!host || host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]') {
    return 'local';
  }
  const vercel = (process.env.NEXT_PUBLIC_VERCEL_ENV || '').toLowerCase();
  if (vercel === 'production' || host === 'app.tensr.xyz') return 'prod';
  if (
    vercel === 'preview' ||
    vercel === 'development' ||
    host.endsWith('.vercel.app') ||
    host.startsWith('dev.')
  ) {
    return 'dev';
  }
  return 'prod';
}

function analysisKey(properties: Record<string, unknown>): string {
  return [properties.where, properties.analysis_type, properties.dataset_id]
    .map(value => String(value ?? ''))
    .join('|');
}

function httpStatus(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function withAnalysisProperties(
  event: string,
  properties: Record<string, unknown> | undefined
): Record<string, unknown> {
  const next: Record<string, unknown> = {
    ...(properties ?? {}),
    environment: productEnvironment(),
  };
  if (event === 'analysis_started') {
    analysisStartedAt.set(analysisKey(next), Date.now());
  }
  if (event === 'analysis_completed' && next.duration_ms == null) {
    const started = analysisStartedAt.get(analysisKey(next));
    if (started != null) next.duration_ms = Date.now() - started;
  }
  if (event === 'analysis_failed') {
    const recent = recentApiRequestFailure();
    const message = next.error_message ?? next.message ?? recent?.message ?? '';
    next.error_message = String(message).slice(0, 200);
    next.http_status =
      httpStatus(next.http_status) ?? httpStatus(next.status) ?? recent?.status ?? null;
    if (next.analysis_type == null) next.analysis_type = null;
  }
  return next;
}

/** Product events for the login, upload, analysis, and report flows. */
export function captureProductEvent(event: string, properties?: Record<string, unknown>): void {
  try {
    const payload = withAnalysisProperties(event, properties);
    posthog.register?.({ environment: payload.environment });
    posthog.capture(event, payload);
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
  if (isLinkScannerMessage(err.message)) {
    try {
      posthog.register_for_session({ [LINK_SCANNER_SESSION_PROPERTY]: true });
    } catch {
      // Analytics must not break the flow the user is in.
    }
    return;
  }
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
