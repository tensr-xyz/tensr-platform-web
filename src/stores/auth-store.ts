import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { User } from '@/types/user';
import { storeTokens, removeTokens } from '@/utils/auth';

interface Tokens {
  accessToken: string;
  idToken: string;
  refreshToken: string;
}

interface AuthState {
  // Authentication state
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // User data
  user: User | null;

  // Tokens (matching current context structure)
  tokens: Tokens | null;

  // Session state
  sessionExpired: boolean;
  lastActivity: number;
}

interface AuthActions {
  // Authentication actions
  setUser: (user: User | null) => void;
  setTokens: (tokens: Tokens | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Session management
  setSessionExpired: (expired: boolean) => void;
  updateLastActivity: () => void;

  // Auth state management
  login: (tokens: Tokens, user: User) => void;
  logout: () => void;

  // Token refresh
  refreshTokens: (tokens: Tokens) => void;

  // Reset actions
  reset: () => void;
}

type AuthStore = AuthState & AuthActions;

const initialState: AuthState = {
  isAuthenticated: false,
  isLoading: false,
  error: null,
  user: null,
  tokens: null,
  sessionExpired: false,
  lastActivity: Date.now(),
};

export const useAuthStore = create<AuthStore>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        // Authentication actions
        setUser: user => {
          console.log('Zustand setUser called with:', user);
          set({
            user,
            isAuthenticated: !!user,
            lastActivity: Date.now(),
          });
          console.log('Zustand setUser complete, new state:', { user, isAuthenticated: !!user });
        },

        setTokens: tokens => {
          console.log('Zustand setTokens called with:', tokens ? 'tokens present' : 'no tokens');

          // Store tokens in localStorage and cookies
          if (tokens) {
            console.log('Calling storeTokens from Zustand...');
            storeTokens(tokens.accessToken, tokens.idToken, tokens.refreshToken);
          }

          set({
            tokens,
            isAuthenticated: !!tokens,
            lastActivity: Date.now(),
            // Don't override isLoading here - let the calling code manage it
          });

          console.log('Zustand state updated, isAuthenticated:', !!tokens);
        },

        setLoading: loading => set({ isLoading: loading }),

        setError: error => set({ error }),

        // Session management
        setSessionExpired: expired => set({ sessionExpired: expired }),

        updateLastActivity: () => set({ lastActivity: Date.now() }),

        // Auth state management
        login: (tokens, user) => {
          set({
            tokens,
            user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
            sessionExpired: false,
            lastActivity: Date.now(),
          });
        },

        logout: () => {
          // Remove tokens from localStorage and cookies
          removeTokens();

          set({
            tokens: null,
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
            sessionExpired: false,
            lastActivity: Date.now(),
          });
        },

        // Token refresh
        refreshTokens: tokens => {
          // Store new tokens in localStorage and cookies
          storeTokens(tokens.accessToken, tokens.idToken, tokens.refreshToken);

          set({
            tokens,
            isAuthenticated: true,
            sessionExpired: false,
            lastActivity: Date.now(),
          });
        },

        // Reset actions
        reset: () => set(initialState),
      }),
      {
        name: 'auth-store',
        partialize: state => ({
          // Only persist tokens and user data - never persist loading state
          tokens: state.tokens,
          user: state.user,
          lastActivity: state.lastActivity,
        }),
        // Ensure loading state is always false on rehydration
        onRehydrateStorage: () => state => {
          console.log('Auth store rehydrating with state:', state);
          if (state) {
            state.isLoading = false;
            console.log('Auth store rehydration complete, user:', state.user);
          }
        },
      }
    ),
    {
      name: 'auth-store',
    }
  )
);
