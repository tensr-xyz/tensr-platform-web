import React, { useState, useEffect } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/molecules/accordion';
import { ScrollArea } from '@/components/atoms/scroll-area';
import { Button } from '@/components/atoms/button';
import { Loader } from '@/components/molecules/loading';
import usePlugins from '@/hooks/api/use-plugin';
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
  onExecutionComplete?: (result: any) => void;
}> = ({ plugin, data, onExecutionComplete }) => {
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
          <Button variant="outline" size="sm" onClick={handleRun} disabled={isLoading || !data}>
            {isLoading ? <Loader size="sm" /> : data ? 'Run' : 'Open a file to run'}
          </Button>
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
  const { plugins } = usePlugins();
  const [executionResult, setExecutionResult] = useState<{
    plugin: PluginRecord;
    result: any;
  } | null>(null);

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

  // Show all approved plugins - no need to install, just use them on files
  const approvedPlugins = plugins.filter(p => p.status === 'APPROVED');

  return (
    <ScrollArea className="h-full">
      <div className="p-4">
        <Accordion type="single" collapsible className="mb-4">
          <AccordionItem value="plugins">
            <AccordionTrigger>Plugins ({approvedPlugins.length})</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                {approvedPlugins.length > 0 ? (
                  approvedPlugins.map(plugin => (
                    <PluginItem
                      key={plugin.pluginId}
                      plugin={plugin}
                      data={activeData}
                      onExecutionComplete={result => handleExecutionComplete(plugin, result)}
                    />
                  ))
                ) : (
                  <div className="px-4 py-2 text-muted-foreground text-center bg-muted rounded-sm">
                    No plugins available
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
