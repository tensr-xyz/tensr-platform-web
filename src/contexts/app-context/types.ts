import React from 'react';

export enum DialogType {
  NEW_PROJECT = 'new-project',
  SETTINGS = 'settings',
}

export enum AppActions {
  SHOW_DIALOG = 'SHOW_DIALOG',
  HIDE_DIALOG = 'HIDE_DIALOG',
  SET_VIEW = 'SET_VIEW',
  SET_LOADING = 'SET_LOADING',
  SET_ERROR = 'SET_ERROR',
}

export interface ActionProps {
  type: AppActions;
  payload?: any;
}

export interface AppState {
  activeDialog: DialogType | null;
  dialogProps: Record<string, unknown>;
  currentView: string;
  previousView: string | null;
  isLoading: boolean;
  error: string | null;
}

export interface AppContextProps {
  state: AppState;
  dispatch: (action: ActionProps) => void;
}

export interface ProviderProps {
  children: React.ReactNode;
}
