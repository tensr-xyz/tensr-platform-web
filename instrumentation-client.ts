import posthog from 'posthog-js';
import { LINK_SCANNER_SESSION_PROPERTY, withoutLinkScannerException } from '@/lib/link-scanner';
import { productEnvironment } from '@/lib/product-analytics';

const posthogToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

if (posthogToken) {
  posthog.init(posthogToken, {
    api_host: '/ingest',
    ui_host: 'https://us.posthog.com',
    defaults: '2026-01-30',
    // Cookie is set on .tensr.xyz so www.tensr.xyz and app.tensr.xyz share a distinct_id.
    cross_subdomain_cookie: true,
    persistence: 'localStorage+cookie',
    capture_exceptions: true,
    before_send: event => {
      const tagged = event
        ? {
            ...event,
            properties: {
              ...((event.properties as Record<string, unknown> | null) ?? {}),
              environment: productEnvironment(),
            },
          }
        : event;
      return withoutLinkScannerException(tagged, () => {
        posthog.register_for_session({ [LINK_SCANNER_SESSION_PROPERTY]: true });
      });
    },
    session_recording: {
      maskAllInputs: true,
    },
    debug: process.env.NODE_ENV === 'development',
  });
}
