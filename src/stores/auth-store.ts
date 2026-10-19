import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { User } from '@/types/user';
import { Entitlements } from '@/types/entitlements';
import { storeSession, removeSession } from '@/utils/auth';

interface Session {
  sessionToken: string;
  sessionJwt?: string;
}

export type NeedsEmailPrompt = {
  firstName: string | null;
  lastName: string | null;
  suggestedEmail: string | null;
};

interface AuthState {
  isLoading: boolean;
  /** True once Stytch SDK has finished its first session check. */
  isInitialized: boolean;
  error: string | null;
  user: User | null;
  entitlements: Entitlements | null;
  /** Runtime mirror of Stytch tokens — never persisted. */
  session: Session | null;
  sessionExpired: boolean;
  /** Stytch session is valid, but Tensr will not create an account until an email is verified. */
  needsEmail: NeedsEmailPrompt | null;
}

interface AuthActions {
  setUser: (user: User | null) => void;
  setEntitlements: (entitlements: Entitlements | null) => void;
  setSession: (session: Session | null) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: (initialized: boolean) => void;
  setError: (error: string | null) => void;
  setSessionExpired: (expired: boolean) => void;
  setNeedsEmail: (needsEmail: NeedsEmailPrompt | null) => void;
  login: (session: Session, user: User) => void;
  logout: () => void;
  refreshSession: (session: Session) => void;
  reset: () => void;
}

type AuthStore = AuthState & AuthActions;

const initialState: AuthState = {
  isLoading: true,
  isInitialized: false,
  error: null,
  user: null,
  entitlements: null,
  session: null,
  sessionExpired: false,
  needsEmail: null,
};

export const useAuthStore = create<AuthStore>()(
  devtools(
    persist(
      set => ({
        ...initialState,

        setUser: user => set({ user }),

        setEntitlements: entitlements => set({ entitlements }),

        setSession: session => {
          if (session) {
            storeSession(session.sessionToken, session.sessionJwt);
          }
          set({ session });
        },

        setLoading: loading => set({ isLoading: loading }),

        setInitialized: initialized => set({ isInitialized: initialized }),

        setError: error => set({ error }),

        setSessionExpired: expired => set({ sessionExpired: expired }),

        setNeedsEmail: needsEmail => set({ needsEmail }),

        login: (session, user) => {
          storeSession(session.sessionToken, session.sessionJwt);
          set({
            session,
            user,
            isLoading: false,
            error: null,
            sessionExpired: false,
            needsEmail: null,
          });
        },

        logout: () => {
          removeSession();
          set({
            session: null,
            user: null,
            entitlements: null,
            isLoading: false,
            error: null,
            sessionExpired: false,
            needsEmail: null,
          });
        },

        refreshSession: session => {
          storeSession(session.sessionToken, session.sessionJwt);
          set({
            session,
            sessionExpired: false,
          });
        },

        reset: () => set(initialState),
      }),
      {
        name: 'auth-store',
        partialize: state => ({
          // Display cache only — never use persisted user to infer auth.
          user: state.user,
        }),
        onRehydrateStorage: () => state => {
          if (state) {
            state.isLoading = true;
            state.isInitialized = false;
            state.session = null;
          }
        },
      }
    ),
    { name: 'auth-store' }
  )
);
