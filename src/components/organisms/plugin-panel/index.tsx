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
import PluginUIRenderer from '@/components/molecules/plugin-ui-renderer';

interface PluginPanelProps {
  activeData?: any;
}

// Individual plugin item component
const PluginItem: React.FC<{
  plugin: PluginRecord;
  data?: any;
  hasAccess: boolean;
  onExecutionComplete?: (result: any) => void;
}> = ({ plugin, data, hasAccess, onExecutionComplete }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const handleRun = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!data) {
      setError('No data available to analyze');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      // Transform the data to match plugin's expected format (DataSet)
      // All data is parquet format, so no fileType needed
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

      // Execute the plugin via API
      const executionResult = await apiClient.plugins.execute(plugin.pluginId, transformedData);

      if (executionResult.success) {
        setResult(executionResult.result);
        if (onExecutionComplete) {
          onExecutionComplete(executionResult.result);
        }
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
    <div className="px-4 py-2 hover:bg-accent rounded-md">
      <div className="flex items-center justify-between">
        <div className="grow">
          <h3 className="font-medium">{plugin.name}</h3>
          <p className="text-sm text-muted-foreground">{plugin.description}</p>
          <div className="text-xs text-muted-foreground mt-1">
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

      {error && <div className="text-red-500 text-sm mt-2 p-2 bg-red-50 rounded-sm">{error}</div>}

      {result && !onExecutionComplete && (
        <div className="mt-2 p-2 bg-muted rounded-sm">
          <div className="font-medium text-sm">Result:</div>
          <pre className="text-xs overflow-auto max-h-40">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

// Main plugin panel component
const PluginPanel: React.FC<PluginPanelProps> = ({ activeData }) => {
  const [installedPlugins, setInstalledPlugins] = useState<PluginRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [executionResult, setExecutionResult] = useState<{
    plugin: PluginRecord;
    result: any;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiClient.plugins
      .installed()
      .then(res => {
        if (cancelled) return;
        setInstalledPlugins(
          (res.items || [])
            .map(row => row.plugin)
            .filter((p): p is PluginRecord => Boolean(p && p.status === 'APPROVED'))
        );
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

  const handleExecutionComplete = (plugin: PluginRecord, result: any) => {
    setExecutionResult({ plugin, result });
  };

  // Show UI renderer if execution completed
  if (executionResult) {
    return (
      <PluginUIRenderer
        plugin={executionResult.plugin}
        result={executionResult.result}
        onClose={() => setExecutionResult(null)}
      />
    );
  }

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
                    <PluginItem
                      key={plugin.pluginId}
                      plugin={plugin}
                      data={activeData}
                      hasAccess
                      onExecutionComplete={result => handleExecutionComplete(plugin, result)}
                    />
                  ))
                ) : (
                  <div className="space-y-2 px-4 py-2 text-center text-muted-foreground bg-muted rounded-sm">
                    <p className="text-sm">No plugins installed</p>
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
