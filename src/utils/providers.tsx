'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StytchProvider } from '@stytch/nextjs';
import { createStytchUIClient } from '@stytch/nextjs/ui';
import { useState } from 'react';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Global query defaults
            staleTime: 5 * 60 * 1000, // 5 minutes
            gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
            retry: (failureCount, error: any) => {
              // Don't retry on 4xx errors
              if (error?.status >= 400 && error?.status < 500) {
                return false;
              }
              // Retry up to 3 times for other errors
              return failureCount < 3;
            },
            retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
            refetchOnMount: true,
          },
          mutations: {
            // Global mutation defaults
            retry: 1,
            retryDelay: 1000,
          },
        },
      })
  );

  const publicToken = process.env.NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN;

  if (!publicToken) {
    throw new Error('Missing NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN environment variable');
  }

  const stytch = createStytchUIClient(publicToken);

  return (
    <QueryClientProvider client={queryClient}>
      <StytchProvider stytch={stytch}>{children}</StytchProvider>
    </QueryClientProvider>
  );
}
