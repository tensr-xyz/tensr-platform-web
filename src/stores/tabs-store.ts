import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// Import ViewType from project store to maintain consistency
export enum ViewType {
  SPREADSHEET = 'spreadsheet',
  CHARTS = 'charts',
  MODEL_BUILDER = 'model_builder',
  NOTEBOOK = 'notebook',
  PLUGINS = 'plugins',
  MARKDOWN = 'markdown',
  SEM = 'sem',
}

export interface ColumnVisibility {
  [columnId: string]: boolean;
}

// Column interface for spreadsheet tabs
export interface Column {
  id: string;
  accessor: string;
  header: string;
  width: number;
  type: string;
}

// TabData interface with specific spreadsheet data
export interface TabData {
  filePath?: string;
  initialData?: Record<string, any>[];
  initialColumns?: Column[];
  columnStats?: Record<string, any>;
  totalRows?: number;
  totalColumns?: number;
  processDataChunk?: (data: any[], startRow: number) => Record<string, any>[];
  isInitialized?: boolean;
  cleanValue?: (value: any) => any;
  importSettings?: any;
  columnFilters?: Array<{
    id: string;
    value: {
      operator: string;
      value: any;
    };
  }>;
  teachingMode?: boolean;
}

// Base Tab interface with required fields and optional data fields
export interface Tab {
  id: string;
  name: string;
  content: string;
  isDirty: boolean;
  type: ViewType;
  path?: string;
  columnVisibility?: ColumnVisibility;
  data?: TabData;
  isPinned?: boolean;
  createdAt?: number;
  lastAccessed?: number;
}

interface TabState {
  // Tabs - matching the context interface
  tabs: Tab[];
  activeTabId: string;
  recentlyClosedTabs: Tab[];

  // Tab operations
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;

  // Tab limits
  maxTabs: number;
  maxPinnedTabs: number;
}

interface TabActions {
  // Core tab actions - matching the context actions
  addTab: (tab: Omit<Tab, 'id'>) => void;
  closeTab: (id: string) => void;
  updateTab: (id: string, updates: Partial<Tab>) => void;
  setActiveTab: (id: string) => void;
  reorderTabs: (sourceIndex: number, destinationIndex: number) => void;
  setTabDirty: (id: string, isDirty: boolean) => void;
  loadTabsState: (state: Partial<TabState>) => void;
  updateColumnVisibility: (tabId: string, columnId: string, isVisible: boolean) => void;
  closeAllTabs: () => void;

  // Additional convenience actions
  activateNextTab: () => void;
  activatePreviousTab: () => void;
  pinTab: (id: string) => void;
  unpinTab: (id: string) => void;

  // Loading states
  setCreating: (creating: boolean) => void;
  setUpdating: (updating: boolean) => void;
  setDeleting: (deleting: boolean) => void;

  // Reset actions
  reset: () => void;
}

type TabStore = TabState & TabActions;

const initialState: TabState = {
  tabs: [],
  activeTabId: '',
  recentlyClosedTabs: [],
  isCreating: false,
  isUpdating: false,
  isDeleting: false,
  maxTabs: 20,
  maxPinnedTabs: 5,
};

export const useTabsStore = create<TabStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // Core tab actions - matching the context actions
      addTab: tabData => {
        const id = crypto.randomUUID();
        const newTab: Tab = {
          ...tabData,
          id,
          createdAt: Date.now(),
          lastAccessed: Date.now(),
        };

        set(state => {
          const newTabs = [...state.tabs, newTab];

          // Enforce max tabs limit
          if (newTabs.length > state.maxTabs) {
            // Remove oldest non-pinned tabs
            const pinnedTabs = newTabs.filter(t => t.isPinned);
            const nonPinnedTabs = newTabs
              .filter(t => !t.isPinned)
              .sort((a, b) => (a.lastAccessed || 0) - (b.lastAccessed || 0));

            const tabsToKeep = Math.max(pinnedTabs.length, state.maxTabs);
            if (nonPinnedTabs.length > tabsToKeep - pinnedTabs.length) {
              const toRemove = nonPinnedTabs.slice(
                0,
                nonPinnedTabs.length - (tabsToKeep - pinnedTabs.length)
              );
              toRemove.forEach(tab => {
                const index = newTabs.findIndex(t => t.id === tab.id);
                if (index !== -1) newTabs.splice(index, 1);
              });
            }
          }

          return {
            tabs: newTabs,
            activeTabId: id,
          };
        });
      },

      closeTab: id =>
        set(state => {
          const tabToClose = state.tabs.find(t => t.id === id);
          if (!tabToClose) return state;

          const newTabs = state.tabs.filter(t => t.id !== id);
          const newRecentlyClosedTabs = [...state.recentlyClosedTabs, tabToClose];
          let newActiveTabId = state.activeTabId;

          // If we're removing the active tab, activate another one
          if (state.activeTabId === id) {
            const currentIndex = state.tabs.findIndex(t => t.id === id);
            if (newTabs.length > 0) {
              // Try to activate the next tab, or the previous one
              const nextTab = newTabs[currentIndex] || newTabs[currentIndex - 1];
              newActiveTabId = nextTab?.id || '';
            } else {
              newActiveTabId = '';
            }
          }

          return {
            tabs: newTabs,
            activeTabId: newActiveTabId,
            recentlyClosedTabs: newRecentlyClosedTabs.slice(-10), // Keep last 10 closed tabs
          };
        }),

      updateTab: (id, updates) =>
        set(state => ({
          tabs: state.tabs.map(tab =>
            tab.id === id ? { ...tab, ...updates, lastAccessed: Date.now() } : tab
          ),
        })),

      setActiveTab: id =>
        set(state => ({
          activeTabId: id,
          tabs: state.tabs.map(tab => (tab.id === id ? { ...tab, lastAccessed: Date.now() } : tab)),
        })),

      reorderTabs: (sourceIndex, destinationIndex) =>
        set(state => {
          const newTabs = [...state.tabs];
          const [removed] = newTabs.splice(sourceIndex, 1);
          newTabs.splice(destinationIndex, 0, removed);
          return { tabs: newTabs };
        }),

      setTabDirty: (id, isDirty) =>
        set(state => ({
          tabs: state.tabs.map(tab => (tab.id === id ? { ...tab, isDirty } : tab)),
        })),

      loadTabsState: newState =>
        set(state => ({
          ...state,
          ...newState,
        })),

      updateColumnVisibility: (tabId, columnId, isVisible) =>
        set(state => ({
          tabs: state.tabs.map(tab =>
            tab.id === tabId
              ? {
                  ...tab,
                  columnVisibility: {
                    ...tab.columnVisibility,
                    [columnId]: isVisible,
                  },
                }
              : tab
          ),
        })),

      closeAllTabs: () =>
        set(state => ({
          tabs: [],
          activeTabId: '',
          recentlyClosedTabs: [...state.recentlyClosedTabs, ...state.tabs].slice(-10),
        })),

      // Additional convenience actions
      activateNextTab: () =>
        set(state => {
          if (state.tabs.length === 0) return state;

          const currentIndex = state.tabs.findIndex(t => t.id === state.activeTabId);
          const nextIndex = (currentIndex + 1) % state.tabs.length;
          const nextTab = state.tabs[nextIndex];

          return {
            activeTabId: nextTab.id,
            tabs: state.tabs.map(tab =>
              tab.id === nextTab.id ? { ...tab, lastAccessed: Date.now() } : tab
            ),
          };
        }),

      activatePreviousTab: () =>
        set(state => {
          if (state.tabs.length === 0) return state;

          const currentIndex = state.tabs.findIndex(t => t.id === state.activeTabId);
          const prevIndex = currentIndex === 0 ? state.tabs.length - 1 : currentIndex - 1;
          const prevTab = state.tabs[prevIndex];

          return {
            activeTabId: prevTab.id,
            tabs: state.tabs.map(tab =>
              tab.id === prevTab.id ? { ...tab, lastAccessed: Date.now() } : tab
            ),
          };
        }),

      pinTab: id =>
        set(state => {
          const pinnedCount = state.tabs.filter(t => t.isPinned).length;
          if (pinnedCount >= state.maxPinnedTabs) return state;

          return {
            tabs: state.tabs.map(tab => (tab.id === id ? { ...tab, isPinned: true } : tab)),
          };
        }),

      unpinTab: id =>
        set(state => ({
          tabs: state.tabs.map(tab => (tab.id === id ? { ...tab, isPinned: false } : tab)),
        })),

      // Loading states
      setCreating: creating => set({ isCreating: creating }),
      setUpdating: updating => set({ isUpdating: updating }),
      setDeleting: deleting => set({ isDeleting: deleting }),

      // Reset actions
      reset: () => set(initialState),
    }),
    {
      name: 'tabs-store',
    }
  )
);
