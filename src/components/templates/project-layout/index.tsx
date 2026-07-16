import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/atoms/resizable';
import * as ResizablePrimitive from 'react-resizable-panels';
import WorkspaceRightPanel from '@/components/organisms/workspace-right-panel';
import Titlebar from '@/components/organisms/titlebar';
import Footer from '@/components/organisms/footer';
import WorkspaceTerminal from '@/components/organisms/terminal/workspace-terminal';
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
import { AnalysisSetupHost } from '@/components/templates/analysis/analysis-setup-provider';
import { WorkspaceErrorBoundary } from '@/components/molecules/workspace-error-boundary';
import { canRedoTab, canUndoTab, redoTab, undoTab } from '@/lib/tab-history';
import { isEditableKeyboardTarget, isTerminalToggleShortcut } from '@/utils/keyboard-shortcuts';

interface ProjectLayoutProps {
  children: React.ReactNode;
  rightPanelOpen: boolean;
  onToggleSidebar: () => void;
  isMaximized?: boolean;
  activeTab?: Tab;
}

/** Horizontal split sizes (% of group). Right assistant panel stays wider than the left sidebar. */
const LEFT_PANEL_MIN_SIZE = 18;
const LEFT_PANEL_DEFAULT_SIZE = 18;
const LEFT_PANEL_MAX_SIZE = 28;

const RIGHT_PANEL_MIN_SIZE = 22;
/** Agent-more-present default (B-soft); spreadsheet stays center. */
const RIGHT_PANEL_DEFAULT_SIZE = 36;
const RIGHT_PANEL_MAX_SIZE = 44;

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
    fileSystem,
    setProject,
    setFileSystem,
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

  // Workspace keyboard shortcuts (terminal, undo/redo)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey;

      if (isTerminalToggleShortcut(event)) {
        event.preventDefault();
        event.stopPropagation();
        toggleTerminal(!terminalOpen);
        return;
      }

      if (mod && !event.altKey && (event.key === 'z' || event.key === 'Z')) {
        if (isEditableKeyboardTarget(event.target)) return;
        const tabId = activeTab?.id;
        if (!tabId) return;

        if (event.shiftKey) {
          if (!canRedoTab(tabId)) return;
          event.preventDefault();
          redoTab(tabId);
        } else {
          if (!canUndoTab(tabId)) return;
          event.preventDefault();
          undoTab(tabId);
        }
      }

      if (mod && !event.shiftKey && !event.altKey && (event.key === 'y' || event.key === 'Y')) {
        if (isEditableKeyboardTarget(event.target)) return;
        const tabId = activeTab?.id;
        if (!tabId || !canRedoTab(tabId)) return;
        event.preventDefault();
        redoTab(tabId);
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [terminalOpen, toggleTerminal, activeTab?.id]);

  const handleTabClose = (tabId: string) => {
    if (tabId) {
      closeTab(tabId);
    }
  };

  const renderContent = () => {
    // Always return children (which includes TabManager)
    return children;
  };

  const isAnalysisReportView = activeTab?.type === ViewType.ANALYSIS_REPORT;

  const rowCount =
    activeTab?.type === 'spreadsheet' && activeTab.data
      ? (activeTab.data as TabData)?.totalRows || 0
      : 0;

  const closedLeftPanelForReportRef = useRef<string | null>(null);

  // Sheet chrome (column panel) does not apply to analysis report tabs.
  useEffect(() => {
    if (!isAnalysisReportView) {
      closedLeftPanelForReportRef.current = null;
      return;
    }
    if (activeTab?.id && closedLeftPanelForReportRef.current !== activeTab.id && leftPanelOpen) {
      toggleLeftPanel(false);
      closedLeftPanelForReportRef.current = activeTab.id;
    }
  }, [activeTab?.id, isAnalysisReportView, leftPanelOpen, toggleLeftPanel]);

  const mainContent = isAnalysisReportView ? (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{renderContent()}</div>
  ) : (
    <ResizablePanelGroup
      autoSaveId="conditional"
      direction="horizontal"
      className="flex-1 min-w-0 overflow-hidden"
    >
      {leftPanelOpen ? (
        <>
          <ResizablePrimitive.Panel
            id="left"
            order={1}
            defaultSize={LEFT_PANEL_DEFAULT_SIZE}
            minSize={LEFT_PANEL_MIN_SIZE}
            maxSize={LEFT_PANEL_MAX_SIZE}
            className="min-w-0"
          >
            <div className="h-full min-w-[16rem] bg-background overflow-auto">
              {leftPanelContent}
            </div>
          </ResizablePrimitive.Panel>
          <ResizableHandle />
        </>
      ) : null}

      <ResizablePanel
        id="center"
        order={2}
        defaultSize={
          leftPanelOpen
            ? rightPanelOpen
              ? 100 - LEFT_PANEL_DEFAULT_SIZE - RIGHT_PANEL_DEFAULT_SIZE
              : 100 - LEFT_PANEL_DEFAULT_SIZE
            : rightPanelOpen
              ? 100 - RIGHT_PANEL_DEFAULT_SIZE
              : 100
        }
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
              <div className="flex-1 overflow-hidden">
                <WorkspaceErrorBoundary title="Workspace panel error">
                  {renderContent()}
                </WorkspaceErrorBoundary>
              </div>
              <Footer isLoading={isLoading} activeTab={activeTab} rowCount={rowCount} />
            </div>
          </ResizablePanel>

          {terminalOpen && (
            <>
              <ResizableHandle />
              <ResizablePanel id="terminal" order={2} defaultSize={25}>
                <WorkspaceTerminal />
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
            defaultSize={RIGHT_PANEL_DEFAULT_SIZE}
            minSize={RIGHT_PANEL_MIN_SIZE}
            maxSize={RIGHT_PANEL_MAX_SIZE}
            className="min-w-0 overflow-hidden"
          >
            <div className="h-full min-w-[18rem]">
              <WorkspaceErrorBoundary title="Assistant panel error">
                <WorkspaceRightPanel />
              </WorkspaceErrorBoundary>
            </div>
          </ResizablePanel>
        </>
      )}
    </ResizablePanelGroup>
  );

  return (
    <>
      <AnalysisSetupHost />
      <div
        className={cn(
          'fixed inset-0 bg-background text-foreground z-50 flex flex-col',
          isMaximized && 'z-[100]'
        )}
      >
        <div className="flex min-h-0 flex-1 min-w-0 overflow-hidden">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <Titlebar
              onToggleSidebar={onToggleSidebar}
              tabs={tabs ?? []}
              activeTab={activeTab}
              onTabClose={handleTabClose}
            />
            {mainContent}
          </div>
        </div>
      </div>
    </>
  );
};

export default ProjectLayout;
