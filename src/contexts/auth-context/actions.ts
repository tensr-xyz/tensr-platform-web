import { User } from '@/types/user';

import { Actions, Tokens } from './types';

export const setUser = (payload: User | null) => ({
  type: Actions.SET_USER,
  payload,
});

export const setTokens = (payload: Tokens | null) => ({
  type: Actions.SET_TOKENS,
  payload,
});

export const setLoading = (payload: boolean) => ({
  type: Actions.SET_LOADING,
  payload,
});

export const setError = (payload: string | null) => ({
  type: Actions.SET_ERROR,
  payload,
});

export const logout = () => ({
  type: Actions.LOGOUT,
});
