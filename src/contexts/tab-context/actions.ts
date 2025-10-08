import { Tab, TabActions, TabActionType, TabsState } from './types';

export const addTab = (tab: Omit<Tab, 'id'>): TabActionType => ({
  type: TabActions.ADD_TAB,
  payload: tab,
});

export const closeTab = (id: string): TabActionType => ({
  type: TabActions.CLOSE_TAB,
  payload: id,
});

export const updateTab = (id: string, updates: Partial<Tab>): TabActionType => ({
  type: TabActions.UPDATE_TAB,
  payload: { id, updates },
});

export const setActiveTab = (id: string): TabActionType => ({
  type: TabActions.SET_ACTIVE_TAB,
  payload: id,
});

export const reorderTabs = (sourceIndex: number, destinationIndex: number): TabActionType => ({
  type: TabActions.REORDER_TABS,
  payload: { sourceIndex, destinationIndex },
});

export const setTabDirty = (id: string, isDirty: boolean): TabActionType => ({
  type: TabActions.SET_TAB_DIRTY,
  payload: { id, isDirty },
});

export const loadTabsState = (state: TabsState): TabActionType => ({
  type: TabActions.LOAD_TABS_STATE,
  payload: state,
});

export const updateColumnVisibility = (
  tabId: string,
  columnId: string,
  isVisible: boolean
): TabActionType => ({
  type: TabActions.UPDATE_COLUMN_VISIBILITY,
  payload: { tabId, columnId, isVisible },
});

export const closeAllTabs = (): TabActionType => ({
  type: TabActions.CLOSE_ALL_TABS,
});
