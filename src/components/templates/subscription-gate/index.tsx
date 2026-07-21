'use client';

import { Suspense, useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Loading from '@/components/molecules/loading';
import { useAuth } from '@/hooks/api/use-auth';
import { fetchMeProfile } from '@/lib/business-api';
import {
  entitlementsResolved,
  hasActiveSubscription,
  subscriptionRedirectPath,
} from '@/lib/subscription';
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
  const verifyingRef = useRef(false);

  useEffect(() => {
    if (!isAuthReady || isLoading) return;
    if (isSubscribed) return;

    let cancelled = false;

    const returnToPath = () => {
      const query = searchParams.toString();
      return query ? `${pathname}?${query}` : pathname;
    };

    const redirectUnpaid = () => {
      router.replace(subscriptionRedirectPath(returnToPath()));
    };

    const checkoutSuccess = searchParams.get('checkout') === 'success';

    const pollAfterCheckout = () => {
      if (pollingRef.current) return;
      pollingRef.current = true;
      let attempts = 0;
      const maxAttempts = 12;

      const poll = async () => {
        attempts += 1;
        try {
          const profile = await fetchMeProfile();
          if (cancelled) return;
          setEntitlements(profile.entitlements);
          if (hasActiveSubscription(profile.entitlements)) {
            pollingRef.current = false;
            return;
          }
        } catch {
          // Webhook may still be processing.
        }

        if (cancelled) return;

        if (attempts < maxAttempts) {
          window.setTimeout(() => {
            void poll();
          }, 1500);
          return;
        }

        pollingRef.current = false;
        redirectUnpaid();
      };

      void poll();
    };

    /**
     * Never trust Zustand alone for the unpaid bounce — promo/manual comps and
     * webhook lag can leave entitlements null/`none` while /api/me already has
     * an active plan. Always re-check before replace() so Back→dashboard cannot
     * trap entitled users in a replace loop on /subscription.
     */
    const verifyThenMaybeRedirect = async () => {
      if (verifyingRef.current) return;
      verifyingRef.current = true;
      try {
        const profile = await fetchMeProfile();
        if (cancelled) return;
        setEntitlements(profile.entitlements);
        if (hasActiveSubscription(profile.entitlements)) {
          return;
        }
        if (checkoutSuccess) {
          pollAfterCheckout();
          return;
        }
        // Only bounce once entitlements are a confirmed unpaid payload.
        if (entitlementsResolved(profile.entitlements)) {
          redirectUnpaid();
        }
      } catch {
        if (cancelled) return;
        // Profile fetch failed: do not replace-loop on stale null entitlements.
        // Keep showing the loading gate; AuthProvider / retry will recover.
        if (checkoutSuccess) {
          pollAfterCheckout();
        }
      } finally {
        verifyingRef.current = false;
      }
    };

    void verifyThenMaybeRedirect();

    return () => {
      cancelled = true;
    };
  }, [isSubscribed, isAuthReady, isLoading, pathname, router, searchParams, setEntitlements]);

  if (!isAuthReady || isLoading || !isSubscribed) {
    return <Loading fullScreen />;
  }

  return <>{children}</>;
}
