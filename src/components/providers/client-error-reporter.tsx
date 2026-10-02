'use client';

import posthog from 'posthog-js';
import { Component, useEffect, type ReactNode } from 'react';

function capture(error: unknown) {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!token) return;
  const err = error instanceof Error ? error : new Error(String(error));
  posthog.captureException(err);
}

class RootErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    capture(error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
          <h1 className="text-base font-medium">Something went wrong</h1>
          <button
            type="button"
            className="rounded border px-3 py-1 text-sm"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function ClientErrorReporter({ children }: { children: ReactNode }) {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      capture(event.error ?? event.message);
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      capture(event.reason);
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return <RootErrorBoundary>{children}</RootErrorBoundary>;
}
