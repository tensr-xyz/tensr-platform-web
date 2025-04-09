import { AppActions, DialogType } from './types';

export const showDialog = (dialog: DialogType, props?: Record<string, unknown>) => ({
  type: AppActions.SHOW_DIALOG,
  payload: { dialog, props },
});

export const hideDialog = () => ({
  type: AppActions.HIDE_DIALOG,
});

export const setView = (view: string) => ({
  type: AppActions.SET_VIEW,
  payload: view,
});

export const setLoading = (isLoading: boolean) => ({
  type: AppActions.SET_LOADING,
  payload: isLoading,
});

export const setError = (error: string | null) => ({
  type: AppActions.SET_ERROR,
  payload: error,
});
