import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useTabsStore } from '@/stores/tabs-store';
import { Button } from '@/components/atoms/button';
import {
  PanelLeftOpen,
  PanelLeftClose,
  PanelRightOpen,
  PanelRightClose,
  Folder,
  Filter,
  BarChart3,
  Save,
  Undo2,
  Redo2,
  History,
  Clock,
  Download,
  RotateCcw,
  Play,
  Plus,
  CircleStop,
} from 'lucide-react';
import { FEATURE_FLAGS } from '@/lib/feature-flags';
import { getDatasetIdFromTab } from '@/lib/workspace-dataset';
import { AnalysisResultPlaceholder } from '@/components/organisms/analysis-result-placeholder';
import { cn } from '@/utils';
import { useNotebookWorkspaceStore } from '@/stores/notebook-workspace-store';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/select';
import Spreadsheet from '@/components/templates/spreadsheet';
import { useWorkspaceSheetStatusStore } from '@/stores/workspace-sheet-status-store';
import { useProjectStore } from '@/stores/project-store';
import { ViewType as TabViewType } from '@/stores/tabs-store';
import { ViewType } from '@/stores/project-store';
import { Notebook } from '@/components/templates/notebook';
import MarkdownViewer from '@/components/organisms/markdown-viewer';
import { AnalysisReportLayout } from '@/components/organisms/analysis-report-layout';
import AnalyticsLayout from '@/components/templates/analytics-layout';
import { Separator } from '@/components/atoms/separator';
// Removed context actions import - using store actions instead
import { LeftPanel } from '@/components/organisms/left-panel';
import { useFileHandler } from '@/hooks/api/use-file';
import { redoTab, undoTab } from '@/lib/tab-history';
import { useTabHistoryStore } from '@/stores/tab-history-store';
import { toast } from '@/hooks/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/molecules/dialog';
import Loading from '@/components/molecules/loading';

type StoreTab = import('@/stores/tabs-store').Tab;
type RowSelection = Record<string, boolean>;
type SpreadsheetTab = StoreTab & {
  type: TabViewType.SPREADSHEET;
  data: import('@/stores/tabs-store').TabData;
};

function isSpreadsheetTab(tab: StoreTab | undefined | null): tab is SpreadsheetTab {
  return !!tab && tab.type === TabViewType.SPREADSHEET && !!tab.data;
}

function extractFileId(tab: StoreTab): string | null {
  // Prefer tensr-api dataset id if present; fall back to path/filePath.
  return (
    getDatasetIdFromTab(tab) ??
    tab.path ??
    (tab.data as { filePath?: string } | undefined)?.filePath ??
    null
  );
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
  activeTab?: StoreTab;
  tabs: StoreTab[];
  onTabClose: (id: string) => void;
  onToggleSidebar: () => void;
  rightPanelOpen?: boolean;
}

// Component
const TabManager: React.FC<TabManagerProps> = ({
  activeTab,
  tabs,
  onTabClose,
  onToggleSidebar,
  rightPanelOpen = false,
}) => {
  // State
  const [showStats, setShowStats] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  // Reveal the filter row when chat / column menu requests it.
  useEffect(() => {
    const onFilterColumn = (event: Event) => {
      const detail = (event as CustomEvent<{ showFilters?: boolean; showFilterBar?: boolean }>)
        .detail;
      if (detail?.showFilters || detail?.showFilterBar) setShowFilters(true);
    };
    const onApplyFilters = (event: Event) => {
      const detail = (event as CustomEvent<{ showFilterBar?: boolean }>).detail;
      if (detail?.showFilterBar) setShowFilters(true);
    };
    window.addEventListener('tensr:filter-column', onFilterColumn as EventListener);
    window.addEventListener('tensr:apply-column-filters', onApplyFilters as EventListener);
    return () => {
      window.removeEventListener('tensr:filter-column', onFilterColumn as EventListener);
      window.removeEventListener('tensr:apply-column-filters', onApplyFilters as EventListener);
    };
  }, []);
  const [savingStatus, setSavingStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);

  const activeHistory = useTabHistoryStore(s =>
    activeTab?.id ? s.byTab[activeTab.id] : undefined
  );
  const canUndo = (activeHistory?.past.length ?? 0) > 0;
  const canRedo = (activeHistory?.future.length ?? 0) > 0;
  const [fileVersions, setFileVersions] = useState<any[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [reverting, setReverting] = useState(false);

  // Hooks
  const { updateTab, setTabDirty, addTab, closeTab, setActiveTab } = useTabsStore();
  const {
    currentProject,
    leftPanelOpen,
    toggleLeftPanel,
    activeView,
    setLeftPanelContent,
    setView,
  } = useProjectStore();

  useEffect(() => {
    if (activeView === ViewType.SEM) {
      setView(ViewType.SPREADSHEET);
    }
    if (!FEATURE_FLAGS.CHARTS_TAB_ENABLED && activeView === ViewType.CHARTS) {
      setView(ViewType.SPREADSHEET);
    }
  }, [activeView, setView]);

  const {
    saveFile,
    isSaving,
    lastSavedTime,
    getFileVersions,
    getFileVersion,
    revertToVersion,
    setupAutoSave,
  } = useFileHandler({});

  const [, setActiveRowSelection] = useState<RowSelection>({});
  const setSheetStatus = useWorkspaceSheetStatusStore(s => s.setStatus);
  const clearSheetStatus = useWorkspaceSheetStatusStore(s => s.clearStatus);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Get current file ID - with null checks
  const currentFileId = useMemo(() => {
    if (!activeTab) return null;
    if (isSpreadsheetTab(activeTab)) {
      return extractFileId(activeTab);
    }
    if (activeTab.path) {
      const parts = activeTab.path.split('/');
      if (parts.length >= 3) return parts[2];
      return activeTab.path;
    }
    return null;
  }, [activeTab]);

  // Handlers
  const createDebouncedHandler = useCallback(
    (tab: SpreadsheetTab) => {
      return debounce(async (newData: Record<string, any>[]) => {
        try {
          updateTab(tab.id, {
            data: {
              ...tab.data,
              initialData: newData,
            },
            isDirty: true,
          });

          // If auto-save is enabled, schedule a save
          if (autoSaveEnabled && currentFileId) {
            // Clear any existing auto-save timer
            if (autoSaveTimerRef.current) {
              clearTimeout(autoSaveTimerRef.current);
            }

            // Set a new timer
            autoSaveTimerRef.current = setTimeout(() => {
              handleSaveFile();
            }, 30000); // Auto-save after 30 seconds of inactivity
          }
        } catch (e) {
          console.error('Error in debounced handler:', e);
        }
      }, 500);
    },
    [autoSaveEnabled, currentFileId]
  );

  const debouncedHandlers = useMemo(() => {
    // Add safety check for tabs
    if (!tabs || !Array.isArray(tabs)) {
      return {};
    }

    return tabs.filter(isSpreadsheetTab).reduce(
      (acc, tab) => {
        acc[tab.id] = createDebouncedHandler(tab);
        return acc;
      },
      {} as Record<string, ReturnType<typeof createDebouncedHandler>>
    );
  }, [tabs, createDebouncedHandler]);

  useEffect(() => {
    if (!activeTab || !isSpreadsheetTab(activeTab)) {
      clearSheetStatus();
    }
  }, [activeTab?.id, activeTab?.type, clearSheetStatus]);

  // Handle save
  const handleSaveFile = async () => {
    if (!activeTab || !isSpreadsheetTab(activeTab)) {
      toast({
        title: 'Cannot save',
        description: 'No active file',
        variant: 'destructive',
      });
      return;
    }

    if (!currentFileId) {
      toast({
        title: 'Save As required',
        description: 'This file has not been saved before. Please use "Save As" to save it.',
        variant: 'destructive',
      });
      return;
    }

    // Don't save if the file isn't dirty
    if (!activeTab.isDirty) {
      toast({
        title: 'No changes to save',
        description: 'The file is already up to date',
      });
      return;
    }

    setSavingStatus('saving');

    try {
      const data = (activeTab.data as { initialData?: Record<string, any>[] } | undefined)
        ?.initialData;
      if (!data) {
        toast({
          title: 'Nothing to save',
          description: 'This tab has no loaded rows yet.',
          variant: 'destructive',
        });
        setSavingStatus('error');
        return;
      }
      const success = await saveFile(currentFileId, data);

      if (success) {
        // Update tab to mark as no longer dirty
        updateTab(activeTab.id, {
          isDirty: false,
        });

        setSavingStatus('saved');
        toast({
          title: 'File saved',
          description: 'Your changes have been saved successfully',
        });
      }
    } catch (error) {
      console.error('Error saving file:', error);
      setSavingStatus('error');
      toast({
        title: 'Save failed',
        description: 'There was an error saving your file. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setTimeout(() => {
        if (savingStatus === 'saved' || savingStatus === 'error') {
          setSavingStatus('idle');
        }
      }, 3000);
    }
  };

  // Handle version history
  const handleOpenVersionHistory = async () => {
    if (!activeTab || !isSpreadsheetTab(activeTab)) {
      toast({
        title: 'No file selected',
        description: 'Please select a file to view its version history',
        variant: 'destructive',
      });
      return;
    }
    if (!currentFileId) {
      toast({
        title: 'Save As required',
        description: 'This file has not been saved before. Please use "Save As" to save it.',
        variant: 'destructive',
      });
      return;
    }
    setShowVersionHistory(true);
    setIsLoadingVersions(true);

    try {
      const versions = await getFileVersions(currentFileId);
      setFileVersions(versions);
    } catch (error) {
      console.error('Error loading versions:', error);
      toast({
        title: 'Failed to load version history',
        description: 'There was an error loading the version history. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingVersions(false);
    }
  };

  // Handle downloading a version
  const handleDownloadVersion = async (versionId: string) => {
    if (!currentFileId) return;

    try {
      const downloadInfo = await getFileVersion(currentFileId, versionId);

      // Create a temporary link and click it to start download
      const link = document.createElement('a');
      link.href = downloadInfo.downloadUrl;
      link.setAttribute('download', downloadInfo.fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: 'Download started',
        description: 'Your file will download shortly',
      });
    } catch (error) {
      console.error('Error downloading version:', error);
      toast({
        title: 'Download failed',
        description: 'There was an error downloading this version. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Handle reverting to a version
  const handleRevertToVersion = async (versionId: string) => {
    if (!currentFileId) return;

    setReverting(true);

    try {
      await revertToVersion(currentFileId, versionId);

      // Close the dialog
      setShowVersionHistory(false);

      // Reload the current tab data
      setSpreadsheetVersion(prev => prev + 1);

      // Update the tab to mark as not dirty
      if (activeTab) {
        updateTab(activeTab.id, {
          isDirty: false,
        });
      }

      toast({
        title: 'Version restored',
        description: 'The file has been reverted to the selected version',
      });
    } catch (error) {
      console.error('Error reverting to version:', error);
      toast({
        title: 'Revert failed',
        description: 'There was an error reverting to this version. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setReverting(false);
    }
  };

  const handleToggleFolder = useCallback(() => {
    if (!leftPanelOpen) {
      setLeftPanelContent(<LeftPanel />);
      toggleLeftPanel(true);
    } else {
      toggleLeftPanel(false);
    }
  }, [leftPanelOpen, setLeftPanelContent, toggleLeftPanel]);

  const [spreadsheetVersion, setSpreadsheetVersion] = useState(0);

  const insertRowRelativeTo = useCallback(
    (rowIndex: number, placement: 'above' | 'below') => {
      if (!activeTab || !isSpreadsheetTab(activeTab)) return;
      try {
        const data = activeTab.data as
          | { initialData?: Record<string, any>[]; initialColumns?: { id: string }[] }
          | undefined;
        if (!data?.initialData || !data.initialColumns) return;
        const currentData = [...data.initialData];
        const emptyRow: Record<string, any> = {};
        data.initialColumns.forEach(col => {
          emptyRow[col.id] = '';
        });
        const insertIndex = placement === 'above' ? rowIndex : rowIndex + 1;
        const clamped = Math.max(0, Math.min(insertIndex, currentData.length));
        currentData.splice(clamped, 0, emptyRow);
        updateTab(activeTab.id, {
          data: {
            ...(activeTab.data ?? {}),
            initialData: currentData,
          },
          isDirty: true,
        });
        setSpreadsheetVersion(prev => prev + 1);
      } catch (e) {
        console.error('Error inserting row:', e);
      }
    },
    [activeTab, updateTab]
  );

  const deleteRowsAtIndices = useCallback(
    (indices: number[]) => {
      if (!activeTab || !isSpreadsheetTab(activeTab)) return;
      if (indices.length === 0) return;
      try {
        const currentData = [...(activeTab.data.initialData ?? [])];
        const sorted = [...new Set(indices)].sort((a, b) => b - a);
        sorted.forEach(index => {
          if (index >= 0 && index < currentData.length) {
            currentData.splice(index, 1);
          }
        });
        updateTab(activeTab.id, {
          data: {
            ...activeTab.data,
            initialData: currentData,
          },
          isDirty: true,
        });
        setSpreadsheetVersion(prev => prev + 1);
      } catch (e) {
        console.error('Error deleting rows:', e);
      }
    },
    [activeTab, updateTab]
  );

  // Cleanup
  useEffect(() => {
    return () => {
      if (debouncedHandlers && typeof debouncedHandlers === 'object') {
        Object.values(debouncedHandlers).forEach(handler => {
          if (handler && typeof handler.cancel === 'function') {
            handler.cancel();
          }
        });
      }

      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [debouncedHandlers]);

  const renderSpreadsheetContent = (tab: SpreadsheetTab) => (
    <div className="h-full">
      <Spreadsheet
        key={`${tab.id}-${spreadsheetVersion}`}
        initialData={tab.data.initialData ?? []}
        initialColumns={tab.data.initialColumns ?? []}
        columnStats={tab.data.columnStats ?? {}}
        showStats={showStats}
        showFilters={showFilters}
        onCloseFilters={() => setShowFilters(false)}
        onRequestShowFilters={() => setShowFilters(true)}
        onChange={debouncedHandlers[tab.id]}
        filePath={tab.data.filePath}
        totalRowCount={tab.data.totalRows ?? 0}
        tabId={tab.id}
        onSelectionChange={setActiveRowSelection}
        onSheetStatusChange={setSheetStatus}
        tabData={tab.data}
        onInsertRow={insertRowRelativeTo}
        onDeleteRows={deleteRowsAtIndices}
      />
    </div>
  );

  const renderTabContent = (tab: StoreTab) => {
    // First check if we have an active tab
    if (!activeTab || tab.id !== activeTab.id) return null;

    if (tab.type === TabViewType.MARKDOWN) {
      const markdownTab = tab as StoreTab;
      return (
        <div className="h-full overflow-auto bg-background">
          <MarkdownViewer filePath={markdownTab.path || ''} content={markdownTab.content} />
        </div>
      );
    }

    if (tab.type === TabViewType.ANALYSIS_REPORT) {
      const reportTab = tab as import('@/stores/tabs-store').Tab;
      if (!reportTab.data?.analysisReport) {
        return (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No report data for this tab.
          </div>
        );
      }
      return (
        <AnalysisReportLayout
          report={reportTab.data.analysisReport}
          rawResult={reportTab.data.analysisResult ?? null}
          sourceDatasetId={reportTab.data.sourceDatasetId}
          analysisOp={reportTab.data.analysisOp}
          analysisRunId={reportTab.data.analysisRunId}
        />
      );
    }

    if (tab.type === TabViewType.ANALYSIS_RESULT) {
      const resultTab = tab as import('@/stores/tabs-store').Tab;
      if (resultTab.data?.analysisReport) {
        return (
          <AnalysisReportLayout
            report={resultTab.data.analysisReport}
            rawResult={resultTab.data.analysisResult ?? null}
            sourceDatasetId={resultTab.data.sourceDatasetId}
            analysisOp={resultTab.data.analysisOp}
            analysisRunId={resultTab.data.analysisRunId}
          />
        );
      }
      return (
        <AnalysisResultPlaceholder
          title={resultTab.name}
          analysisOp={resultTab.data?.analysisOp}
          parameters={resultTab.data?.analysisParameters}
          sourceDatasetId={resultTab.data?.sourceDatasetId}
        />
      );
    }

    // For spreadsheet tabs, render based on activeView
    if (isSpreadsheetTab(tab)) {
      const spreadsheetContent = renderSpreadsheetContent(tab);

      switch (activeView) {
        case ViewType.SPREADSHEET:
          return spreadsheetContent;

        case ViewType.CHARTS:
          if (!FEATURE_FLAGS.CHARTS_TAB_ENABLED) {
            return spreadsheetContent;
          }
          return <AnalyticsLayout filePath={tab.data.filePath} columns={tab.data.initialColumns} />;

        case ViewType.NOTEBOOK:
          return (
            <div className="h-full">
              <Notebook />
            </div>
          );

        default:
          return (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              No content available
            </div>
          );
      }
    }

    // For non-spreadsheet tabs, return no content
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        No content available
      </div>
    );
  };

  const hideWorkspaceToolbar = activeTab?.type === TabViewType.ANALYSIS_REPORT;
  const notebookControls = useNotebookWorkspaceStore(s => s.controls);
  const isNotebookView = activeView === ViewType.NOTEBOOK;

  const datasetContextId = useMemo(() => {
    if (!activeTab) return null;
    const storeTab = activeTab as import('@/stores/tabs-store').Tab;
    if (isSpreadsheetTab(activeTab)) return getDatasetIdFromTab(storeTab);
    if (activeTab.type === TabViewType.ANALYSIS_RESULT) {
      return storeTab.data?.sourceDatasetId ?? getDatasetIdFromTab(storeTab);
    }
    return null;
  }, [activeTab]);

  const sourceSpreadsheetTab = useMemo(
    () =>
      datasetContextId
        ? tabs.find(
            t =>
              isSpreadsheetTab(t) &&
              getDatasetIdFromTab(t as import('@/stores/tabs-store').Tab) === datasetContextId
          )
        : undefined,
    [tabs, datasetContextId]
  );

  const showDatasetWorkspaceBar =
    !!datasetContextId &&
    (isSpreadsheetTab(activeTab) || activeTab?.type === TabViewType.ANALYSIS_RESULT);

  const workspaceFixedViews = useMemo(
    () => [
      { key: ViewType.SPREADSHEET, label: 'Sheet' },
      ...(FEATURE_FLAGS.CHARTS_TAB_ENABLED
        ? [{ key: ViewType.CHARTS, label: 'Charts' as const }]
        : []),
      { key: ViewType.NOTEBOOK, label: 'Notebook' },
    ],
    []
  );

  const activateWorkspaceView = useCallback(
    (view: ViewType) => {
      if (
        activeTab?.type === TabViewType.ANALYSIS_RESULT &&
        sourceSpreadsheetTab &&
        view !== ViewType.CHARTS
      ) {
        setActiveTab(sourceSpreadsheetTab.id);
      }
      setView(view);
    },
    [activeTab?.type, sourceSpreadsheetTab, setActiveTab, setView]
  );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background">
      {!hideWorkspaceToolbar ? (
        <div className="flex h-[40px] min-h-[40px] items-center gap-1 border-b border-border bg-sidebar z-10 px-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={handleToggleFolder}
            data-state={leftPanelOpen ? 'active' : 'inactive'}
            title={leftPanelOpen ? 'Hide analysis tools' : 'Show analysis tools'}
          >
            {leftPanelOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
          </Button>

          {showDatasetWorkspaceBar && (
            <>
              <div className="flex items-center gap-0.5 shrink-0 min-w-0">
                {workspaceFixedViews.map(v => (
                  <Button
                    key={v.key}
                    variant={
                      isSpreadsheetTab(activeTab) && activeView === v.key ? 'secondary' : 'ghost'
                    }
                    size="sm"
                    className="h-8 px-2 text-xs shrink-0"
                    onClick={() => activateWorkspaceView(v.key)}
                  >
                    {v.label}
                  </Button>
                ))}
              </div>
              {isNotebookView ? (
                <>
                  <Separator orientation="vertical" className="h-5 shrink-0" />
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1 px-2 text-xs"
                      onClick={notebookControls.runAll}
                      disabled={notebookControls.isExecuting || !notebookControls.canRun}
                    >
                      Run all
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={notebookControls.runSelected}
                      disabled={notebookControls.isExecuting || !notebookControls.canRun}
                      title="Run selected cell"
                    >
                      {notebookControls.isExecuting ? (
                        <CircleStop className="size-3.5" />
                      ) : (
                        <Play className="size-3.5" />
                      )}
                      <span className="sr-only">Run cell</span>
                    </Button>
                    <Select
                      value={notebookControls.language}
                      onValueChange={v => notebookControls.setLanguage(v as 'python' | 'r')}
                    >
                      <SelectTrigger className="h-8 w-[5.5rem] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="python" className="text-xs">
                          Python
                        </SelectItem>
                        <SelectItem value="r" className="text-xs">
                          R
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={notebookControls.newCellType}
                      onValueChange={v => notebookControls.setNewCellType(v as 'code' | 'markdown')}
                    >
                      <SelectTrigger className="h-8 w-[5.25rem] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="code" className="text-xs">
                          Code
                        </SelectItem>
                        <SelectItem value="markdown" className="text-xs">
                          Markdown
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={notebookControls.addCell}
                      title={`Add ${notebookControls.newCellType} cell`}
                    >
                      <Plus className="size-3.5" />
                      <span className="sr-only">Add cell</span>
                    </Button>
                  </div>
                </>
              ) : activeView === ViewType.SPREADSHEET ||
                (FEATURE_FLAGS.CHARTS_TAB_ENABLED && activeView === ViewType.CHARTS) ? (
                <>
                  <Separator orientation="vertical" className="h-5 shrink-0" />
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setShowStats(prev => !prev)}
                      data-state={showStats ? 'active' : 'inactive'}
                      title="Toggle column stats"
                    >
                      <BarChart3 />
                      <span className="sr-only">Toggle Stats</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setShowFilters(!showFilters)}
                      data-state={showFilters ? 'active' : 'inactive'}
                      title="Filters"
                    >
                      <Filter />
                      <span className="sr-only">Filters</span>
                    </Button>
                  </div>
                </>
              ) : null}
            </>
          )}

          <div className="flex-1 min-w-0" />

          {lastSavedTime && activeTab && isSpreadsheetTab(activeTab) && !isNotebookView && (
            <span className="text-xs text-muted-foreground truncate hidden sm:inline max-w-[140px]">
              Saved {new Date(lastSavedTime).toLocaleTimeString()}
            </span>
          )}

          <div className="flex items-center shrink-0">
            {activeTab && isSpreadsheetTab(activeTab) && !isNotebookView && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => activeTab && undoTab(activeTab.id)}
                  disabled={!canUndo}
                  title="Undo (⌘Z)"
                >
                  <Undo2 />
                  <span className="sr-only">Undo</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => activeTab && redoTab(activeTab.id)}
                  disabled={!canRedo}
                  title="Redo (⌘⇧Z)"
                >
                  <Redo2 />
                  <span className="sr-only">Redo</span>
                </Button>
              </>
            )}

            {activeTab && isSpreadsheetTab(activeTab) && currentFileId && !isNotebookView && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 relative"
                onClick={handleSaveFile}
                disabled={savingStatus === 'saving' || !activeTab.isDirty}
                title="Save"
              >
                <Save className={savingStatus === 'saving' ? 'animate-pulse' : ''} />
                {activeTab.isDirty && (
                  <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-primary" />
                )}
                <span className="sr-only">Save</span>
              </Button>
            )}

            {activeTab && isSpreadsheetTab(activeTab) && currentFileId && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleOpenVersionHistory}
                title="Version History"
              >
                <History />
                <span className="sr-only">Version History</span>
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleSidebar}
              className="h-8 w-8"
              title={rightPanelOpen ? 'Close Right Panel' : 'Open Right Panel'}
            >
              {rightPanelOpen ? <PanelRightClose /> : <PanelRightOpen />}
              <span className="sr-only">Toggle Right Panel</span>
            </Button>
          </div>
        </div>
      ) : null}

      {/* Tab Content Area - Tabs are now only responsible for rendering content */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
        {/* Add check to ensure tabs is an array */}
        {Array.isArray(tabs) &&
          tabs.map(tab => {
            const isReport =
              tab.type === TabViewType.ANALYSIS_REPORT || tab.type === TabViewType.ANALYSIS_RESULT;
            return (
              <div
                key={tab.id}
                className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background"
                style={{ display: activeTab?.id === tab.id ? 'flex' : 'none' }}
              >
                <div
                  className={cn(
                    'min-h-0 flex-1',
                    isReport ? 'flex flex-col overflow-hidden' : 'relative overflow-hidden'
                  )}
                >
                  {renderTabContent(tab)}
                </div>
              </div>
            );
          })}
        {(!Array.isArray(tabs) || tabs.length === 0) && (
          <div className="flex h-full flex-col items-center justify-center bg-background text-muted-foreground">
            <Folder className="h-12 w-12 mb-4" />
            <h2 className="text-lg font-medium mb-2">No File Open</h2>
            <p className="text-sm">Select a file from the project explorer to begin editing</p>
          </div>
        )}
      </div>

      {/* Version History Dialog */}
      <Dialog open={showVersionHistory} onOpenChange={setShowVersionHistory}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Version History
            </DialogTitle>
            <DialogDescription>
              View and restore previous versions of {activeTab?.name || 'this file'}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 max-h-[400px] overflow-y-auto">
            {isLoadingVersions ? (
              <div className="flex justify-center py-8">
                <Loading />
              </div>
            ) : fileVersions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                <p>No version history found for this file.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {fileVersions.map(version => (
                  <div
                    key={version.versionId}
                    className="flex flex-col rounded-md border border-border p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {new Date(version.lastModified).toLocaleString()}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {Math.round(version.size / 1024)} KB
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      {version.isLatest && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                          Current Version
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex justify-between">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        onClick={() => handleDownloadVersion(version.versionId)}
                      >
                        <Download className="mr-1 h-3 w-3" />
                        Download
                      </Button>
                      {!version.isLatest && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                          onClick={() => handleRevertToVersion(version.versionId)}
                          disabled={reverting}
                        >
                          <RotateCcw className="mr-1 h-3 w-3" />
                          Revert to this version
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Save status notification */}
      {savingStatus === 'saving' && (
        <div className="fixed bottom-4 right-4 bg-amber-500 text-white px-4 py-2 rounded shadow-lg">
          Saving...
        </div>
      )}
      {savingStatus === 'saved' && (
        <div className="fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg">
          Saved successfully
        </div>
      )}
      {savingStatus === 'error' && (
        <div className="fixed bottom-4 right-4 bg-red-500 text-white px-4 py-2 rounded shadow-lg">
          Save failed
        </div>
      )}
    </div>
  );
};

export default TabManager;
