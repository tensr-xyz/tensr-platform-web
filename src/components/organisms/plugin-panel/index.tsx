import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/molecules/accordion';
import { ScrollArea } from '@/components/atoms/scroll-area';
import { Button } from '@/components/atoms/button';
import { Loader } from '@/components/molecules/loading';
import { PluginRecord } from '@/types/plugin';
import { apiClient } from '@/lib/api-client';
import { openPluginResultTab } from '@/lib/open-plugin-result-tab';
import { useTabsStore } from '@/stores/tabs-store';

interface PluginPanelProps {
  activeData?: any;
}

const PluginItem: React.FC<{
  plugin: PluginRecord;
  data?: any;
  hasAccess: boolean;
}> = ({ plugin, data, hasAccess }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { tabs, activeTabId } = useTabsStore();
  const activeTab = tabs.find(t => t.id === activeTabId);

  const handleRun = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!data) {
      setError('No data available to analyze');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const transformedData = {
        rows: data.data || data.rows || [],
        columns: (data.metadata?.columns || data.columns || []).map((col: any) => ({
          id: col.id || col.name,
          name: col.name || col.id,
          type: col.type || 'string',
        })),
        totalRows:
          data.metadata?.totalRows || data.totalRows || (data.data || data.rows || []).length,
        totalColumns: (data.metadata?.columns || data.columns || []).length,
      };

      const executionResult = await apiClient.plugins.execute(plugin.pluginId, transformedData);

      if (executionResult.success) {
        const sourceDatasetId =
          (activeTab?.data?.datasetId as string | undefined) ||
          (typeof activeTab?.path === 'string' ? activeTab.path : undefined) ||
          data.datasetId ||
          plugin.pluginId;
        openPluginResultTab({
          plugin,
          result: executionResult.result,
          sourceDatasetId,
          sourceTabName: activeTab?.name,
        });
      } else {
        setError(executionResult.error || 'Plugin execution failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to execute plugin';
      setError(errorMessage);
      console.error('Plugin execution error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-md px-4 py-2 hover:bg-accent">
      <div className="flex items-center justify-between">
        <div className="grow">
          <h3 className="font-medium">{plugin.name}</h3>
          <p className="text-sm text-muted-foreground">{plugin.description}</p>
          <div className="mt-1 text-xs text-muted-foreground">
            <div>Version: {plugin.version}</div>
          </div>
        </div>
        <div className="flex gap-2">
          {plugin.isPaid && !hasAccess ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/plugins/${plugin.pluginId}/purchase`}>
                <Lock className="mr-1 h-3.5 w-3.5" />
                Purchase
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={handleRun} disabled={isLoading || !data}>
              {isLoading ? <Loader size="sm" /> : data ? 'Run' : 'Open a file to run'}
            </Button>
          )}
        </div>
      </div>

      {error && <div className="mt-2 rounded-sm bg-red-50 p-2 text-sm text-red-500">{error}</div>}
    </div>
  );
};

const PluginPanel: React.FC<PluginPanelProps> = ({ activeData }) => {
  const [installedPlugins, setInstalledPlugins] = useState<PluginRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiClient.plugins
      .installed()
      .then(res => {
        if (cancelled) return;
        const items = (res.items || [])
          .map(row => row.plugin)
          .filter((p): p is PluginRecord => Boolean(p && p.status === 'APPROVED'));
        setInstalledPlugins(items);
      })
      .catch(() => {
        if (!cancelled) setInstalledPlugins([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ScrollArea className="h-full">
      <div className="p-4">
        <Accordion type="single" collapsible className="mb-4">
          <AccordionItem value="plugins">
            <AccordionTrigger>Installed plugins ({installedPlugins.length})</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                {loading ? (
                  <div className="flex flex-col items-center justify-center gap-2 rounded-sm bg-muted px-4 py-8">
                    <Loader size="sm" />
                    <p className="text-sm text-muted-foreground">Loading installed plugins…</p>
                  </div>
                ) : installedPlugins.length > 0 ? (
                  installedPlugins.map(plugin => (
                    <PluginItem key={plugin.pluginId} plugin={plugin} data={activeData} hasAccess />
                  ))
                ) : (
                  <div className="space-y-2 rounded-sm bg-muted px-4 py-2 text-center text-muted-foreground">
                    <p className="text-sm">No installed plugins yet.</p>
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/plugins">Browse marketplace</Link>
                    </Button>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </ScrollArea>
  );
};

export default PluginPanel;
