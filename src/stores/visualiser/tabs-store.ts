import { create } from 'zustand';
import { Column } from '@/types/visualiser/spreadsheet';

export enum ViewType {
  SPREADSHEET = 'spreadsheet',
}

export interface TabData {
  initialData: Record<string, any>[];
  initialColumns?: Column[];
  totalRows?: number;
  totalColumns?: number;
}

export interface Tab {
  id: string;
  name: string;
  content: string;
  isDirty: boolean;
  type: ViewType;
  data?: TabData;
}

interface TabState {
  tabs: Tab[];
  activeTabId: string;
}

interface TabActions {
  addTab: (tab: Omit<Tab, 'id'>) => void;
  closeTab: (id: string) => void;
  updateTab: (id: string, updates: Partial<Tab>) => void;
  setActiveTab: (id: string) => void;
  closeAllTabs: () => void;
}

type TabStore = TabState & TabActions;

const initialState: TabState = {
  tabs: [],
  activeTabId: '',
};

export const useTabsStore = create<TabStore>(set => ({
  ...initialState,

  addTab: tabData => {
    const id = crypto.randomUUID();
    const newTab: Tab = {
      ...tabData,
      id,
    };

    set(state => ({
      tabs: [...state.tabs, newTab],
      activeTabId: id,
    }));
  },

  closeTab: id =>
    set(state => {
      const newTabs = state.tabs.filter(t => t.id !== id);
      let newActiveTabId = state.activeTabId;

      if (state.activeTabId === id) {
        const currentIndex = state.tabs.findIndex(t => t.id === id);
        if (newTabs.length > 0) {
          const nextTab = newTabs[currentIndex] || newTabs[currentIndex - 1];
          newActiveTabId = nextTab?.id || '';
        } else {
          newActiveTabId = '';
        }
      }

      return {
        tabs: newTabs,
        activeTabId: newActiveTabId,
      };
    }),

  updateTab: (id, updates) =>
    set(state => ({
      tabs: state.tabs.map(tab => (tab.id === id ? { ...tab, ...updates } : tab)),
    })),

  setActiveTab: id =>
    set({
      activeTabId: id,
    }),

  closeAllTabs: () =>
    set({
      tabs: [],
      activeTabId: '',
    }),
}));
