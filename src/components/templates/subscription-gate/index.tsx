'use client';

import { Suspense, useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Loading from '@/components/molecules/loading';
import { useAuth } from '@/hooks/api/use-auth';
import { fetchMeProfile } from '@/lib/business-api';
import { hasActiveSubscription, subscriptionRedirectPath } from '@/lib/subscription';
import { useAuthStore } from '@/stores/auth-store';

export function SubscriptionGate({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<Loading fullScreen />}>
      <SubscriptionGateInner>{children}</SubscriptionGateInner>
    </Suspense>
  );
}

function SubscriptionGateInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isAuthReady, isLoading, hasActiveSubscription: isSubscribed } = useAuth();
  const setEntitlements = useAuthStore(state => state.setEntitlements);
  const pollingRef = useRef(false);

  useEffect(() => {
    if (!isAuthReady || isLoading) return;
    if (isSubscribed) return;

    const checkoutSuccess = searchParams.get('checkout') === 'success';
    if (checkoutSuccess && !pollingRef.current) {
      pollingRef.current = true;
      let attempts = 0;
      const maxAttempts = 12;

      const poll = async () => {
        attempts += 1;
        try {
          const profile = await fetchMeProfile();
          setEntitlements(profile.entitlements);
          if (hasActiveSubscription(profile.entitlements)) {
            pollingRef.current = false;
            return;
          }
        } catch {
          // Webhook may still be processing.
        }

        if (attempts < maxAttempts) {
          window.setTimeout(() => {
            void poll();
          }, 1500);
          return;
        }

        pollingRef.current = false;
        const query = searchParams.toString();
        const returnTo = query ? `${pathname}?${query}` : pathname;
        router.replace(subscriptionRedirectPath(returnTo));
      };

      void poll();
      return;
    }

    const query = searchParams.toString();
    const returnTo = query ? `${pathname}?${query}` : pathname;
    router.replace(subscriptionRedirectPath(returnTo));
  }, [isSubscribed, isAuthReady, isLoading, pathname, router, searchParams, setEntitlements]);

  if (!isAuthReady || isLoading || !isSubscribed) {
    return <Loading fullScreen />;
  }

  return <>{children}</>;
}
