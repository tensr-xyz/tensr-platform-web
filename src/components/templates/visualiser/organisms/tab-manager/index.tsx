'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { useTabsStore, Tab, ViewType } from '@/stores/visualiser/tabs-store';
import { Button } from '@/components/templates/visualiser/atoms/button';
import { PanelRightOpen, PanelRightClose } from 'lucide-react';
import Spreadsheet from '@/components/templates/visualiser/templates/spreadsheet';
import { AIPanel } from '@/components/templates/visualiser/organisms/ai-panel';
import { EmptyState } from '@/components/templates/visualiser/organisms/empty-state';

interface TabManagerProps {
  activeTab?: Tab;
  tabs: Tab[];
  onTabClose: (id: string) => void;
  onToggleSidebar: () => void;
  rightPanelOpen?: boolean;
  onFileSelect?: (file: File) => void;
}

const TabManager: React.FC<TabManagerProps> = ({
  activeTab,
  tabs,
  onToggleSidebar,
  rightPanelOpen = false,
  onFileSelect,
}) => {
  const { updateTab } = useTabsStore();
  const [, setActiveRowSelection] = useState<Record<string, boolean>>({});
  const [spreadsheetVersion] = useState(0);

  // Type guard
  function isSpreadsheetTab(
    tab: Tab | undefined | null
  ): tab is Tab & { data: { initialData: Record<string, any>[]; initialColumns: any[] } } {
    return (
      tab !== undefined &&
      tab !== null &&
      tab.type === ViewType.SPREADSHEET &&
      !!tab.data?.initialColumns
    );
  }

  // Debounce utility
  type DebouncedFunction<T extends (...args: any[]) => any> = {
    (...args: Parameters<T>): void;
    cancel: () => void;
  };

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

  const createDebouncedHandler = useCallback(
    (tab: Tab) => {
      return debounce(async (newData: Record<string, any>[]) => {
        try {
          updateTab(tab.id, {
            data: {
              ...tab.data,
              initialData: newData,
            },
            isDirty: true,
          });
        } catch (e) {
          console.error('Error in debounced handler:', e);
        }
      }, 500);
    },
    [updateTab]
  );

  const debouncedHandlers = useMemo(() => {
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

  // Cleanup
  React.useEffect(() => {
    return () => {
      if (debouncedHandlers && typeof debouncedHandlers === 'object') {
        Object.values(debouncedHandlers).forEach(handler => {
          if (handler && typeof handler.cancel === 'function') {
            handler.cancel();
          }
        });
      }
    };
  }, [debouncedHandlers]);

  const renderSpreadsheetContent = (
    tab: Tab & { data: { initialData: Record<string, any>[]; initialColumns: any[] } }
  ) => (
    <div className="h-full">
      <Spreadsheet
        key={`${tab.id}-${spreadsheetVersion}`}
        initialData={tab.data.initialData}
        initialColumns={tab.data.initialColumns}
        onChange={debouncedHandlers[tab.id]}
        tabId={tab.id}
        onSelectionChange={setActiveRowSelection}
      />
    </div>
  );

  const renderTabContent = (tab: Tab) => {
    if (!activeTab || tab.id !== activeTab.id) return null;

    if (isSpreadsheetTab(tab)) {
      return renderSpreadsheetContent(tab);
    }

    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        No content available
      </div>
    );
  };

  return (
    <div className="flex h-full bg-background overflow-hidden min-h-0">
      {/* Main Content Area (Header + Tab Content) */}
      <div className="flex-1 flex flex-col bg-background overflow-hidden min-h-0">
        <div className="flex h-10 items-center justify-between border-b border-border bg-sidebar z-10 flex-shrink-0">
          <div className="flex flex-row items-center gap-2 px-4">
            <h1 className="text-sm font-medium">
              {activeTab?.name}
              {activeTab?.isDirty && <span className="ml-1 text-muted-foreground">*</span>}
            </h1>
          </div>
          <div className="flex-none flex items-center px-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleSidebar}
              className="h-7 w-7"
              title={rightPanelOpen ? 'Close Right Panel' : 'Open Right Panel'}
            >
              {rightPanelOpen ? <PanelRightClose /> : <PanelRightOpen />}
              <span className="sr-only">Toggle Right Panel</span>
            </Button>
          </div>
        </div>

        {/* Tab Content Area */}
        <div className="flex-1 bg-background overflow-hidden min-h-0">
          {Array.isArray(tabs) &&
            tabs.map(tab => (
              <div
                key={tab.id}
                className="h-full flex flex-col bg-background"
                style={{ display: activeTab?.id === tab.id ? 'flex' : 'none' }}
              >
                <div className="flex-1 relative overflow-hidden min-h-0">
                  {renderTabContent(tab)}
                </div>
              </div>
            ))}
          {(!Array.isArray(tabs) || tabs.length === 0) && onFileSelect && (
            <EmptyState onFileSelect={onFileSelect} />
          )}
        </div>
      </div>

      {/* Right Panel - slides out from right */}
      <div
        className="border-l border-border bg-background flex-shrink-0 overflow-hidden min-h-0 transition-all duration-300 ease-in-out"
        style={{
          width: rightPanelOpen ? '320px' : '0px',
          minWidth: rightPanelOpen ? '320px' : '0px',
          maxWidth: rightPanelOpen ? '320px' : '0px',
        }}
      >
        {rightPanelOpen && (
          <div className="h-full w-80">
            {activeTab && isSpreadsheetTab(activeTab) ? (
              <AIPanel data={activeTab.data.initialData} columns={activeTab.data.initialColumns} />
            ) : (
              <div className="h-full flex items-center justify-center p-4 text-muted-foreground text-sm text-center">
                Open a spreadsheet to see AI insights
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TabManager;
