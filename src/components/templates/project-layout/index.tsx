import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/atoms/resizable';
import ProjectSidebar from '@/components/templates/project-sidebar';
import AnalysisSidebar from '@/components/templates/analysis-sidebar';
import Titlebar from '@/components/organisms/titlebar';
import Footer from '@/components/organisms/footer';
import Terminal from '@/components/organisms/terminal';
import { cn } from '@/utils';
import { Column, Tab, TabData } from '@/stores/tabs-store';
import { useProjectStore } from '@/stores/project-store';

import { useTabsStore } from '@/stores/tabs-store';
import { ViewType } from '@/stores/project-store';
import { FileEntry } from '@/types/project';
import { useCollaboration } from '@/hooks/use-collaboration';
import Loading from '@/components/molecules/loading';
import useAuth from '@/hooks/api/use-auth';
import { FolderComponent } from '@/components/organisms/file-tree';

interface ProjectLayoutProps {
  children: React.ReactNode;
  rightPanelOpen: boolean;
  onToggleSidebar: () => void;
  onToggleLeftSidebar: () => void;
  isMaximized?: boolean;
  activeTab?: Tab;
}

const ProjectLayout = ({
  children,
  rightPanelOpen,
  onToggleSidebar,
  onToggleLeftSidebar,
  isMaximized = false,
  activeTab,
}: ProjectLayoutProps) => {
  const {
    currentProject,
    leftPanelOpen,
    leftSidebarOpen,
    leftPanelContent,
    terminalOpen,
    importData,
    showImportWizard,
    fileSystem,
    setProject,
    setFileSystem,
    setImportData,
    setShowImportWizard,
    toggleLeftPanel,
    setLeftPanelContent,
    toggleTerminal,
  } = useProjectStore();
  const { addTab, closeTab, tabs = [] } = useTabsStore();
  const { tokens, user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  // Make sure we have a valid resource.id before using it
  const resourceId = currentProject?.id || '';
  const userId = user?.userId;

  useCollaboration(resourceId);

  // Handle project initialization
  useEffect(() => {
    if (!currentProject) return;

    const initializeProject = async () => {
      setIsLoading(true);

      // Set the file tree as the default left panel content
      setLeftPanelContent(<FolderComponent />);

      // Ensure the left panel is open to show the file tree
      if (!leftPanelOpen) {
        toggleLeftPanel(true);
      }

      // For now, just set up basic project structure
      // The actual file processing is handled by the workspace component
      setIsLoading(false);
    };

    initializeProject().catch(err => {
      setIsLoading(false);
    });
  }, [currentProject, addTab, userId, setLeftPanelContent, leftPanelOpen, toggleLeftPanel]);

  // Refresh file tree when fileSystem changes
  useEffect(() => {
    if (currentProject && fileSystem.length > 0) {
      // Re-render the FolderComponent to show updated files
      setLeftPanelContent(<FolderComponent />);
    }
  }, [fileSystem, currentProject, setLeftPanelContent]);

  // Add keyboard shortcut for terminal toggle
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + ` to toggle terminal
      if ((event.ctrlKey || event.metaKey) && event.key === '`') {
        event.preventDefault();
        toggleTerminal(!terminalOpen);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [terminalOpen, toggleTerminal]);

  // Handle import data changes
  useEffect(() => {
    if (importData && !showImportWizard) {
      setShowImportWizard(true);
    }
  }, [importData, showImportWizard, setShowImportWizard]);

  const handleTabClose = (tabId: string) => {
    if (tabId) {
      closeTab(tabId);
    }
  };

  const renderContent = () => {
    // Always return children (which includes TabManager)
    return children;
  };

  const rowCount =
    activeTab?.type === 'spreadsheet' && activeTab.data
      ? (activeTab.data as TabData)?.totalRows || 0
      : 0;

  const mainContent = (
    <ResizablePanelGroup
      autoSaveId="conditional"
      direction="horizontal"
      className="flex-1 overflow-hidden"
    >
      {leftPanelOpen && (
        <>
          <ResizablePanel id="left" order={1} defaultSize={20} minSize={15} maxSize={30}>
            <div className="h-full bg-background overflow-auto">{leftPanelContent}</div>
          </ResizablePanel>
          <ResizableHandle />
        </>
      )}

      <ResizablePanel id="center" order={2} defaultSize={rightPanelOpen ? 60 : 80}>
        <ResizablePanelGroup direction="vertical" className="h-full">
          <ResizablePanel defaultSize={75} className="overflow-hidden">
            <div className="h-full flex flex-col">
              <div className="flex-1 overflow-hidden">{renderContent()}</div>
              <Footer isLoading={isLoading} activeTab={activeTab} rowCount={rowCount} />
            </div>
          </ResizablePanel>

          {terminalOpen && (
            <>
              <ResizableHandle />
              <ResizablePanel defaultSize={25}>
                <Terminal />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </ResizablePanel>

      {rightPanelOpen && (
        <>
          <ResizableHandle />
          <ResizablePanel
            id="right"
            order={3}
            defaultSize={20}
            minSize={10}
            className="overflow-hidden"
          >
            <div className="h-full">
              <AnalysisSidebar onToggleSidebar={onToggleSidebar} />
            </div>
          </ResizablePanel>
        </>
      )}
    </ResizablePanelGroup>
  );

  return (
    <div
      className={cn(
        'fixed inset-0 bg-background text-foreground z-50 flex flex-col',
        isMaximized && 'z-[100]'
      )}
    >
      <div className="flex flex-1 overflow-hidden">
        {leftSidebarOpen && (
          <div className="bg-background">
            <ProjectSidebar />
          </div>
        )}
        <div className="flex flex-col flex-1">
          {/* Make sure we safely pass tabs to Titlebar */}
          <Titlebar
            onToggleSidebar={onToggleSidebar}
            onToggleLeftSidebar={onToggleLeftSidebar}
            tabs={tabs ?? []}
            activeTab={activeTab}
            onTabClose={handleTabClose}
          />
          {mainContent}
        </div>
      </div>

      {/*{projectState.footerOpen && (*/}
      {/*  <Footer isLoading={isLoading} activeTab={activeTab} rowCount={rowCount} />*/}
      {/*)}*/}
    </div>
  );
};

export default ProjectLayout;
