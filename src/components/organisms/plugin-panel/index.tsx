import React, { useState, useEffect } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/molecules/accordion';
import { ScrollArea } from '@/components/atoms/scroll-area';
import { Button } from '@/components/atoms/button';
import { Loader2 } from 'lucide-react';
import usePlugins from '@/hooks/api/use-plugin';
import { FileType } from '@tensr/sdk';
import { PluginRecord } from '@/types/plugin';

const getAcceptedInputTypes = (fileType: FileType): string[] => {
  switch (fileType.toString().toLowerCase()) {
    case 'csv':
      return ['csv', 'text', 'string'];
    case 'xlsx':
      return ['xlsx', 'excel', 'spreadsheet'];
    default:
      return [fileType.toString().toLowerCase()];
  }
};

// Create a class to manage plugins
class PluginRegistry {
  private static instance: PluginRegistry;
  private installedPlugins: PluginRecord[] = [];

  private constructor() {}

  static getInstance(): PluginRegistry {
    if (!PluginRegistry.instance) {
      PluginRegistry.instance = new PluginRegistry();
    }
    return PluginRegistry.instance;
  }

  setInstalledPlugins(plugins: PluginRecord[]) {
    this.installedPlugins = plugins;
  }

  getAllPlugins(): PluginRecord[] {
    return this.installedPlugins;
  }

  getPluginsForFileType(fileType: FileType): PluginRecord[] {
    const acceptedTypes = getAcceptedInputTypes(fileType);

    return this.installedPlugins.filter(plugin => {
      const inputTypes = plugin.capabilities?.inputTypes || [];
      const isCompatible = inputTypes.some(type => acceptedTypes.includes(type.toLowerCase()));

      return isCompatible;
    });
  }
}

// Export the singleton instance
export const pluginRegistry = PluginRegistry.getInstance();

interface PluginPanelProps {
  activeFileType?: FileType;
  activeData?: any; // Add activeData prop
}

// Individual plugin item component
const PluginItem: React.FC<{
  plugin: PluginRecord;
  data?: any;
}> = ({ plugin, data }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const { uninstallPlugin } = usePlugins();

  const handleRun = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!data) {
      setError('No data available to analyze');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Transform the data to match plugin's expected format
      const transformedData = {
        rows: data.data, // Your data is already in the correct format
        columns: data.metadata.columns.map((col: any) => ({
          id: col.id,
          name: col.name,
        })),
        totalRows: data.metadata.totalRows,
      };

      // Get the plugin's entry point file path
      const pluginPath = {};
      // const pluginPath = await invoke<string>('get_plugin_path', {
      //   pluginId: plugin.pluginId,
      //   entryPoint: plugin.entryPoint,
      // });

      // Execute the plugin with transformed data
      const result = {};
      // const result = await invoke('execute_plugin', {
      //   pluginPath,
      //   data: transformedData,
      //   capabilities: plugin.capabilities,
      // });

      setResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute plugin');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUninstall = async (e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      setIsLoading(true);
      await uninstallPlugin(plugin.pluginId);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to uninstall plugin');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="px-4 py-2 hover:bg-accent rounded-md">
      <div className="flex items-center justify-between">
        <div className="flex-grow">
          <h3 className="font-medium">{plugin.name}</h3>
          <p className="text-sm text-muted-foreground">{plugin.description}</p>
          <div className="text-xs text-muted-foreground mt-1">
            <div>Version: {plugin.version}</div>
            {plugin.capabilities && (
              <div>Supports: {plugin.capabilities.inputTypes.join(', ')}</div>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRun} disabled={isLoading || !data}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Run'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleUninstall} disabled={isLoading}>
            Uninstall
          </Button>
        </div>
      </div>

      {error && <div className="text-red-500 text-sm mt-2 p-2 bg-red-50 rounded">{error}</div>}

      {result && (
        <div className="mt-2 p-2 bg-muted rounded">
          <div className="font-medium text-sm">Result:</div>
          <pre className="text-xs overflow-auto max-h-40">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

// Main plugin panel component
const PluginPanel: React.FC<PluginPanelProps> = ({ activeFileType, activeData }) => {
  const { installedPlugins } = usePlugins();
  const [filteredPlugins, setFilteredPlugins] = useState<PluginRecord[]>([]);

  useEffect(() => {
    pluginRegistry.setInstalledPlugins(installedPlugins);

    // const filtered = activeFileType
    //   ? pluginRegistry.getPluginsForFileType(activeFileType)
    //   : installedPlugins;

    // logInfo('Filtered plugins result:', {
    //   filteredCount: filtered.length,
    //   filtered: filtered.map(p => ({
    //     name: p.name,
    //     inputTypes: p.capabilities?.input_types
    //   }))
    // });

    setFilteredPlugins(installedPlugins);
  }, [installedPlugins, activeFileType]);

  return (
    <ScrollArea className="h-full">
      <div className="p-4">
        <Accordion type="single" collapsible className="mb-4">
          <AccordionItem value="plugins">
            <AccordionTrigger>Installed Plugins ({filteredPlugins.length})</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                {filteredPlugins.length > 0 ? (
                  filteredPlugins.map(plugin => (
                    <PluginItem key={plugin.pluginId} plugin={plugin} data={activeData} />
                  ))
                ) : (
                  <div className="px-4 py-2 text-muted-foreground text-center bg-muted rounded">
                    No plugins installed for {activeFileType || 'this file type'}
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
