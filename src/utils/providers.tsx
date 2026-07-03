'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StytchProvider } from '@stytch/nextjs';
import { createStytchUIClient } from '@stytch/nextjs/ui';
import { useState } from 'react';
import { isTensrApiMisconfigured } from '@/lib/tensr-api-url';
import { SessionExpiredListener } from '@/components/session-expired-listener';
import { AuthProvider } from '@/contexts/auth-provider';

// Create the Stytch UI client ONCE at module scope. Creating it inside the
// component body (even via `useMemo`) made every render hand <StytchProvider/> a
// brand-new client instance, which triggered a setState-in-render warning
// ("Cannot update a component (StytchProvider) while rendering a different
// component (Providers)") and could cascade into an infinite render loop —
// presenting in the dev environment as an instant "crash" on load.
const PUBLIC_TOKEN = process.env.NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN;
if (typeof window !== 'undefined' && !PUBLIC_TOKEN) {
  // Surface the missing env var loudly but do not throw at module load on the
  // server, where Next.js would otherwise crash the entire client bundle.
  console.error('Missing NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN environment variable');
}
const STYTCH_CLIENT = PUBLIC_TOKEN ? createStytchUIClient(PUBLIC_TOKEN) : null;

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            gcTime: 10 * 60 * 1000,
            retry: (failureCount, error: any) => {
              if (error?.status >= 400 && error?.status < 500) {
                return false;
              }
              return failureCount < 3;
            },
            retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
            refetchOnMount: true,
          },
          mutations: {
            retry: 1,
            retryDelay: 1000,
          },
        },
      })
  );

  const configErrors: string[] = [];
  if (!PUBLIC_TOKEN) configErrors.push('NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN');
  if (isTensrApiMisconfigured()) {
    configErrors.push('NEXT_PUBLIC_TENSR_API_URL (or NEXT_PUBLIC_API_BASE_URL)');
  }

  if (!STYTCH_CLIENT || configErrors.length > 0) {
    return (
      <QueryClientProvider client={queryClient}>
        <div style={{ padding: 24 }}>
          <h2>Configuration error</h2>
          <p>Missing or invalid environment variable(s):</p>
          <ul>
            {configErrors.map(v => (
              <li key={v}>
                <code>{v}</code>
              </li>
            ))}
          </ul>
          <p>
            Set a production API URL (not localhost) and Stytch token before deploying. See{' '}
            <code>.env.example</code>.
          </p>
        </div>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <StytchProvider stytch={STYTCH_CLIENT}>
        <AuthProvider>
          <SessionExpiredListener />
          {children}
        </AuthProvider>
      </StytchProvider>
    </QueryClientProvider>
  );
}
