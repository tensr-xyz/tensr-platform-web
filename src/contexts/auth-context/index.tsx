'use client';
import { createContext, useContext, useEffect, useReducer } from 'react';

import { clearAuthData, getRefreshToken, storeTokens } from '@/utils/auth';

import reducer from './reducer';
import { Actions, AuthContextProps, ProviderProps } from './types';

// Make sure API_BASE_URL is properly defined
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'https://t8ioaf6fl9.execute-api.us-east-1.amazonaws.com';

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

export function AuthProvider({ children }: ProviderProps) {
  const [state, dispatch] = useReducer(reducer, {
    user: null,
    tokens: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    const initAuth = async () => {
      try {
        const refreshToken = getRefreshToken();

        if (refreshToken) {
          try {
            // Attempt to validate tokens by refreshing
            const response = await fetch(`${API_BASE_URL}/auth/refresh-tokens`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refreshToken }),
            });

            if (response.ok) {
              const responseData = await response.json();

              // Parse the nested body if needed
              let tokens;
              if (responseData.body && typeof responseData.body === 'string') {
                const parsed = JSON.parse(responseData.body);
                tokens = parsed.tokens || parsed;
              } else {
                tokens = responseData.tokens || responseData;
              }

              const { accessToken, idToken, refreshToken: newRefreshToken, sub } = tokens;

              // Store tokens
              storeTokens(accessToken, idToken, newRefreshToken || refreshToken); // Use old refreshToken if no new one
              dispatch({
                type: Actions.SET_TOKENS,
                payload: {
                  accessToken,
                  idToken,
                  refreshToken: newRefreshToken || refreshToken, // Use old refreshToken if no new one
                },
              });

              // Now fetch the user data using the refreshed token and sub from token
              const userId = sub || extractSubFromToken(idToken);

              if (userId) {
                try {
                  const userResponse = await fetch(`${API_BASE_URL}/users/${userId}`, {
                    method: 'GET',
                    headers: {
                      Authorization: `Bearer ${idToken}`,
                      'Content-Type': 'application/json',
                    },
                  });

                  if (userResponse.ok) {
                    const userData = await userResponse.json();
                    dispatch({ type: Actions.SET_USER, payload: userData });
                  } else {
                    console.error('Failed to fetch user data:', userResponse.status);
                  }
                } catch (userError) {
                  console.error('Error fetching user data:', userError);
                }
              } else {
                console.error('No user ID available in token');
              }
            } else {
              // If refresh fails, clear tokens
              clearAuthData();
              dispatch({ type: Actions.SET_USER, payload: null });
              dispatch({ type: Actions.SET_TOKENS, payload: null });
            }
          } catch (refreshError) {
            console.error('Token refresh error:', refreshError);
            clearAuthData();
            dispatch({ type: Actions.SET_USER, payload: null });
            dispatch({ type: Actions.SET_TOKENS, payload: null });
          }
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? `Auth initialization failed: ${err.message}`
            : 'Auth initialization failed';
        dispatch({ type: Actions.SET_ERROR, payload: errorMessage });
      } finally {
        dispatch({ type: Actions.SET_LOADING, payload: false });
      }
    };

    initAuth();
  }, []);

  const value = { state, dispatch };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Helper function to extract sub from ID token
function extractSubFromToken(idToken) {
  try {
    const payload = JSON.parse(atob(idToken.split('.')[1]));
    return payload.sub;
  } catch (e) {
    console.error('Error extracting sub from token:', e);
    return null;
  }
}

export function useAuthState() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthState must be used within an AuthProvider');
  }
  return context;
}
