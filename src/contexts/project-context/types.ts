import React from 'react';
import { Project, FileEntry } from '@/types/project';
import { ImportData } from '@/types/file';

export interface ProviderProps {
  children: React.ReactNode;
}

export enum ViewType {
  SPREADSHEET = 'spreadsheet',
  CHARTS = 'charts',
  MODEL_BUILDER = 'model_builder',
  NOTEBOOK = 'notebook',
  PLUGINS = 'plugins',
  MARKDOWN = 'markdown',
  SEM = 'sem',
}

export enum ProjectActions {
  SET_VIEW = 'SET_VIEW',
  TOGGLE_RIGHT_PANEL = 'TOGGLE_RIGHT_PANEL',
  TOGGLE_LEFT_PANEL = 'TOGGLE_LEFT_PANEL',
  TOGGLE_FOOTER = 'TOGGLE_FOOTER',
  TOGGLE_LEFT_SIDEBAR = 'TOGGLE_LEFT_SIDEBAR',
  TOGGLE_TERMINAL = 'TOGGLE_TERMINAL',
  SET_MAXIMIZED = 'SET_MAXIMIZED',
  SET_PROJECT = 'SET_PROJECT',
  SET_FILE_SYSTEM = 'SET_FILE_SYSTEM',
  SET_SELECTED_PATH = 'SET_SELECTED_PATH',
  SET_LOADING = 'SET_LOADING',
  SET_ERROR = 'SET_ERROR',
  CLEAR_PROJECT = 'CLEAR_PROJECT',
  SET_IMPORT_DATA = 'SET_IMPORT_DATA',
  SET_SHOW_IMPORT_WIZARD = 'SET_SHOW_IMPORT_WIZARD',
  CLEAR_IMPORT_DATA = 'CLEAR_IMPORT_DATA',
  SET_LEFT_PANEL_CONTENT = 'SET_LEFT_PANEL_CONTENT',
}

export interface ActionProps {
  type: ProjectActions;
  payload?: any;
}

export interface ProjectState {
  activeView: ViewType;
  rightPanelOpen: boolean;
  leftPanelOpen: boolean;
  leftSidebarOpen: boolean;
  footerOpen: boolean;
  toggleTerminal: boolean;
  isMaximized: boolean;
  currentProject: Project | null;
  fileSystem: FileEntry[];
  selectedPath: string | null;
  isLoading: boolean;
  error: string | null;
  importData: ImportData | null;
  showImportWizard: boolean;
  leftPanelContent: React.ReactNode;
}

export interface ProjectContextProps {
  state: ProjectState;
  dispatch: (action: ActionProps) => void;
}
