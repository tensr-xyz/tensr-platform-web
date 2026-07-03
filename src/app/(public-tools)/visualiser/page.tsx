'use client';

import React, { useState, useCallback, useMemo } from 'react';
import Titlebar from '@/components/templates/visualiser/organisms/titlebar';
import TabManager from '@/components/templates/visualiser/organisms/tab-manager';
import Footer from '@/components/templates/visualiser/organisms/footer';
import { useTabsStore, ViewType } from '@/stores/visualiser/tabs-store';
import { parseFile } from '@/utils/visualiser/file-parser';
import { Loader2 } from 'lucide-react';

export default function VisualiserPage() {
  const { tabs, activeTabId, addTab, closeTab } = useTabsStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);

  const activeTab = tabs.find(tab => tab.id === activeTabId);

  const rowCount = useMemo(() => {
    if (activeTab && activeTab.type === ViewType.SPREADSHEET && activeTab.data?.initialData) {
      return activeTab.data.initialData.length;
    }
    return 0;
  }, [activeTab]);

  const handleFileSelect = useCallback(
    async (file: File) => {
      setIsLoading(true);
      setError(null);

      try {
        const parsed = await parseFile(file);

        const newTab = {
          name: file.name,
          type: ViewType.SPREADSHEET,
          content: '',
          isDirty: false,
          data: {
            initialData: parsed.data,
            initialColumns: parsed.columns,
            totalRows: parsed.totalRows,
            totalColumns: parsed.totalColumns,
          },
        };

        addTab(newTab);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse file');
      } finally {
        setIsLoading(false);
      }
    },
    [addTab]
  );

  return (
    <div className="flex h-screen flex-col bg-background">
      <Titlebar tabs={tabs} activeTab={activeTab} onTabClose={closeTab} />
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center justify-center">
              <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">Loading file...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center p-8">
            <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive max-w-2xl">
              <p className="font-medium mb-1">Error</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        ) : (
          <TabManager
            activeTab={activeTab}
            tabs={tabs}
            onTabClose={closeTab}
            onToggleSidebar={() => setRightPanelOpen(!rightPanelOpen)}
            rightPanelOpen={rightPanelOpen}
            onFileSelect={handleFileSelect}
          />
        )}
      </div>
      {tabs.length > 0 && (
        <Footer isLoading={isLoading} activeTab={activeTab} rowCount={rowCount} />
      )}
    </div>
  );
}
