import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTabs } from '@/contexts/tabs-context';
import { updateTab } from '@/contexts/tabs-context/actions';
import { Button } from '@/components/atoms/button';
import {
  LuFolder,
  LuListFilter,
  LuMenu,
  LuMinus,
  LuPanelRight,
  LuPlus,
  LuSquareActivity,
  LuSquareChartGantt,
} from 'react-icons/lu';
import Spreadsheet from '@/components/templates/spreadsheet';
import { useProject } from '@/contexts/project-context';
import { ProjectActions, ViewType } from '@/contexts/project-context/types';
// import { ModelBuilder } from '@/components/templates/model-builder';
import { Notebook } from '@/components/templates/notebook';
import MarkdownViewer from '@/components/organisms/markdown-viewer';
import AnalyticsLayout from '@/components/templates/analytics-layout';
import { Separator } from '@/components/atoms/separator';
import { setLeftPanelContent, toggleLeftPanel } from '@/contexts/project-context/actions';
import { FolderComponent } from '@/components/organisms/file-tree';

interface Column {
  id: string;
  accessor: string;
  header: string;
  width: number;
  type: string;
}

interface TabData {
  filePath?: string;
  initialData?: Record<string, any>[];
  initialColumns?: Column[];
  columnStats?: Record<string, any>;
  totalRows?: number;
}

export interface BaseTab {
  id: string;
  name: string;
  type: ViewType;
  isDirty: boolean;
  path?: string;
}

export interface SpreadsheetTab extends BaseTab {
  type: ViewType.SPREADSHEET;
  data: Required<TabData>;
}

export interface MarkdownTab extends BaseTab {
  type: ViewType.MARKDOWN;
  path: string;
}

interface RowSelection {
  [key: string]: boolean;
}

export type Tab = SpreadsheetTab | MarkdownTab | BaseTab;

// Type guard
function isSpreadsheetTab(tab: Tab): tab is SpreadsheetTab {
  return tab.type === ViewType.SPREADSHEET;
}

// Utility Types
type DebouncedFunction<T extends (...args: any[]) => any> = {
  (...args: Parameters<T>): void;
  cancel: () => void;
};

// Debounce utility
function debounce<T extends (...args: any[]) => any>(fn: T, delay: number): DebouncedFunction<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  function debounced(...args: Parameters<T>) {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
    }, delay);
  }

  debounced.cancel = () => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }
  };

  return debounced;
}

// Props interface
interface TabManagerProps {
  activeTab?: Tab;
  tabs: Tab[];
  onTabClose: (id: string) => void;
  onToggleSidebar: () => void;
}

// Component
const TabManager: React.FC<TabManagerProps> = ({
  activeTab,
  tabs,
  onTabClose,
  onToggleSidebar,
}) => {
  // State
  const [showStats, setShowStats] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  console.log(activeTab);

  // Hooks
  const { state: tabState, dispatch } = useTabs();
  const { state, dispatch: projectDispatch } = useProject();

  const [activeRowSelection, setActiveRowSelection] = useState<RowSelection>({});

  // Handlers
  const createDebouncedHandler = useCallback(
    (tab: SpreadsheetTab) => {
      return debounce(async (newData: Record<string, any>[]) => {
        try {
          dispatch(
            updateTab(tab.id, {
              data: {
                ...tab.data,
                initialData: newData,
              },
              isDirty: true,
            })
          );
        } catch (e) {}
      }, 500);
    },
    [dispatch]
  );

  const debouncedHandlers = useMemo(() => {
    return tabs.filter(isSpreadsheetTab).reduce(
      (acc, tab) => {
        acc[tab.id] = createDebouncedHandler(tab);
        return acc;
      },
      {} as Record<string, ReturnType<typeof createDebouncedHandler>>
    );
  }, [tabs, createDebouncedHandler]);

  const handleToggleFolder = useCallback(() => {
    if (!state.leftPanelOpen) {
      // Set panel content first, then open the panel
      projectDispatch(setLeftPanelContent(<FolderComponent />));
      projectDispatch(toggleLeftPanel(true));
    } else {
      // Just close the panel
      projectDispatch(toggleLeftPanel(false));
    }
  }, [state.leftPanelOpen, projectDispatch]);

  const [spreadsheetVersion, setSpreadsheetVersion] = useState(0);

  // 2. Update your handleAddRow and handleDeleteRows functions to increment the version:
  const handleAddRow = useCallback(() => {
    if (!activeTab || !isSpreadsheetTab(activeTab)) {
      return;
    }

    try {
      // Get the current data
      const currentData = [...activeTab.data.initialData];

      // Create an empty row
      const emptyRow: Record<string, any> = {};

      // Fill with empty values
      activeTab.data.initialColumns.forEach(col => {
        emptyRow[col.id] = '';
      });

      // Find insertion index
      let insertIndex = currentData.length;
      const selectedIndices = Object.keys(activeRowSelection)
        .filter(key => activeRowSelection[key])
        .map(key => parseInt(key, 10));

      if (selectedIndices.length > 0) {
        insertIndex = selectedIndices[0] + 1;
      }

      // Insert the new row
      currentData.splice(insertIndex, 0, emptyRow);

      // Update tab data
      dispatch(
        updateTab(activeTab.id, {
          data: {
            ...activeTab.data,
            initialData: currentData,
          },
          isDirty: true,
        })
      );

      // Force re-render of the spreadsheet
      setSpreadsheetVersion(prev => prev + 1);
    } catch (e) {}
  }, [activeTab, dispatch, activeRowSelection]);

  const handleDeleteRows = useCallback(() => {
    if (!activeTab || !isSpreadsheetTab(activeTab)) return;

    try {
      // Get the current data
      const currentData = [...activeTab.data.initialData];

      // Get selected row indices from the activeRowSelection object
      const indicesToDelete = Object.keys(activeRowSelection)
        .filter(key => activeRowSelection[key])
        .map(key => parseInt(key, 10))
        .sort((a, b) => b - a); // Sort in descending order

      if (indicesToDelete.length === 0) {
        return; // Nothing to delete
      }

      // Delete rows starting from the highest index to avoid shifting issues
      indicesToDelete.forEach(index => {
        currentData.splice(index, 1);
      });

      // Update the tab data
      dispatch(
        updateTab(activeTab.id, {
          data: {
            ...activeTab.data,
            initialData: currentData,
          },
          isDirty: true,
        })
      );

      // Force re-render of the spreadsheet
      setSpreadsheetVersion(prev => prev + 1);
    } catch (e) {}
  }, [activeTab, dispatch, activeRowSelection]);

  // Cleanup
  useEffect(() => {
    return () => {
      Object.values(debouncedHandlers).forEach(handler => handler.cancel());
    };
  }, [debouncedHandlers]);

  const renderSpreadsheetContent = (tab: SpreadsheetTab) => (
    <div className="h-full">
      <Spreadsheet
        key={`${tab.id}-${spreadsheetVersion}`}
        initialData={tab.data.initialData}
        initialColumns={tab.data.initialColumns}
        columnStats={tab.data.columnStats}
        showMenu={showMenu}
        showStats={showStats}
        showFilters={showFilters}
        onCloseFilters={() => setShowFilters(false)}
        onChange={debouncedHandlers[tab.id]}
        filePath={tab.data.filePath}
        totalRowCount={tab.data.totalRows}
        tabId={tab.id}
        onSelectionChange={setActiveRowSelection}
      />
    </div>
  );

  const renderTabContent = (tab: Tab) => {
    if (tab.id !== activeTab?.id) return null;

    if (tab.type === ViewType.MARKDOWN) {
      return (
        <div className="h-full overflow-auto bg-background">
          <MarkdownViewer filePath={tab.path || ''} />
        </div>
      );
    }

    if (!isSpreadsheetTab(tab)) {
      return (
        <div className="h-full flex items-center justify-center text-muted-foreground">
          No content available
        </div>
      );
    }

    const spreadsheetContent = renderSpreadsheetContent(tab);

    switch (state.activeView) {
      case ViewType.SPREADSHEET:
      case ViewType.CHARTS:
        return (
          <AnalyticsLayout filePath={tab.data.filePath} columns={tab.data.initialColumns}>
            {spreadsheetContent}
          </AnalyticsLayout>
        );

      // case ViewType.MODEL_BUILDER:
      //   return (
      //     <div className="h-full">
      //       <ModelBuilder />
      //     </div>
      //   );

      case ViewType.NOTEBOOK:
        return (
          <div className="h-full">
            <Notebook />
          </div>
        );

      // case ViewType.PLUGINS:
      //   return (
      //     <div className="h-full">
      //       <PluginsLayout />
      //     </div>
      //   );

      default:
        return (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            No content available
          </div>
        );
    }
  };

  return (
    <div className="flex h-full flex-col relative bg-background">
      <div className="flex h-10 items-center justify-between border-b border-border bg-background z-10">
        <div className="flex flex-row items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 mx-2"
            onClick={handleToggleFolder}
            data-state={state.leftPanelOpen ? 'active' : 'inactive'}
          >
            <LuFolder />
          </Button>
          <h1 className="text-sm font-semibold">{activeTab?.name}</h1>
        </div>
        <div className="flex-none flex items-center px-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setShowMenu(prev => !prev)}
            data-state={showMenu ? 'active' : 'inactive'}
          >
            <LuMenu />
            <span className="sr-only">Toggle Menu</span>
          </Button>
          <Button
            data-sidebar="trigger"
            variant="ghost"
            size="icon"
            onClick={onToggleSidebar}
            className="h-7 w-7"
          >
            <LuPanelRight />
            <span className="sr-only">Toggle Sidebar</span>
          </Button>
        </div>
      </div>

      {/* Tab Content Area - Tabs are now only responsible for rendering content */}
      <div className="absolute inset-0 top-10 bg-background">
        {tabs.map(tab => (
          <div
            key={tab.id}
            className="absolute inset-0 bg-background flex flex-col"
            style={{ display: activeTab?.id === tab.id ? 'flex' : 'none' }}
          >
            {showMenu && (
              <div className="flex flex-row items-center justify-between bg-background border-b border-border px-1 min-h-8">
                <div className="flex flex-row items-center">
                  <Button size="icon" variant="ghost" onClick={handleAddRow}>
                    <LuPlus />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={handleDeleteRows}>
                    <LuMinus />
                  </Button>
                  <Separator orientation="vertical" className="h-4 mx-2" />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      projectDispatch({ type: ProjectActions.SET_VIEW, payload: ViewType.CHARTS })
                    }
                    data-state={state.activeView === ViewType.CHARTS ? 'active' : 'inactive'}
                  >
                    <LuSquareActivity />
                    <span className="sr-only">Toggle Analytics</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowStats(prev => !prev)}
                    data-state={showStats ? 'active' : 'inactive'}
                  >
                    <LuSquareChartGantt />
                    <span className="sr-only">Toggle Stats</span>
                  </Button>
                </div>
                <div className="flex flex-row items-center">
                  <Button size="icon" variant="ghost" onClick={() => setShowFilters(!showFilters)}>
                    <LuListFilter />
                  </Button>
                </div>
              </div>
            )}
            <div
              className="flex-1 relative"
              style={{
                height: showMenu ? 'calc(100% - 32px)' : '100%',
              }}
            >
              {renderTabContent(tab)}
            </div>
          </div>
        ))}
        {tabs.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background text-muted-foreground">
            <LuFolder className="h-12 w-12 mb-4" />
            <h2 className="text-lg font-medium mb-2">No File Open</h2>
            <p className="text-sm">Select a file from the project explorer to begin editing</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TabManager;
