'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useStytch, useStytchUser, useStytchSession } from '@stytch/nextjs';
import { useAuthStore } from '@/stores/auth-store';
import { clearAuthData, getStoredSession, storeSession } from '@/utils/auth';
import { fetchMeProfile, redeemStoredInvitation, type MeProfile } from '@/lib/business-api';
import { hasActiveSubscription } from '@/lib/subscription';
import { STYTCH_SESSION_DURATION_MINUTES } from '@/lib/stytch-session';
import { stytchErrorMessage } from '@/lib/stytch-error-message';
import { devLog } from '@/lib/dev-log';
import posthog from 'posthog-js';

const PROFILE_LOAD_FAILED_MESSAGE = "We couldn't load your account. Please try again.";

async function fetchMeProfileWithRetry(): Promise<MeProfile> {
  try {
    return await fetchMeProfile();
  } catch (error) {
    // A 401 has already been handled by fetchMeProfile and will not succeed on retry.
    if (error instanceof Error && error.message === 'Session expired') throw error;
    return fetchMeProfile();
  }
}

export const useAuth = () => {
  const stytch = useStytch();
  const { user: stytchUser } = useStytchUser();
  const { session: stytchSession, isInitialized } = useStytchSession();

  const {
    user,
    entitlements,
    session,
    isLoading,
    error,
    setUser,
    setEntitlements,
    setSession,
    setLoading,
    setError,
    login,
    logout,
  } = useAuthStore();

  const [methodId, setMethodId] = useState<string | null>(null);
  const router = useRouter();

  const isAuthenticated = isInitialized && (!!stytchSession || !!session || !!getStoredSession());
  const isAuthReady = isInitialized && !isLoading;
  const hasSubscription = hasActiveSubscription(entitlements);

  const initiateAuth = async (email: string) => {
    setLoading(true);
    setError(null);
    try {
      devLog('Initiating Stytch auth for email:', email);

      if (!stytch) {
        throw new Error('Stytch client not initialized');
      }

      const response = await stytch.otps.email.loginOrCreate(email);

      if (response.status_code !== 200) {
        throw new Error((response as any).error_message || 'Failed to send verification code');
      }

      const methodIdValue = (response as any).email_id || (response as any).method_id;
      setMethodId(methodIdValue || '');

      setLoading(false);
      return {
        message: 'Verification code sent successfully',
        methodId: methodIdValue,
      };
    } catch (error) {
      console.error('Auth initiation failed:', error);
      const message = stytchErrorMessage(error, 'Failed to send verification code');
      setError(message);
      setLoading(false);
      throw new Error(message);
    }
  };

  const verifyAuth = async (email: string, otp: string, verifyMethodId?: string) => {
    setLoading(true);
    setError(null);

    try {
      const methodIdToUse = verifyMethodId || methodId;

      devLog('Verifying auth with methodId:', methodIdToUse);

      if (!methodIdToUse) {
        console.error('No methodId available for verification');
        setError('Session expired. Please request a new code.');
        setLoading(false);
        return {
          success: false,
          code: 'METHOD_ID_MISSING',
          message: 'Session expired. Please request a new code.',
        };
      }

      if (!stytch) {
        throw new Error('Stytch client not initialized');
      }

      const response = await stytch.otps.authenticate(otp, methodIdToUse, {
        session_duration_minutes: STYTCH_SESSION_DURATION_MINUTES,
      });

      if (response.status_code !== 200) {
        setError((response as any).error_message || 'Verification failed');
        setLoading(false);
        return {
          success: false,
          code: 'VERIFICATION_FAILED',
          message: (response as any).error_message || 'Verification failed',
        };
      }

      if (response.session_token) {
        storeSession(response.session_token, response.session_jwt);
        setSession({
          sessionToken: response.session_token,
          sessionJwt: response.session_jwt,
        });
      }

      let profile: MeProfile;
      try {
        profile = await fetchMeProfileWithRetry();
      } catch (profileError) {
        console.warn('Failed to load user from tensr-api:', profileError);
        setError(PROFILE_LOAD_FAILED_MESSAGE);
        setLoading(false);
        return {
          success: false,
          code: 'PROFILE_LOAD_FAILED',
          message: PROFILE_LOAD_FAILED_MESSAGE,
        };
      }

      setUser(profile.user);
      setEntitlements(profile.entitlements);
      try {
        await redeemStoredInvitation();
      } catch (inviteError) {
        console.warn('Failed to redeem stored invitation:', inviteError);
      }

      // Identify the user in PostHog so all future events are linked to their profile
      posthog.identify(profile.user.userId, {
        email: profile.user.email,
        firstName: profile.user.firstName,
        lastName: profile.user.lastName,
        plan: profile.entitlements?.plan_code,
      });
      posthog.capture('user_signed_in', { method: 'email_otp' });

      setMethodId(null);
      setLoading(false);
      return { success: true };
    } catch (error) {
      // The Stytch SDK throws (not returns) on a wrong/expired code.
      console.error('Auth verification failed:', error);
      const message = stytchErrorMessage(error, 'Verification failed. Please try again.');
      setError(message);
      setLoading(false);
      return {
        success: false,
        code: 'VERIFICATION_FAILED',
        message,
      };
    }
  };

  const initiateGoogleAuth = async () => {
    if (!stytch) {
      throw new Error('Stytch client not initialized');
    }

    try {
      const redirectUrl = new URL('/login', window.location.origin).toString();
      await stytch.oauth.google.start({
        login_redirect_url: redirectUrl,
        signup_redirect_url: redirectUrl,
      });
    } catch (error) {
      console.error('Google OAuth initiation failed:', error);
      throw error;
    }
  };

  const handleLogout = async () => {
    posthog.capture('user_signed_out');
    posthog.reset();

    try {
      if (stytch && stytchSession) {
        await stytch.session.revoke();
      }
    } catch (error) {
      console.error('Error revoking Stytch session:', error);
    }

    clearAuthData();
    logout();
    setMethodId(null);
    router.push('/login');
  };

  const resendVerificationCode = async (email: string) => {
    setLoading(true);
    setError(null);

    try {
      devLog('Resending code for email:', email);

      if (!stytch) {
        throw new Error('Stytch client not initialized');
      }

      const response = await stytch.otps.email.loginOrCreate(email);

      if (response.status_code !== 200) {
        throw new Error((response as any).error_message || 'Failed to resend code');
      }

      const methodIdValue = (response as any).email_id || (response as any).method_id;
      setMethodId(methodIdValue || '');

      setError(null);
      setLoading(false);

      return {
        message: 'Verification code resent successfully',
        methodId: methodIdValue,
      };
    } catch (error) {
      console.error('Resend code failed:', error);
      const message = stytchErrorMessage(error, 'Failed to resend code');
      setError(message);
      setLoading(false);
      throw new Error(message);
    }
  };

  return {
    user,
    entitlements,
    session,
    isLoading,
    error,
    isInitialized,
    isAuthenticated,
    isAuthReady,
    hasActiveSubscription: hasSubscription,
    methodId,
    initiateAuth,
    verifyAuth,
    initiateGoogleAuth,
    handleLogout,
    resendVerificationCode,
    login,
    setUser,
    setSession,
    stytchUser,
    stytchSession,
    stytch,
  };
};

export default useAuth;
