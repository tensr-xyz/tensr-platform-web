'use client';
import { useRouter } from 'next/navigation';
import { useCallback, useState, useEffect, useRef } from 'react';

import { useAuthState } from '@/contexts/auth-context';
import { clearAuthData, getIdToken, storeTokens, getStoredTokens } from '@/utils/auth';
import { Actions } from '@/contexts/auth-context/types';
import { User } from '@/types/user'; // Make sure this import exists

// Make sure API_BASE_URL is properly defined
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'https://t8ioaf6fl9.execute-api.us-east-1.amazonaws.com';

// Define fetchUserData function that was missing
const fetchUserData = async (idToken: string, userId: string): Promise<User | null> => {
  try {
    const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Failed to fetch user data:', response.status);
      return null;
    }

    const userData = await response.json();
    return userData;
  } catch (error) {
    console.error('Error fetching user data:', error);
    return null;
  }
};

export const useAuth = () => {
  const { state, dispatch } = useAuthState();
  // Fix the session state type to string | null instead of just null
  const [session, setSession] = useState<string | null>(null);
  const router = useRouter();

  // Use a ref to track if we're in a browser environment
  const isBrowser = useRef(typeof window !== 'undefined');

  // Initialize from stored tokens on mount
  useEffect(() => {
    const initializeFromStoredTokens = async () => {
      if (!isBrowser.current) return;

      // First check if we already have a user in state
      if (state.user) return;

      try {
        // Get tokens from localStorage
        const storedTokens = getStoredTokens();

        if (!storedTokens || !storedTokens.idToken) {
          console.log('No valid tokens found in storage');
          return;
        }

        // Set tokens in state
        console.log('Restoring tokens from storage');
        dispatch({
          type: Actions.SET_TOKENS,
          payload: storedTokens,
        });

        // Use tokens to fetch user data
        const idToken = storedTokens.idToken;

        // Parse the JWT to get user ID
        const payload = JSON.parse(atob(idToken.split('.')[1]));
        const userId = payload.sub || payload.user_id;

        if (!userId) {
          console.error('No user ID found in token');
          return;
        }

        // Fetch user data with the token
        const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${idToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          console.error('Failed to fetch user data:', response.status);
          // If 401 or 403, the token is invalid - clear auth data
          if (response.status === 401 || response.status === 403) {
            clearAuthData();
          }
          return;
        }

        const userData = await response.json();

        // Set user in state
        console.log('Setting user data from stored tokens');
        dispatch({ type: Actions.SET_USER, payload: userData });
      } catch (error) {
        console.error('Error initializing from stored tokens:', error);
        // Clear potentially corrupted auth data
        clearAuthData();
      }
    };

    initializeFromStoredTokens();
  }, [dispatch, state.user]);

  // Initialize session from localStorage if available
  useEffect(() => {
    if (isBrowser.current) {
      const savedSession = localStorage.getItem('auth_session');
      if (savedSession) {
        try {
          console.log('Restoring session from storage');
          setSession(savedSession);
        } catch (e) {
          console.error('Failed to restore session:', e);
          localStorage.removeItem('auth_session');
        }
      }
    }
  }, []);

  // Persist session to localStorage when it changes
  useEffect(() => {
    if (isBrowser.current && session) {
      console.log('Storing session in localStorage');
      localStorage.setItem('auth_session', session);
    } else if (isBrowser.current && !session) {
      console.log('Clearing session from localStorage');
      localStorage.removeItem('auth_session');
    }
  }, [session]);

  // Initiate authentication
  const initiateAuth = useCallback(
    async (email: string) => {
      dispatch({ type: Actions.SET_LOADING, payload: true });
      dispatch({ type: Actions.SET_ERROR, payload: null });
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
          if (isBrowser.current) {
            console.log('Storing session in localStorage');
            localStorage.setItem('auth_session', data.session);
          }
        } else {
          console.error('No session received from API');
        }

        dispatch({ type: Actions.SET_LOADING, payload: false });
        return data;
      } catch (error) {
        console.error('Auth initiation failed:', error);
        dispatch({
          type: Actions.SET_ERROR,
          payload: error instanceof Error ? error.message : 'Authentication failed',
        });
        dispatch({ type: Actions.SET_LOADING, payload: false });
        throw error;
      }
    },
    [dispatch]
  );

  // Verify authentication with OTP
  const verifyAuth = useCallback(
    async (email: string, otp: string, authSession?: string) => {
      dispatch({ type: Actions.SET_LOADING, payload: true });
      dispatch({ type: Actions.SET_ERROR, payload: null });

      try {
        // Use provided session or fall back to state
        const sessionToUse = authSession || session;

        console.log('Verifying auth with session:', sessionToUse);

        if (!sessionToUse) {
          console.error('No session available for verification');
          dispatch({
            type: Actions.SET_ERROR,
            payload: 'Your session has expired. Please try again.',
          });
          dispatch({ type: Actions.SET_LOADING, payload: false });
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
          dispatch({
            type: Actions.SET_ERROR,
            payload: data.message || 'Verification failed',
          });
          dispatch({ type: Actions.SET_LOADING, payload: false });
          return {
            success: false,
            code: data.code || 'ERROR',
            message: data.message || 'Verification failed',
          };
        }

        // Handle success case
        if (data.tokens) {
          console.log('Auth verified successfully, storing tokens');
          const { accessToken, idToken, refreshToken } = data.tokens;
          storeTokens(accessToken, idToken, refreshToken);
          dispatch({
            type: Actions.SET_TOKENS,
            payload: { accessToken, idToken, refreshToken },
          });

          if (data.user) {
            console.log('Setting user data');
            dispatch({ type: Actions.SET_USER, payload: data.user });
          }
        }

        // Clear session after successful verification
        setSession(null);
        localStorage.removeItem('auth_session');

        dispatch({ type: Actions.SET_LOADING, payload: false });
        return { success: true, data };
      } catch (error) {
        console.error('Auth verification failed:', error);
        dispatch({
          type: Actions.SET_ERROR,
          payload: error instanceof Error ? error.message : 'Verification failed',
        });
        dispatch({ type: Actions.SET_LOADING, payload: false });
        return {
          success: false,
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        };
      }
    },
    [dispatch, session]
  );

  // Handle logout
  const logout = useCallback(() => {
    clearAuthData();
    dispatch({ type: Actions.LOGOUT });
    setSession(null);
    localStorage.removeItem('auth_session');
    router.push('/');
  }, [dispatch, router]);

  // Resend verification code
  const resendVerificationCode = useCallback(
    async (email: string, authSession?: string) => {
      dispatch({ type: Actions.SET_LOADING, payload: true });
      dispatch({ type: Actions.SET_ERROR, payload: null });

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

        dispatch({ type: Actions.SET_ERROR, payload: null });
        dispatch({ type: Actions.SET_LOADING, payload: false });

        return parsedData;
      } catch (error) {
        console.error('Resend code failed:', error);
        dispatch({
          type: Actions.SET_ERROR,
          payload: error instanceof Error ? error.message : 'Failed to resend code',
        });
        dispatch({ type: Actions.SET_LOADING, payload: false });
        throw error;
      }
    },
    [dispatch, session]
  );

  // Refresh user data
  const refreshUser = useCallback(async () => {
    try {
      // Fix accessing userId - use safe property access pattern
      const userId = state.user?.userId; // Assuming User type has userId, not id
      const idToken = getIdToken();

      if (!userId || !idToken) {
        console.error('Cannot refresh user: No user ID or token available');
        return null;
      }

      const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error('Failed to refresh user data:', response.status);
        return null;
      }

      const userData = await response.json();

      if (userData) {
        dispatch({ type: Actions.SET_USER, payload: userData });
        return userData;
      }

      return null;
    } catch (error) {
      console.error('Error refreshing user data:', error);
      return null;
    }
  }, [dispatch, state.user]);

  // Set up token refresh based on expiration
  useEffect(() => {
    if (!state.tokens?.accessToken) return;

    const refreshTokens = async () => {
      try {
        if (!state.tokens?.refreshToken) {
          logout();
          return;
        }

        const response = await fetch(`${API_BASE_URL}/auth/refresh-tokens`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: state.tokens.refreshToken }),
        });

        if (!response.ok) {
          throw new Error('Failed to refresh tokens');
        }

        const responseData = await response.json();

        // Parse the response data
        let tokens;
        if (responseData.body && typeof responseData.body === 'string') {
          const parsed = JSON.parse(responseData.body);
          tokens = parsed.tokens || parsed;
        } else {
          tokens = responseData.tokens || responseData;
        }

        // Make sure both access and ID tokens exist
        if (!tokens.accessToken || !tokens.idToken) {
          throw new Error('Invalid token data received');
        }

        // Use the existing refresh token if a new one wasn't provided
        const finalRefreshToken = tokens.refreshToken || state.tokens.refreshToken;

        // Store the new tokens
        storeTokens(tokens.accessToken, tokens.idToken, finalRefreshToken);

        dispatch({
          type: Actions.SET_TOKENS,
          payload: {
            accessToken: tokens.accessToken,
            idToken: tokens.idToken,
            refreshToken: finalRefreshToken,
          },
        });

        // After refreshing tokens, fetch user data if needed
        if (!state.user && tokens.sub) {
          const userId = tokens.sub;
          await fetchUserData(tokens.idToken, userId);
        }
      } catch (error) {
        console.error('Failed to refresh tokens:', error);
        logout();
      }
    };

    // Parse the JWT to get expiration
    try {
      const token = state.tokens.accessToken;
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expirationTime = payload.exp * 1000; // Convert to milliseconds
      const currentTime = Date.now();
      const timeUntilExpiry = expirationTime - currentTime;

      // Refresh 5 minutes before expiry
      const refreshTime = Math.max(0, timeUntilExpiry - 5 * 60 * 1000);

      if (refreshTime <= 0) {
        // Token is already expired or about to expire
        refreshTokens();
        return;
      }

      const refreshTimer = setTimeout(refreshTokens, refreshTime);
      return () => clearTimeout(refreshTimer);
    } catch (err) {
      console.error('Error parsing JWT:', err);
      logout();
    }
  }, [state.tokens, logout, state.user, dispatch]);

  return {
    user: state.user,
    tokens: state.tokens,
    isLoading: state.isLoading,
    error: state.error,
    isAuthenticated: !!state.user,
    session,
    initiateAuth,
    verifyAuth,
    logout,
    refreshUser,
    resendVerificationCode,
  };
};

export default useAuth;
