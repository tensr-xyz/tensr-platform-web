'use client';
import React, { useEffect, useState } from 'react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/atoms/resizable';
import ProjectSidebar from '@/components/templates/project-sidebar';
import AnalysisSidebar from '@/components/templates/analysis-sidebar';
import Titlebar from '@/components/organisms/titlebar';
import Footer from '@/components/organisms/footer';
import { cn } from '@/utils';
import { Tab } from '@/contexts/tabs-context/types';
import { useProject } from '@/contexts/project-context';
import { useTabs } from '@/contexts/tabs-context';
import { addTab } from '@/contexts/tabs-context/actions';
import { ProjectActions } from '@/contexts/project-context/types';
import { LuFolder } from 'react-icons/lu';

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
  const { state: projectState, dispatch: projectDispatch } = useProject();
  const { dispatch: tabDispatch, state: tabState } = useTabs();
  const [leftPanelContent, setLeftPanelContent] = useState<React.ReactNode>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Handle project initialization
  useEffect(() => {
    if (!projectState.currentProject) return;

    const initializeProject = async () => {
      setIsLoading(true);
      const { type, path, initialFile } = projectState.currentProject;

      if (type === 'directory') {
        try {
          // Load file tree for directories
          const files = {};
          // const files = await invoke<FileEntry[]>('read_directory', { path });
          projectDispatch({ type: ProjectActions.SET_FILE_SYSTEM, payload: files });
        } catch (err) {}
      } else if (type === 'file' && initialFile?.metadata) {
        // Create a new tab for files
        const { metadata } = initialFile;

        const columns = metadata.column_names.map(name => ({
          id: name,
          accessor: name,
          header: name,
          width: 150,
          type: 'string',
        }));

        // Create initial rows from preview data
        const initialRows = metadata.preview.map((row, rowIndex) => {
          const dataRow = { id: `row-${rowIndex}` };
          columns.forEach((col, colIndex) => {
            dataRow[col.accessor] = row[colIndex];
          });
          return dataRow;
        });

        const newTab = {
          name: projectState.currentProject.name,
          type: 'spreadsheet' as const,
          content: '',
          isDirty: false,
          data: {
            filePath: initialFile.path,
            initialData: initialRows,
            initialColumns: columns,
            totalRows: metadata.rows,
            totalColumns: metadata.columns,
            columnStats: metadata.columnSummaries || {},
            importSettings: {
              delimiter: metadata.detected_delimiter,
              textQualifier: '"',
              hasHeaders: true,
              trimSpaces: false,
              skipEmptyRows: true,
              columnTypes: {},
              columnNames: metadata.column_names,
            },
            isInitialized: true,
          },
        };

        tabDispatch(addTab(newTab));
      }
      setIsLoading(false);
    };

    initializeProject().catch(err => {
      setIsLoading(false);
    });
  }, [projectState.currentProject]);

  // Handle import data changes
  useEffect(() => {
    if (projectState.importData && !projectState.showImportWizard) {
      projectDispatch({
        type: ProjectActions.SET_SHOW_IMPORT_WIZARD,
        payload: true,
      });
    }
  }, [projectState.importData]);

  const renderContent = () => {
    if (tabState.tabs.length > 0) {
      return children;
    }

    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <LuFolder className="h-12 w-12 mb-4" />
        <h2 className="text-lg font-medium mb-2">No File Open</h2>
        <p className="text-sm">Select a file from the project explorer to begin editing</p>
      </div>
    );
  };

  const rowCount = activeTab?.type === 'spreadsheet' ? activeTab.data?.totalRows || 0 : 0;

  const mainContent = (
    <ResizablePanelGroup
      autoSaveId="conditional"
      direction="horizontal"
      className="flex-1 overflow-hidden"
    >
      {projectState.leftPanelOpen && (
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

          {projectState.toggleTerminal && (
            <>
              <ResizableHandle />
              <ResizablePanel defaultSize={25}>
                <div className="h-full border-t bg-background overflow-auto">
                  <div className="flex items-center px-4 py-2 border-b bg-muted/50">
                    <h2 className="text-sm font-medium">Terminal</h2>
                  </div>
                  <div className="p-4 font-mono text-sm">
                    <div className="text-muted-foreground">$ echo "Terminal ready"</div>
                  </div>
                </div>
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
        isMaximized && 'z-100'
      )}
    >
      {/*<Titlebar activeTab={activeTab} onToggleSidebar={onToggleSidebar} />*/}

      <div className="flex flex-1 overflow-hidden">
        {projectState.leftSidebarOpen && (
          <div className="bg-background">
            <ProjectSidebar onPanelContent={setLeftPanelContent} />
          </div>
        )}
        {mainContent}
      </div>

      {/*{projectState.footerOpen && (*/}
      {/*  <Footer isLoading={isLoading} activeTab={activeTab} rowCount={rowCount} />*/}
      {/*)}*/}
    </div>
  );
};

export default ProjectLayout;
