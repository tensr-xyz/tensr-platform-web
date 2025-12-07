import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { User } from '@/types/user';
import { storeSession, removeSession } from '@/utils/auth';

interface Session {
  sessionToken: string;
  sessionJwt?: string;
}

interface AuthState {
  // Authentication state
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // User data
  user: User | null;

  // Session (Stytch session with single token)
  session: Session | null;

  // Session state
  sessionExpired: boolean;
  lastActivity: number;
}

interface AuthActions {
  // Authentication actions
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Session management
  setSessionExpired: (expired: boolean) => void;
  updateLastActivity: () => void;

  // Auth state management
  login: (session: Session, user: User) => void;
  logout: () => void;

  // Session refresh
  refreshSession: (session: Session) => void;

  // Reset actions
  reset: () => void;
}

type AuthStore = AuthState & AuthActions;

const initialState: AuthState = {
  isAuthenticated: false,
  isLoading: false,
  error: null,
  user: null,
  session: null,
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

        setSession: session => {
          console.log(
            'Zustand setSession called with:',
            session ? 'session present' : 'no session'
          );

          // Store session in localStorage and cookies
          if (session) {
            console.log('Calling storeSession from Zustand...');
            storeSession(session.sessionToken, session.sessionJwt);
          }

          set({
            session,
            isAuthenticated: !!session,
            lastActivity: Date.now(),
          });

          console.log('Zustand state updated, isAuthenticated:', !!session);
        },

        setLoading: loading => set({ isLoading: loading }),

        setError: error => set({ error }),

        // Session management
        setSessionExpired: expired => set({ sessionExpired: expired }),

        updateLastActivity: () => set({ lastActivity: Date.now() }),

        // Auth state management
        login: (session, user) => {
          set({
            session,
            user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
            sessionExpired: false,
            lastActivity: Date.now(),
          });
        },

        logout: () => {
          // Remove session from localStorage and cookies
          removeSession();

          set({
            session: null,
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
            sessionExpired: false,
            lastActivity: Date.now(),
          });
        },

        // Session refresh
        refreshSession: session => {
          // Store new session in localStorage and cookies
          storeSession(session.sessionToken, session.sessionJwt);

          set({
            session,
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
          // Only persist session and user data - never persist loading state
          session: state.session,
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
