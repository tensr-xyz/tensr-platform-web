import { AppActions, AppState, ActionProps } from './types';

export default function reducer(state: AppState, action: ActionProps): AppState {
  switch (action.type) {
    case AppActions.SHOW_DIALOG: {
      return {
        ...state,
        activeDialog: action.payload.dialog,
        dialogProps: action.payload.props || {},
      };
    }
    case AppActions.HIDE_DIALOG: {
      return {
        ...state,
        activeDialog: null,
        dialogProps: {},
      };
    }
    case AppActions.SET_VIEW: {
      return {
        ...state,
        previousView: state.currentView,
        currentView: action.payload,
      };
    }
    case AppActions.SET_LOADING: {
      return {
        ...state,
        isLoading: action.payload,
      };
    }
    case AppActions.SET_ERROR: {
      return {
        ...state,
        error: action.payload,
      };
    }
    default: {
      throw new Error('Unhandled action type');
    }
  }
}
