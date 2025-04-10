'use client';

import { createContext, useContext, useReducer } from 'react';
import reducer from './reducer';
import { AppContextProps, ProviderProps } from './types';

const AppContext = createContext<AppContextProps | undefined>(undefined);

function AppProvider({ children }: ProviderProps) {
  const [state, dispatch] = useReducer(reducer, {
    activeDialog: null,
    dialogProps: {},
    currentView: 'projects',
    previousView: null,
    isLoading: false,
    error: null,
  });

  const value = { state, dispatch };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

export { AppProvider, useApp };
