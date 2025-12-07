'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useStytch, useStytchUser, useStytchSession } from '@stytch/nextjs';
import { useAuthStore } from '@/stores/auth-store';
import { clearAuthData, storeSession } from '@/utils/auth';

export const useAuth = () => {
  const stytch = useStytch();
  const { user: stytchUser } = useStytchUser();
  const { session: stytchSession } = useStytchSession();

  const {
    user,
    session,
    isLoading,
    error,
    setUser,
    setSession,
    setLoading,
    setError,
    login,
    logout,
  } = useAuthStore();

  // Local state for OTP flow
  const [methodId, setMethodId] = useState<string | null>(null);
  const router = useRouter();

  // Initiate authentication with email OTP
  const initiateAuth = async (email: string) => {
    setLoading(true);
    setError(null);
    try {
      console.log('Initiating Stytch auth for email:', email);

      if (!stytch) {
        throw new Error('Stytch client not initialized');
      }

      const response = await stytch.otps.email.loginOrCreate(email);

      if (response.status_code !== 200) {
        throw new Error(response.error_message || 'Failed to send verification code');
      }

      const methodIdValue = response.email_id || response.method_id;
      setMethodId(methodIdValue || '');

      setLoading(false);
      return {
        message: 'Verification code sent successfully',
        methodId: methodIdValue,
      };
    } catch (error) {
      console.error('Auth initiation failed:', error);
      setError(error instanceof Error ? error.message : 'Authentication failed');
      setLoading(false);
      throw error;
    }
  };

  // Verify authentication with OTP
  const verifyAuth = async (email: string, otp: string, verifyMethodId?: string) => {
    setLoading(true);
    setError(null);

    try {
      const methodIdToUse = verifyMethodId || methodId;

      console.log('Verifying auth with methodId:', methodIdToUse);

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

      // Use a safe session duration (30 minutes) that should be within Stytch's limits
      const response = await stytch.otps.authenticate(otp, methodIdToUse, {
        session_duration_minutes: 30,
      });

      if (response.status_code !== 200) {
        setError(response.error_message || 'Verification failed');
        setLoading(false);
        return {
          success: false,
          code: 'VERIFICATION_FAILED',
          message: response.error_message || 'Verification failed',
        };
      }

      // Store session
      if (response.session_token) {
        setSession({
          sessionToken: response.session_token,
          sessionJwt: response.session_jwt,
        });
        // Persist to localStorage and cookies
        storeSession(response.session_token, response.session_jwt);
      }

      // Store user if available
      if (response.user) {
        const stytchUserData = response.user as any;
        const userData = {
          userId: stytchUserData.user_id,
          email: stytchUserData.emails?.[0]?.email || email,
          firstName: stytchUserData.name?.first_name,
          lastName: stytchUserData.name?.last_name,
          username: stytchUserData.name?.first_name,
          status: 'ACTIVE' as const,
          createdAt: stytchUserData.created_at || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setUser(userData);
      }

      // Clear method ID
      setMethodId(null);

      setLoading(false);
      return { success: true };
    } catch (error) {
      console.error('Auth verification failed:', error);
      setError(error instanceof Error ? error.message : 'Verification failed');
      setLoading(false);
      return {
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      };
    }
  };

  // Handle Google OAuth
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

  // Handle logout
  const handleLogout = async () => {
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
    router.push('/');
  };

  // Resend verification code
  const resendVerificationCode = async (email: string) => {
    setLoading(true);
    setError(null);

    try {
      console.log('Resending code for email:', email);

      if (!stytch) {
        throw new Error('Stytch client not initialized');
      }

      const response = await stytch.otps.email.loginOrCreate(email);

      if (response.status_code !== 200) {
        throw new Error(response.error_message || 'Failed to resend code');
      }

      const methodIdValue = response.email_id || response.method_id;
      setMethodId(methodIdValue || '');

      setError(null);
      setLoading(false);

      return {
        message: 'Verification code resent successfully',
        methodId: methodIdValue,
      };
    } catch (error) {
      console.error('Resend code failed:', error);
      setError(error instanceof Error ? error.message : 'Failed to resend code');
      setLoading(false);
      throw error;
    }
  };

  return {
    user,
    session,
    isLoading,
    error,
    isAuthenticated: !!user || !!stytchUser,
    methodId,
    initiateAuth,
    verifyAuth,
    initiateGoogleAuth,
    handleLogout,
    resendVerificationCode,
    // Also expose Stytch hooks for direct access if needed
    stytchUser,
    stytchSession,
    stytch,
  };
};

export default useAuth;
