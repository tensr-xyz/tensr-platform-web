import { ViewType } from '@/contexts/project-context/types.ts';

export interface ColumnVisibility {
  [columnId: string]: boolean;
}

export interface Tab {
  id: string;
  path?: string;
  name: string;
  content: string;
  isDirty: boolean;
  type: ViewType;
  columnVisibility?: ColumnVisibility;
  data?: any;
}

export enum TabActions {
  ADD_TAB = 'ADD_TAB',
  CLOSE_TAB = 'CLOSE_TAB',
  UPDATE_TAB = 'UPDATE_TAB',
  SET_ACTIVE_TAB = 'SET_ACTIVE_TAB',
  REORDER_TABS = 'REORDER_TABS',
  SET_TAB_DIRTY = 'SET_TAB_DIRTY',
  LOAD_TABS_STATE = 'LOAD_TABS_STATE',
  UPDATE_COLUMN_VISIBILITY = 'UPDATE_COLUMN_VISIBILITY',
  CLOSE_ALL_TABS = 'CLOSE_ALL_TABS',
}

export interface TabsState {
  tabs: Tab[];
  activeTabId: string;
  recentlyClosedTabs: Tab[];
}

export interface TabsContextProps {
  state: TabsState;
  dispatch: (action: TabActionType) => void;
}

export interface ProviderProps {
  children: React.ReactNode;
}

export type TabActionType =
  | { type: TabActions.ADD_TAB; payload: Omit<Tab, 'id'> }
  | { type: TabActions.CLOSE_TAB; payload: string }
  | { type: TabActions.UPDATE_TAB; payload: { id: string; updates: Partial<Tab> } }
  | { type: TabActions.SET_ACTIVE_TAB; payload: string }
  | { type: TabActions.REORDER_TABS; payload: { sourceIndex: number; destinationIndex: number } }
  | { type: TabActions.SET_TAB_DIRTY; payload: { id: string; isDirty: boolean } }
  | { type: TabActions.LOAD_TABS_STATE; payload: TabsState }
  | {
      type: TabActions.UPDATE_COLUMN_VISIBILITY;
      payload: {
        tabId: string;
        columnId: string;
        isVisible: boolean;
      };
    }
  | { type: TabActions.CLOSE_ALL_TABS };
