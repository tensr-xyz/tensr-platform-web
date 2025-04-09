import { ProjectActions, ActionProps } from './types';
import { ViewType } from './types';
import { FileEntry, Project, FileResponse } from '@/types/project';

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

export const openFile = async (path: string): Promise<ActionProps> => {
  const fileName = path.split('\\').pop()?.split('/').pop();
  if (!fileName) throw new Error('Invalid file path');

  // const response = await invoke<FileResponse>(
  //   fileName.endsWith('.csv') ? 'read_csv' : 'read_excel',
  //   { request: { path } }
  // );

  const response = {};

  const project: Project = {
    id: crypto.randomUUID(),
    name: fileName,
    path,
    type: 'file',
    lastOpened: new Date(),
    initialFile: {
      path,
      metadata: response.metadata,
    },
  };

  return {
    type: ProjectActions.SET_PROJECT,
    payload: project,
  };
};

export const openDirectory = async (path: string, dispatch: (action: ActionProps) => void) => {
  const dirName = path.split('\\').pop()?.split('/').pop();
  if (!dirName) throw new Error('Invalid directory path');

  const project: Project = {
    id: crypto.randomUUID(),
    name: dirName,
    path,
    type: 'directory',
    lastOpened: new Date(),
  };

  // const files = await invoke<FileEntry[]>('read_directory', { path });
  const files = {};

  dispatch({
    type: ProjectActions.SET_PROJECT,
    payload: {
      project,
      files,
    },
  });

  return project;
};

export const closeImportWizard = (): ActionProps => ({
  type: ProjectActions.CLEAR_IMPORT_DATA,
});

export const refreshFileSystem = async (path: string, dispatch: (action: ActionProps) => void) => {
  try {
    dispatch({ type: ProjectActions.SET_LOADING, payload: true });
    // const files = await invoke<FileEntry[]>('read_directory', { path });
    const files = {};
    dispatch({ type: ProjectActions.SET_FILE_SYSTEM, payload: files });
  } catch (error) {
    dispatch({
      type: ProjectActions.SET_ERROR,
      payload: error instanceof Error ? error.message : 'Failed to refresh file system',
    });
  } finally {
    dispatch({ type: ProjectActions.SET_LOADING, payload: false });
  }
};
