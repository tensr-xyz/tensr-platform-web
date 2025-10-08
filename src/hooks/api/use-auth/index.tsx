'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { clearAuthData } from '@/utils/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.tensr.xyz';

export const useAuth = () => {
  const {
    user,
    tokens,
    isLoading,
    error,
    setUser,
    setTokens,
    setLoading,
    setError,
    login,
    logout,
  } = useAuthStore();

  // Session state for the current auth flow
  const [session, setSession] = useState<string | null>(null);
  const router = useRouter();

  // Initiate authentication
  const initiateAuth = async (email: string) => {
    setLoading(true);
    setError(null);
    try {
      console.log('Initiating auth for email:', email);
      const response = await fetch(`${API_BASE_URL}/auth/initiate-auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Authentication failed');

      // Log the complete response for debugging
      console.log('Auth response received:', JSON.stringify(data));
      console.log('Session from response:', data.session);

      // Make sure session is being properly set
      if (data.session) {
        console.log('Setting session state with:', data.session);
        setSession(data.session);

        // Store session in localStorage
        localStorage.setItem('auth_session', data.session);
      } else {
        console.error('No session received from API');
      }

      setLoading(false);
      return data;
    } catch (error) {
      console.error('Auth initiation failed:', error);
      setError(error instanceof Error ? error.message : 'Authentication failed');
      setLoading(false);
      throw error;
    }
  };

  // Verify authentication with OTP
  const verifyAuth = async (email: string, otp: string, authSession?: string) => {
    setLoading(true);
    setError(null);

    try {
      // Use provided session or fall back to state
      const sessionToUse = authSession || session;

      console.log('Verifying auth with session:', sessionToUse);

      if (!sessionToUse) {
        console.error('No session available for verification');
        setError('Your session has expired. Please try again.');
        setLoading(false);
        return {
          success: false,
          code: 'SESSION_EXPIRED',
          message: 'Your session has expired. Please try again.',
        };
      }

      const response = await fetch(`${API_BASE_URL}/auth/verify-auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          otp,
          session: sessionToUse,
        }),
      });

      const responseData = await response.json();

      // Parse the body from the response if it's a stringified JSON
      let data;
      if (responseData.body && typeof responseData.body === 'string') {
        data = JSON.parse(responseData.body);
      } else {
        data = responseData;
      }

      if (!response.ok) {
        setError(data.message || 'Verification failed');
        setLoading(false);
        return {
          success: false,
          code: data.code || 'ERROR',
          message: data.message || 'Verification failed',
        };
      }

      // Handle success case
      if (data.tokens) {
        console.log('🔥🔥🔥 NEW AUTH SYSTEM WORKING 🔥🔥🔥');
        console.log('useAuth: Auth verified successfully, calling setTokens...');
        const { accessToken, idToken, refreshToken } = data.tokens;

        // Ensure refreshToken is always a string
        const safeRefreshToken = refreshToken || '';

        console.log('useAuth: Calling Zustand setTokens...');
        // Store tokens in Zustand store (which will handle localStorage/cookies)
        setTokens({ accessToken, idToken, refreshToken: safeRefreshToken });
        console.log('useAuth: setTokens called, tokens should be stored now');

        if (data.user) {
          console.log('useAuth: Setting user data');
          setUser(data.user);
        }
      }

      // Clear session after successful verification
      setSession(null);
      localStorage.removeItem('auth_session');

      setLoading(false);
      return { success: true, data };
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

  // Handle logout
  const handleLogout = () => {
    clearAuthData();
    logout();
    setSession(null);
    localStorage.removeItem('auth_session');
    router.push('/');
  };

  // Resend verification code
  const resendVerificationCode = async (email: string, authSession?: string) => {
    setLoading(true);
    setError(null);

    try {
      // Use provided session or fall back to state
      const sessionToUse = authSession || session;

      console.log('Resending code for email:', email, 'with session:', sessionToUse);

      if (!sessionToUse) {
        throw new Error('No active session available');
      }

      const response = await fetch(`${API_BASE_URL}/auth/resend-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          session: sessionToUse,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to resend code');

      // Parse the data if needed
      const parsedData = data.body ? JSON.parse(data.body) : data;

      // Update the session state
      if (parsedData.session) {
        console.log('New session received:', parsedData.session);
        setSession(parsedData.session);
      }

      setError(null);
      setLoading(false);

      return parsedData;
    } catch (error) {
      console.error('Resend code failed:', error);
      setError(error instanceof Error ? error.message : 'Failed to resend code');
      setLoading(false);
      throw error;
    }
  };

  return {
    user,
    tokens,
    isLoading,
    error,
    isAuthenticated: !!user,
    session,
    initiateAuth,
    verifyAuth,
    handleLogout,
    resendVerificationCode,
  };
};

export default useAuth;
