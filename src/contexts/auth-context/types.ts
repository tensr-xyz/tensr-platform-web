import { User } from '@/types/user';

export interface Tokens {
  accessToken: string;
  idToken: string;
  refreshToken: string;
}

export interface StateProps {
  user: User | null;
  tokens: Tokens | null;
  isLoading: boolean;
  error: string | null;
}

export enum Actions {
  SET_USER = 'SET_USER',
  SET_TOKENS = 'SET_TOKENS',
  SET_LOADING = 'SET_LOADING',
  SET_ERROR = 'SET_ERROR',
  LOGOUT = 'LOGOUT',
}

export interface ProviderProps {
  children: React.ReactNode;
}

export interface ActionProps {
  type: Actions;
  payload?: any;
}

export interface AuthContextProps {
  state: StateProps;
  dispatch: (action: ActionProps) => void;
}
