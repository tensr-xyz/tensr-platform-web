/**
 * Microsoft Outlook / Defender Safe Links opens outreach links in a headless
 * browser. That browser throws a synthetic error PostHog records as $exception:
 * "Object Not Found Matching Id:3, MethodName:update, ParamCount:4"
 * (the id is usually 1–3). Unhandled rejections use the same sentence prefixed
 * with "Non-Error promise rejection captured with value: ".
 * Add further scanner fingerprints to LINK_SCANNER_MESSAGE_PATTERNS.
 */
export const LINK_SCANNER_MESSAGE_PATTERNS: readonly RegExp[] = [
  /Object Not Found Matching Id:\d+, MethodName:update, ParamCount:\d+/,
];

/** Session property set once a scanner exception is seen. Filter on this in PostHog. */
export const LINK_SCANNER_SESSION_PROPERTY = 'is_link_scanner';

export function isLinkScannerMessage(message: string): boolean {
  return LINK_SCANNER_MESSAGE_PATTERNS.some(pattern => pattern.test(message));
}

type AnalyticsEvent = {
  event?: string;
  properties?: object | null;
} | null;

function exceptionMessages(event: NonNullable<AnalyticsEvent>): string[] {
  const properties = event.properties as Record<string, unknown> | null | undefined;
  if (!properties) return [];
  const messages: string[] = [];
  for (const key of ['$exception_message', 'message']) {
    const value = properties[key];
    if (typeof value === 'string') messages.push(value);
  }
  const list = properties.$exception_list;
  if (!Array.isArray(list)) return messages;
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const value = (item as { value?: unknown }).value;
    if (typeof value === 'string') messages.push(value);
  }
  return messages;
}

export function isLinkScannerExceptionEvent(event: AnalyticsEvent): boolean {
  if (!event || event.event !== '$exception') return false;
  return exceptionMessages(event).some(isLinkScannerMessage);
}

/** Drop scanner $exception events and mark the session. Leave every other event alone. */
export function withoutLinkScannerException<T extends AnalyticsEvent>(
  event: T,
  markSession: () => void
): T | null {
  if (!isLinkScannerExceptionEvent(event)) return event;
  markSession();
  return null;
}
