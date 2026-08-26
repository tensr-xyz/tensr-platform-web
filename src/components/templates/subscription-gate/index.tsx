'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Loading from '@/components/molecules/loading';
import { Button } from '@/components/atoms/button';
import { useAuth } from '@/hooks/api/use-auth';
import { fetchMeProfile } from '@/lib/business-api';
import { redirectToLogin } from '@/lib/session-expired';
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

function ProfileLoadError({
  detail,
  onRetry,
  onSignIn,
}: {
  detail: string;
  onRetry: () => void;
  onSignIn: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex min-h-dvh w-full flex-col items-center justify-center gap-4 bg-background px-6">
      <h1 className="text-base font-medium">Could not load your profile</h1>
      <p className="max-w-md text-center text-sm text-muted-foreground">
        {detail || 'The server returned an error. Retry, or sign in again if your session expired.'}
      </p>
      <div className="flex gap-2">
        <Button type="button" onClick={onRetry}>
          Try again
        </Button>
        <Button type="button" variant="outline" onClick={onSignIn}>
          Sign in again
        </Button>
      </div>
    </div>
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
  const [profileError, setProfileError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    if (!isAuthReady || isLoading) return;
    if (isSubscribed) {
      setProfileError(null);
      return;
    }

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
            setProfileError(null);
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
        setProfileError(null);
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
      } catch (err) {
        if (cancelled) return;
        // Do not replace-loop on stale null entitlements. A persistent /me 500
        // is not a missing subscription and is not a 401 — surface it instead
        // of spinning forever.
        if (checkoutSuccess) {
          pollAfterCheckout();
          return;
        }
        setProfileError(err instanceof Error ? err.message : 'Could not load your profile');
      } finally {
        verifyingRef.current = false;
      }
    };

    void verifyThenMaybeRedirect();

    return () => {
      cancelled = true;
    };
  }, [
    isSubscribed,
    isAuthReady,
    isLoading,
    pathname,
    router,
    searchParams,
    setEntitlements,
    retryNonce,
  ]);

  if (!isAuthReady || isLoading) {
    return <Loading fullScreen />;
  }

  if (profileError && !isSubscribed) {
    return (
      <ProfileLoadError
        detail={profileError}
        onRetry={() => {
          verifyingRef.current = false;
          setProfileError(null);
          setRetryNonce(n => n + 1);
        }}
        onSignIn={() => redirectToLogin()}
      />
    );
  }

  if (!isSubscribed) {
    return <Loading fullScreen />;
  }

  return <>{children}</>;
}
