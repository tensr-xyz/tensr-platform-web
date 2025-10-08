import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useTabsStore, Tab } from '@/stores/tabs-store';
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
  LuSave,
  LuHistory,
  LuClock,
  LuDownload,
  LuRewind,
} from 'react-icons/lu';
import Spreadsheet from '@/components/templates/spreadsheet';
import { useProjectStore } from '@/stores/project-store';
import { ViewType } from '@/stores/tabs-store';
import { Notebook } from '@/components/templates/notebook';
import MarkdownViewer from '@/components/organisms/markdown-viewer';
import { ModelBuilder } from '@/components/templates/model-builder';
import AnalyticsLayout from '@/components/templates/analytics-layout';
import { Separator } from '@/components/atoms/separator';
// Removed context actions import - using store actions instead
import { FolderComponent } from '@/components/organisms/file-tree';
import { Users } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/atoms/popover';
import CollaborationPanel from '@/components/organisms/collaboration-panel';
import { useFileHandler } from '@/hooks/api/use-file';
import { toast } from '@/hooks/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/molecules/dialog';
import Loading from '@/components/molecules/loading';

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
  content?: string;
}

interface RowSelection {
  [key: string]: boolean;
}

export type Tab = SpreadsheetTab | MarkdownTab | BaseTab;

// Type guard with null/undefined check
function isSpreadsheetTab(tab: Tab | undefined | null): tab is SpreadsheetTab {
  return tab !== undefined && tab !== null && tab.type === ViewType.SPREADSHEET;
}

// Extract fileId from file path
// This handles both formats:
// 1. Full path: users/userId/fileId/filename
// 2. Direct fileId
// 3. Project ID (UUID) - return null to avoid calling file API
function extractFileId(filePath?: string): string | null {
  if (!filePath) return null;

  // Check if it's a project ID (UUID) - if so, return null to avoid calling file API
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(filePath)) {
    console.log('Detected project ID, returning null to avoid file API calls');
    return null;
  }

  // If the path contains slashes, it's a full path
  if (filePath.includes('/')) {
    const parts = filePath.split('/');
    if (parts.length >= 3) {
      return parts[2];
    }
  }

  // Otherwise, assume it's a direct fileId
  return filePath;
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
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [savingStatus, setSavingStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
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
  const {
    saveFile,
    isSaving,
    lastSavedTime,
    getFileVersions,
    getFileVersion,
    revertToVersion,
    setupAutoSave,
  } = useFileHandler({});

  const [activeRowSelection, setActiveRowSelection] = useState<RowSelection>({});
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Get current file ID - with null checks
  const currentFileId = useMemo(() => {
    if (!activeTab) return null;

    console.log('Active Tab:', activeTab);
    console.log('Is Spreadsheet Tab:', isSpreadsheetTab(activeTab));
    console.log('Active Tab isDirty:', activeTab.isDirty);

    if (isSpreadsheetTab(activeTab)) {
      return extractFileId(activeTab.data.filePath);
    } else if (activeTab.path) {
      return extractFileId(activeTab.path);
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

  // Handle save
  const handleSaveFile = async () => {
    console.log('handleSaveFile called');
    if (!activeTab || !isSpreadsheetTab(activeTab)) {
      console.log('handleSaveFile: No active spreadsheet tab');
      toast({
        title: 'Cannot save',
        description: 'No active file',
        variant: 'destructive',
      });
      return;
    }

    if (!currentFileId) {
      console.log('handleSaveFile: No currentFileId');
      toast({
        title: 'Save As required',
        description: 'This file has not been saved before. Please use "Save As" to save it.',
        variant: 'destructive',
      });
      return;
    }

    // Don't save if the file isn't dirty
    if (!activeTab.isDirty) {
      console.log('handleSaveFile: Tab is not dirty');
      toast({
        title: 'No changes to save',
        description: 'The file is already up to date',
      });
      return;
    }

    console.log('handleSaveFile: Setting savingStatus to saving');
    setSavingStatus('saving');

    try {
      console.log('handleSaveFile: Calling saveFile with fileId', currentFileId);
      // Save the file content
      const success = await saveFile(currentFileId, activeTab.data.initialData);

      if (success) {
        console.log('handleSaveFile: saveFile succeeded');
        // Update tab to mark as no longer dirty
        updateTab(activeTab.id, {
          isDirty: false,
        });

        console.log('handleSaveFile: Setting savingStatus to saved');
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
      console.log('handleSaveFile: Finally block executed');
      // Reset status after a delay
      setTimeout(() => {
        if (savingStatus === 'saved' || savingStatus === 'error') {
          console.log('handleSaveFile: Resetting savingStatus to idle');
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
    console.log('Toggle folder clicked, current state:', leftPanelOpen);
    if (!leftPanelOpen) {
      // Set panel content first, then open the panel
      setLeftPanelContent(<FolderComponent />);
      toggleLeftPanel(true);
    } else {
      // Just close the panel
      toggleLeftPanel(false);
    }
  }, [leftPanelOpen, setLeftPanelContent, toggleLeftPanel]);

  const [spreadsheetVersion, setSpreadsheetVersion] = useState(0);

  // Handle adding a row
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
      updateTab(activeTab.id, {
        data: {
          ...activeTab.data,
          initialData: currentData,
        },
        isDirty: true,
      });

      // Force re-render of the spreadsheet
      setSpreadsheetVersion(prev => prev + 1);
    } catch (e) {
      console.error('Error adding row:', e);
    }
  }, [activeTab, activeRowSelection]);

  // Handle deleting rows
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
      updateTab(activeTab.id, {
        data: {
          ...activeTab.data,
          initialData: currentData,
        },
        isDirty: true,
      });

      // Force re-render of the spreadsheet
      setSpreadsheetVersion(prev => prev + 1);
    } catch (e) {
      console.error('Error deleting rows:', e);
    }
  }, [activeTab, activeRowSelection]);

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
        tabData={tab.data}
      />
    </div>
  );

  const renderTabContent = (tab: Tab) => {
    // First check if we have an active tab
    if (!activeTab || tab.id !== activeTab.id) return null;

    if (tab.type === ViewType.MARKDOWN) {
      const markdownTab = tab as MarkdownTab;
      return (
        <div className="h-full overflow-auto bg-background">
          <MarkdownViewer filePath={markdownTab.path || ''} content={markdownTab.content} />
        </div>
      );
    }

    // For spreadsheet tabs, render based on activeView
    if (isSpreadsheetTab(tab)) {
      const spreadsheetContent = renderSpreadsheetContent(tab);

      switch (activeView) {
        case ViewType.SPREADSHEET:
        case ViewType.CHARTS:
          return (
            <AnalyticsLayout filePath={tab.data.filePath} columns={tab.data.initialColumns}>
              {spreadsheetContent}
            </AnalyticsLayout>
          );

        case ViewType.NOTEBOOK:
          return (
            <div className="h-full">
              <Notebook />
            </div>
          );

        case ViewType.SEM:
          return (
            <div className="h-full">
              <ModelBuilder />
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

  return (
    <div className="flex h-full flex-col relative bg-background">
      <div className="flex h-10 items-center justify-between border-b border-border bg-sidebar z-10">
        <div className="flex flex-row items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 mx-2"
            onClick={handleToggleFolder}
            data-state={leftPanelOpen ? 'active' : 'inactive'}
          >
            <LuFolder />
          </Button>
          <h1 className="text-sm font-medium">
            {activeTab?.name}
            {activeTab?.isDirty && <span className="ml-1 text-muted-foreground">*</span>}
          </h1>
          {lastSavedTime && (
            <span className="text-xs text-muted-foreground ml-2">
              Last saved: {new Date(lastSavedTime).toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="flex-none flex items-center px-2">
          {/* Save Button - show for any spreadsheet tab */}
          {activeTab && isSpreadsheetTab(activeTab) && currentFileId && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 relative"
              onClick={handleSaveFile}
              disabled={savingStatus === 'saving' || !activeTab.isDirty}
              title="Save"
            >
              <LuSave className={savingStatus === 'saving' ? 'animate-pulse' : ''} />
              {activeTab.isDirty && (
                <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-primary"></span>
              )}
              <span className="sr-only">Save</span>
            </Button>
          )}

          {/* Version History Button - show for any spreadsheet tab */}
          {activeTab && isSpreadsheetTab(activeTab) && currentFileId && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleOpenVersionHistory}
              title="Version History"
            >
              <LuHistory />
              <span className="sr-only">Version History</span>
            </Button>
          )}

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setShowMenu(prev => !prev)}
                data-state={showMenu ? 'active' : 'inactive'}
              >
                <Users />
                <span className="sr-only">Toggle User Collaboration</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end">
              <CollaborationPanel
                projectId={currentProject?.id || currentFileId || ''}
                activeTab={activeTab}
              />
            </PopoverContent>
          </Popover>
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
        {/* Add check to ensure tabs is an array */}
        {Array.isArray(tabs) &&
          tabs.map(tab => (
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
                      onClick={() => setView(ViewType.CHARTS)}
                      data-state={activeView === ViewType.CHARTS ? 'active' : 'inactive'}
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
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setShowFilters(!showFilters)}
                    >
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
        {(!Array.isArray(tabs) || tabs.length === 0) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background text-muted-foreground">
            <LuFolder className="h-12 w-12 mb-4" />
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
              <LuHistory className="h-5 w-5" />
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
                        <LuClock className="h-4 w-4 text-muted-foreground" />
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
                        <LuDownload className="mr-1 h-3 w-3" />
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
                          <LuRewind className="mr-1 h-3 w-3" />
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
