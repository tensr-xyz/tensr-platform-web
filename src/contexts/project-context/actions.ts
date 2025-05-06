import { ProjectActions, ActionProps } from './types';
import { ViewType } from './types';
import {
  FileEntry,
  Project,
  FileResponse,
  ProjectStatus,
  ProjectFile,
  FileMetadata,
} from '@/types/project';

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

export const closeImportWizard = (): ActionProps => ({
  type: ProjectActions.CLEAR_IMPORT_DATA,
});

export const refreshFileSystem = async (
  projectId: string,
  dispatch: (action: ActionProps) => void
) => {
  try {
    dispatch({ type: ProjectActions.SET_LOADING, payload: true });

    console.log(`Refreshing file system for project ${projectId}`);

    // Fetch the project with its file structure
    const response = await fetch(`/api/projects/${projectId}`);

    if (!response.ok) {
      throw new Error('Failed to fetch project structure');
    }

    const project = await response.json();
    console.log('Project data:', project);

    // Update the project in state if needed
    dispatch({
      type: ProjectActions.SET_PROJECT,
      payload: project,
    });

    // Update the file system if fileStructure exists
    if (project.fileStructure) {
      console.log('Setting file system:', project.fileStructure);
      dispatch({
        type: ProjectActions.SET_FILE_SYSTEM,
        payload: project.fileStructure,
      });
    } else {
      console.warn('No file structure found in project data');
    }
  } catch (error) {
    console.error('Error refreshing file system:', error);
    dispatch({
      type: ProjectActions.SET_ERROR,
      payload: error instanceof Error ? error.message : 'Failed to refresh file system',
    });
  } finally {
    dispatch({ type: ProjectActions.SET_LOADING, payload: false });
  }
};
