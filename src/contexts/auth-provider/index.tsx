'use client';

import { useEffect } from 'react';
import { useStytch, useStytchSession } from '@stytch/nextjs';
import { useAuthStore } from '@/stores/auth-store';
import { fetchMeProfile, redeemStoredInvitation } from '@/lib/business-api';
import { redirectToLogin } from '@/lib/session-expired';
import { clearAuthData, getStoredSession, persistStytchTokensFromSdk } from '@/utils/auth';
import { authTrace } from '@/lib/auth-trace';
import { devLog } from '@/lib/dev-log';

/** Brief wait for Stytch to hydrate session from cookies after a hard refresh. */
const STYTCH_HYDRATION_MS = 1500;

function syncSessionTokens(
  stytch: ReturnType<typeof useStytch>,
  setSession: ReturnType<typeof useAuthStore.getState>['setSession']
) {
  const persisted = persistStytchTokensFromSdk(stytch);
  if (persisted) {
    setSession({
      sessionToken: persisted.sessionToken,
      sessionJwt: persisted.sessionJwt,
    });
    return true;
  }

  const stored = getStoredSession();
  if (stored) {
    setSession({
      sessionToken: stored.sessionToken,
      sessionJwt: stored.sessionJwt ?? undefined,
    });
    return true;
  }

  return false;
}

function clearLocalAuth(
  setUser: ReturnType<typeof useAuthStore.getState>['setUser'],
  setEntitlements: ReturnType<typeof useAuthStore.getState>['setEntitlements'],
  setSession: ReturnType<typeof useAuthStore.getState>['setSession']
) {
  clearAuthData();
  setUser(null);
  setEntitlements(null);
  setSession(null);
}

function isAuthFetchFailure(err: unknown): boolean {
  return err instanceof Error && err.message === 'Session expired';
}

/** Single owner of auth state: mirrors Stytch session into Zustand. */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const stytch = useStytch();
  const { session, isInitialized } = useStytchSession();
  const { setUser, setEntitlements, setSession, setLoading, setInitialized } = useAuthStore();

  // Whenever the SDK has tokens, mirror them to localStorage + cookies (not just memory).
  useEffect(() => {
    if (!stytch) return;

    const syncTokensToCookies = () => {
      persistStytchTokensFromSdk(stytch);
    };

    syncTokensToCookies();

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        syncTokensToCookies();
      }
    };

    window.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', syncTokensToCookies);

    const interval = window.setInterval(syncTokensToCookies, 4 * 60 * 1000);

    return () => {
      window.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', syncTokensToCookies);
      window.clearInterval(interval);
    };
  }, [stytch, session]);

  useEffect(() => {
    setInitialized(isInitialized);

    if (!isInitialized) {
      authTrace('AuthProvider:waiting-for-stytch');
      return;
    }

    let cancelled = false;

    const loadProfile = (source: 'stytch-session' | 'stored-tokens', attempt = 0) => {
      setLoading(true);

      void fetchMeProfile()
        .then(profile => {
          if (cancelled) return;
          setUser(profile.user);
          setEntitlements(profile.entitlements);
          authTrace('AuthProvider:user-loaded', {
            userId: profile.user.userId,
            source,
            planCode: profile.entitlements?.plan_code,
          });
          void redeemStoredInvitation().catch(() => undefined);
          setLoading(false);
          authTrace('AuthProvider:ready');
        })
        .catch(err => {
          if (cancelled) return;
          authTrace('AuthProvider:user-fetch-failed', {
            source,
            attempt,
            message: err instanceof Error ? err.message : String(err),
          });
          devLog('Failed to load user profile:', err);

          if (!isAuthFetchFailure(err)) {
            // Transient /me failures must not leave entitlements null forever —
            // that looks like unpaid and traps users on /subscription.
            if (attempt < 2) {
              window.setTimeout(
                () => {
                  if (!cancelled) loadProfile(source, attempt + 1);
                },
                750 * (attempt + 1)
              );
              return;
            }
            setLoading(false);
            authTrace('AuthProvider:ready-without-profile');
            return;
          }

          clearLocalAuth(setUser, setEntitlements, setSession);
          setLoading(false);
          redirectToLogin();
        });
    };

    if (session) {
      authTrace('AuthProvider:session-present', {
        sessionId: (session as { session_id?: string }).session_id,
      });
      syncSessionTokens(stytch, setSession);
      loadProfile('stytch-session');
      return () => {
        cancelled = true;
      };
    }

    const stored = getStoredSession();
    if (stored) {
      const persisted = persistStytchTokensFromSdk(stytch);
      if (persisted) {
        authTrace('AuthProvider:hydrate-from-sdk-tokens');
        setSession({
          sessionToken: persisted.sessionToken,
          sessionJwt: persisted.sessionJwt,
        });
        loadProfile('stytch-session');
        return () => {
          cancelled = true;
        };
      }

      authTrace('AuthProvider:tokens-waiting-for-stytch-session');
      setLoading(true);

      const timer = window.setTimeout(() => {
        if (cancelled) return;

        const stillStored = getStoredSession();
        if (!stillStored) {
          authTrace('AuthProvider:stored-tokens-cleared-during-wait');
          clearLocalAuth(setUser, setEntitlements, setSession);
          setLoading(false);
          return;
        }

        persistStytchTokensFromSdk(stytch);
        syncSessionTokens(stytch, setSession);
        loadProfile('stored-tokens');
      }, STYTCH_HYDRATION_MS);

      return () => {
        cancelled = true;
        window.clearTimeout(timer);
      };
    }

    authTrace('AuthProvider:confirmed-logged-out');
    clearLocalAuth(setUser, setEntitlements, setSession);
    setLoading(false);

    return () => {
      cancelled = true;
    };
  }, [
    session,
    isInitialized,
    stytch,
    setUser,
    setEntitlements,
    setSession,
    setLoading,
    setInitialized,
  ]);

  return children;
}
