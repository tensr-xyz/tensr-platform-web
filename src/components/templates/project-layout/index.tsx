import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/atoms/resizable';
import * as ResizablePrimitive from 'react-resizable-panels';
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
import { LeftPanel } from '@/components/organisms/left-panel';

interface ProjectLayoutProps {
  children: React.ReactNode;
  rightPanelOpen: boolean;
  onToggleSidebar: () => void;
  isMaximized?: boolean;
  activeTab?: Tab;
}

const ProjectLayout = ({
  children,
  rightPanelOpen,
  onToggleSidebar,
  isMaximized = false,
  activeTab,
}: ProjectLayoutProps) => {
  const {
    currentProject,
    leftPanelOpen,
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
  const { user } = useAuth();
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

      // Set the left panel with tabs (Files and Analysis)
      setLeftPanelContent(<LeftPanel />);

      // For now, just set up basic project structure
      // The actual file processing is handled by the workspace component
      setIsLoading(false);
    };

    initializeProject().catch(err => {
      setIsLoading(false);
    });
  }, [currentProject, addTab, userId, setLeftPanelContent]);

  // Refresh left panel when fileSystem changes
  useEffect(() => {
    if (currentProject && fileSystem.length > 0) {
      // Re-render the LeftPanel to show updated files
      setLeftPanelContent(<LeftPanel />);
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

  const leftPanelRef = useRef<React.ComponentRef<typeof ResizablePrimitive.Panel>>(null);

  // Control panel collapse/expand based on leftPanelOpen state
  useEffect(() => {
    if (leftPanelRef.current) {
      if (leftPanelOpen) {
        leftPanelRef.current.expand();
      } else {
        leftPanelRef.current.collapse();
      }
    }
  }, [leftPanelOpen]);

  const mainContent = (
    <ResizablePanelGroup
      autoSaveId="conditional"
      direction="horizontal"
      className="flex-1 min-w-0 overflow-hidden"
    >
      <ResizablePrimitive.Panel
        ref={leftPanelRef}
        id="left"
        order={1}
        defaultSize={leftPanelOpen ? 20 : 0}
        minSize={0}
        maxSize={30}
        collapsible
        className="min-w-0"
      >
        <div className="h-full bg-background min-w-0 overflow-auto">{leftPanelContent}</div>
      </ResizablePrimitive.Panel>
      {leftPanelOpen && <ResizableHandle />}

      <ResizablePanel
        id="center"
        order={2}
        defaultSize={leftPanelOpen ? (rightPanelOpen ? 60 : 80) : rightPanelOpen ? 80 : 100}
        className="min-w-0"
      >
        <ResizablePanelGroup direction="vertical" className="h-full">
          <ResizablePanel
            id="main-content"
            order={1}
            defaultSize={terminalOpen ? 75 : 100}
            className="overflow-hidden"
          >
            <div className="h-full flex flex-col">
              <div className="flex-1 overflow-hidden">{renderContent()}</div>
              <Footer isLoading={isLoading} activeTab={activeTab} rowCount={rowCount} />
            </div>
          </ResizablePanel>

          {terminalOpen && (
            <>
              <ResizableHandle />
              <ResizablePanel id="terminal" order={2} defaultSize={25}>
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
            className="min-w-0 overflow-hidden"
          >
            <div className="h-full min-w-0">
              <AnalysisSidebar />
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
      <div className="flex flex-1 min-w-0 overflow-hidden">
        <div className="flex min-w-0 flex-col flex-1">
          {/* Make sure we safely pass tabs to Titlebar */}
          <Titlebar
            onToggleSidebar={onToggleSidebar}
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
