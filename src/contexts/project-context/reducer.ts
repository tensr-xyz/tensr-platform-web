import { ProjectActions, ProjectState, ActionProps } from './types';

export default function reducer(state: ProjectState, action: ActionProps): ProjectState {
  switch (action.type) {
    case ProjectActions.SET_VIEW: {
      return {
        ...state,
        activeView: action.payload,
      };
    }
    case ProjectActions.TOGGLE_RIGHT_PANEL: {
      return {
        ...state,
        rightPanelOpen: action.payload,
      };
    }
    case ProjectActions.TOGGLE_LEFT_PANEL: {
      return {
        ...state,
        leftPanelOpen: action.payload,
      };
    }
    case ProjectActions.SET_LEFT_PANEL_CONTENT: {
      return {
        ...state,
        leftPanelContent: action.payload,
      };
    }
    case ProjectActions.TOGGLE_LEFT_SIDEBAR: {
      return {
        ...state,
        leftSidebarOpen: action.payload,
      };
    }
    case ProjectActions.TOGGLE_FOOTER: {
      return {
        ...state,
        footerOpen: action.payload,
      };
    }
    case ProjectActions.TOGGLE_TERMINAL: {
      return {
        ...state,
        toggleTerminal: action.payload,
      };
    }
    case ProjectActions.SET_MAXIMIZED: {
      return {
        ...state,
        isMaximized: action.payload,
      };
    }
    case ProjectActions.SET_PROJECT: {
      if (action.payload && 'files' in action.payload) {
        return {
          ...state,
          currentProject: action.payload.project,
          fileSystem: action.payload.files,
          error: null,
        };
      } else {
        return {
          ...state,
          currentProject: action.payload,
          error: null,
        };
      }
    }
    case ProjectActions.SET_FILE_SYSTEM: {
      return {
        ...state,
        fileSystem: action.payload,
        error: null,
      };
    }
    case ProjectActions.SET_SELECTED_PATH: {
      return {
        ...state,
        selectedPath: action.payload,
      };
    }
    case ProjectActions.SET_LOADING: {
      return {
        ...state,
        isLoading: action.payload,
      };
    }
    case ProjectActions.SET_ERROR: {
      return {
        ...state,
        error: action.payload,
      };
    }
    case ProjectActions.CLEAR_PROJECT: {
      return {
        ...state,
        currentProject: null,
        fileSystem: [],
        selectedPath: null,
        error: null,
      };
    }
    case ProjectActions.SET_IMPORT_DATA:
      return {
        ...state,
        importData: action.payload,
      };
    case ProjectActions.SET_SHOW_IMPORT_WIZARD:
      return {
        ...state,
        showImportWizard: action.payload,
      };
    case ProjectActions.CLEAR_IMPORT_DATA:
      return {
        ...state,
        importData: null,
        showImportWizard: false,
      };
    default: {
      throw new Error('Unhandled action type');
    }
  }
}
