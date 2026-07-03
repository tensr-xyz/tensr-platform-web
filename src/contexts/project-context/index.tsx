'use client';
import { createContext, useContext, useReducer } from 'react';
import reducer from './reducer';
import { ProjectContextProps, ProviderProps, ViewType } from './types';
import { LeftPanel } from '@/components/organisms/left-panel';

const ProjectContext = createContext<ProjectContextProps | undefined>(undefined);

function ProjectProvider({ children }: ProviderProps) {
  const [state, dispatch] = useReducer(reducer, {
    activeView: ViewType.SPREADSHEET,
    rightPanelOpen: false,
    leftPanelOpen: true,
    leftSidebarOpen: true,
    footerOpen: true,
    toggleTerminal: false,
    isMaximized: false,
    currentProject: null,
    fileSystem: [],
    selectedPath: null,
    isLoading: false,
    error: null,
    importData: null,
    leftPanelContent: <LeftPanel />,
  });

  const value = { state, dispatch };
  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}

export { ProjectProvider, useProject };
