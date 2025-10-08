'use client';

import React, { createContext, useContext, useEffect, useReducer } from 'react';
import { TabsContextProps, ProviderProps } from './types';
import reducer from './reducer';
import { loadTabsState } from './actions';

const TabsContext = createContext<TabsContextProps | undefined>(undefined);

export function TabsProvider({ children }: ProviderProps) {
  const [state, dispatch] = useReducer(reducer, {
    tabs: [],
    activeTabId: '',
    recentlyClosedTabs: [],
  });

  // Load saved state from storage on mount
  useEffect(() => {
    const loadSavedState = async () => {
      try {
        const savedState = '';
        // const savedState = await invoke<string>('load_tabs_state');
        if (savedState) {
          dispatch(loadTabsState(JSON.parse(savedState)));
        }
      } catch (error) {
        console.error('Error loading tabs state:', error);
      }
    };

    loadSavedState();
  }, []);

  // Save state to storage on changes
  useEffect(() => {
    const saveState = async () => {
      try {
        // Only try to save state if we're not in development
        // if (!import.meta.env.DEV) {
        //   await invoke('save_tabs_state', { state });
        // }
      } catch (e) {
        console.error('Error saving tabs state:', e);
      }
    };

    saveState();
  }, [state]);

  // Listen for file system changes
  useEffect(() => {
    // TODO: Implement file system change listening when needed
    // const unsubscribe = listen('fs-change', async event => {
    //   const { path } = event.payload as { path: string; type: string };
    //   const tab = state.tabs.find(t => t.path === path);
    //
    //   if (tab) {
    //     try {
    //       const content = {};
    //       // const content = await invoke<string>('read_file', { path });
    //       dispatch(updateTab(tab.id, { content }));
    //       dispatch(setTabDirty(tab.id, false));
    //     } catch (error) {
    //       console.error('Error reading file:', error);
    //     }
    //   }
    // });

    return () => {
      // No cleanup needed for now since we're not actually subscribing to anything
    };
  }, [state.tabs]);

  return React.createElement(TabsContext.Provider, { value: { state, dispatch } }, children);
}

export function useTabs() {
  const context = useContext(TabsContext);
  if (context === undefined) {
    throw new Error('useTabs must be used within a TabsProvider');
  }
  return context;
}
