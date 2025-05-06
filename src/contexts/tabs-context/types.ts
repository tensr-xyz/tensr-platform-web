// tabs-context/types.ts
import { ViewType } from '@/contexts/project-context/types';

export interface ColumnVisibility {
  [columnId: string]: boolean;
}

// Base Tab interface with required fields and optional data fields
export interface Tab {
  id: string;
  name: string;
  content: string; // Required by the context
  isDirty: boolean;
  type: ViewType;
  path?: string;
  columnVisibility?: ColumnVisibility;
  data?: any;
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
  processDataChunk?: (data: any[], startRow: number) => Record<string, any>[];
  isInitialized?: boolean;
  cleanValue?: (value: any) => any;
  importSettings?: any;
}

// SpreadsheetTab extends the base Tab interface
export interface SpreadsheetTab extends Tab {
  type: ViewType.SPREADSHEET;
  data: Required<TabData>;
  content: string; // Ensure content is available
}

// Markdown-specific tab type
export interface MarkdownTab extends Tab {
  type: ViewType.MARKDOWN;
  path: string;
}

// Type predicate to check if a tab is a spreadsheet tab
export function isSpreadsheetTab(tab: Tab): tab is SpreadsheetTab {
  return tab.type === ViewType.SPREADSHEET && tab.data !== undefined;
}

// Enum for tab action types
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
