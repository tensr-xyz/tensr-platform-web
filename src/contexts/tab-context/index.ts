'use client';

import React, { createContext, useContext, useReducer } from 'react';
import { TabsContextProps, ProviderProps } from './types';
import reducer from './reducer';

const TabsContext = createContext<TabsContextProps | undefined>(undefined);

export function TabsProvider({ children }: ProviderProps) {
  const [state, dispatch] = useReducer(reducer, {
    tabs: [],
    activeTabId: '',
    recentlyClosedTabs: [],
  });

  return React.createElement(TabsContext.Provider, { value: { state, dispatch } }, children);
}

export function useTabs() {
  const context = useContext(TabsContext);
  if (context === undefined) {
    throw new Error('useTabs must be used within a TabsProvider');
  }
  return context;
}
