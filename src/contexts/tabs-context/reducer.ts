import { TabActions, TabActionType, TabsState } from './types';

const initialState: TabsState = {
  tabs: [],
  activeTabId: '',
  recentlyClosedTabs: [],
};

export default function reducer(state: TabsState = initialState, action: TabActionType): TabsState {
  switch (action.type) {
    case TabActions.ADD_TAB: {
      const id = crypto.randomUUID();
      const newTab = { ...action.payload, id };
      const newState = {
        ...state,
        tabs: [...state.tabs, newTab],
        activeTabId: id,
      };

      return newState;
    }

    case TabActions.CLOSE_TAB: {
      const tabIndex = state.tabs.findIndex(tab => tab.id === action.payload);
      const newTabs = state.tabs.filter(tab => tab.id !== action.payload); // Fixed this line
      const closedTab = state.tabs[tabIndex];

      return {
        ...state,
        tabs: newTabs,
        activeTabId: newTabs.length
          ? state.tabs[tabIndex - 1]?.id || state.tabs[tabIndex + 1]?.id || ''
          : '',
        recentlyClosedTabs: [closedTab, ...state.recentlyClosedTabs.slice(0, 9)],
      };
    }

    case TabActions.UPDATE_TAB: {
      return {
        ...state,
        tabs: state.tabs.map(tab =>
          tab.id === action.payload.id ? { ...tab, ...action.payload.updates } : tab
        ),
      };
    }

    case TabActions.SET_ACTIVE_TAB: {
      return {
        ...state,
        activeTabId: action.payload,
      };
    }

    case TabActions.REORDER_TABS: {
      const { sourceIndex, destinationIndex } = action.payload;
      const newTabs = [...state.tabs];
      const [removed] = newTabs.splice(sourceIndex, 1);
      newTabs.splice(destinationIndex, 0, removed);

      return {
        ...state,
        tabs: newTabs,
      };
    }

    case TabActions.SET_TAB_DIRTY: {
      const { id, isDirty } = action.payload;
      return {
        ...state,
        tabs: state.tabs.map(tab => (tab.id === id ? { ...tab, isDirty } : tab)),
      };
    }

    case TabActions.LOAD_TABS_STATE: {
      return action.payload;
    }

    case TabActions.UPDATE_COLUMN_VISIBILITY: {
      const { tabId, columnId, isVisible } = action.payload;
      return {
        ...state,
        tabs: state.tabs.map(tab => {
          if (tab.id === tabId) {
            return {
              ...tab,
              data: {
                ...tab.columnVisibility,
                columnVisibility: {
                  ...(tab.columnVisibility || {}),
                  [columnId]: isVisible,
                },
              },
            };
          }
          return tab;
        }),
      };
    }

    case TabActions.CLOSE_ALL_TABS: {
      return {
        ...state,
        tabs: [],
        activeTabId: '',
        recentlyClosedTabs: [...state.tabs.reverse(), ...state.recentlyClosedTabs].slice(0, 10),
      };
    }

    default: {
      throw new Error('Unhandled action type');
    }
  }
}
