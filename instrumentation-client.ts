import posthog from 'posthog-js';

const posthogToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

if (posthogToken) {
  posthog.init(posthogToken, {
    api_host: '/ingest',
    ui_host: 'https://us.posthog.com',
    defaults: '2026-01-30',
    capture_exceptions: true,
    before_send: event => {
      const blob = JSON.stringify(event ?? {});
      if (blob.includes('Object Not Found Matching Id')) return null;
      return event;
    },
    session_recording: {
      maskAllInputs: true,
    },
    debug: process.env.NODE_ENV === 'development',
  });
}
