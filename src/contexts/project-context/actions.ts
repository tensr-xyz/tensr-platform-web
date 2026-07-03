import { ProjectActions, ActionProps } from './types';
import { ViewType } from './types';

export const setView = (view: ViewType): ActionProps => ({
  type: ProjectActions.SET_VIEW,
  payload: view,
});

export const toggleRightPanel = (isOpen: boolean): ActionProps => ({
  type: ProjectActions.TOGGLE_RIGHT_PANEL,
  payload: isOpen,
});

export const toggleLeftPanel = (isOpen: boolean): ActionProps => ({
  type: ProjectActions.TOGGLE_LEFT_PANEL,
  payload: isOpen,
});

export const setLeftPanelContent = (content: React.ReactNode): ActionProps => ({
  type: ProjectActions.SET_LEFT_PANEL_CONTENT,
  payload: content,
});

export const toggleLeftSidebar = (isOpen: boolean): ActionProps => ({
  type: ProjectActions.TOGGLE_LEFT_SIDEBAR,
  payload: isOpen,
});

export const toggleFooter = (isOpen: boolean): ActionProps => ({
  type: ProjectActions.TOGGLE_FOOTER,
  payload: isOpen,
});

export const toggleTerminal = (isOpen: boolean): ActionProps => ({
  type: ProjectActions.TOGGLE_TERMINAL,
  payload: isOpen,
});

export const setMaximized = (isMaximized: boolean): ActionProps => ({
  type: ProjectActions.SET_MAXIMIZED,
  payload: isMaximized,
});

// REMOVED: refreshFileSystem function that was calling wrong internal API endpoint
// This functionality is now handled by the Zustand store with proper external API calls
