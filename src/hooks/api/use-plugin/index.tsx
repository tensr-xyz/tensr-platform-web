import { useState, useEffect, useCallback } from 'react';
import { PluginRecord } from '@/types/plugin';

const BASE_URL = 'https://t8ioaf6fl9.execute-api.us-east-1.amazonaws.com';

interface PaginatedResponse<T> {
  items: T[];
  nextToken?: string;
}

interface UsePluginsOptions {
  limit?: number;
}

interface UsePluginsReturn {
  plugins: PluginRecord[];
  installedPlugins: PluginRecord[];
  loading: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  getPlugin: (pluginId: string, version?: string) => Promise<PluginRecord>;
  getPluginVersions: (pluginId: string) => Promise<PluginRecord[]>;
  installPlugin: (plugin: PluginRecord) => Promise<void>;
  uninstallPlugin: (pluginId: string) => Promise<void>;
  isPluginInstalled: (pluginId: string) => boolean;
  refetch: () => void;
}

const usePlugins = (options: UsePluginsOptions = {}): UsePluginsReturn => {
  const [plugins, setPlugins] = useState<PluginRecord[]>([]);
  const [installedPlugins, setInstalledPlugins] = useState<PluginRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [nextToken, setNextToken] = useState<string | undefined>();
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  // Fetch plugins from marketplace API
  const fetchPlugins = async (
    params: { limit?: number; nextToken?: string; isInitialFetch?: boolean } = {}
  ) => {
    try {
      const queryParams = new URLSearchParams();
      if (!params.isInitialFetch && params.limit && !isNaN(params.limit)) {
        queryParams.append('limit', params.limit.toString());
      }
      if (params.nextToken) {
        queryParams.append('nextToken', params.nextToken);
      }

      const queryString = queryParams.toString();
      const url = `${BASE_URL}/plugins${queryString ? `?${queryString}` : ''}`;

      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to fetch plugins: ${response.status}${errorText ? ` - ${errorText}` : ''}`
        );
      }

      const data: PaginatedResponse<PluginRecord> = await response.json();
      return data;
    } catch (err) {
      throw err;
    }
  };

  // Load installed plugins from local storage
  const loadInstalledPlugins = useCallback(async () => {
    try {
      const installed = {}
      // const installed = await invoke<PluginRecord[]>('get_installed_plugins');

      if (installed.length === 0) {
      } else {
        installed.forEach((plugin, index) => {

        });
      }

      setInstalledPlugins(installed);
    } catch (err) {
    }
  }, []);

  // Initialize plugin data
  useEffect(() => {
    const initializeFetch = async () => {
      try {
        setPlugins([]);
        setNextToken(undefined);
        const data = await fetchPlugins({ isInitialFetch: true });
        setPlugins(data.items);
        setNextToken(data.nextToken);
        await loadInstalledPlugins();
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load plugins'));
      } finally {
        setLoading(false);
      }
    };

    initializeFetch();
  }, [refetchTrigger, loadInstalledPlugins]);

  const loadMore = async () => {
    if (!nextToken || loading) return;

    try {
      setLoading(true);
      const data = await fetchPlugins({
        limit: options.limit && !isNaN(options.limit) ? options.limit : undefined,
        nextToken,
      });
      setPlugins(prev => [...prev, ...data.items]);
      setNextToken(data.nextToken);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load more plugins'));
    } finally {
      setLoading(false);
    }
  };

  const getPlugin = async (pluginId: string, version?: string): Promise<PluginRecord> => {
    const versionParam = version ? `?version=${version}` : '';
    const url = `${BASE_URL}/plugins/${pluginId}${versionParam}`;
    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to fetch plugin: ${response.status}${errorText ? ` - ${errorText}` : ''}`
      );
    }

    return response.json();
  };

  const getPluginVersions = async (pluginId: string): Promise<PluginRecord[]> => {
    const url = `${BASE_URL}/plugins/${pluginId}/versions`;
    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to fetch plugin versions: ${response.status}${errorText ? ` - ${errorText}` : ''}`
      );
    }

    return response.json();
  };

  const installPlugin = async (plugin: PluginRecord) => {
    try {
      // Get a pre-signed URL from the backend
      const downloadResponse = await fetch(`${BASE_URL}/plugins/${plugin.pluginId}/download-url`);
      if (!downloadResponse.ok) {
        throw new Error(`Failed to get download URL: ${downloadResponse.status}`);
      }

      const { downloadUrl } = await downloadResponse.json();

      // Download the plugin using the pre-signed URL
      const pluginResponse = await fetch(downloadUrl);
      if (!pluginResponse.ok) {
        throw new Error(`Failed to download plugin: ${pluginResponse.status}`);
      }

      // Get the binary data
      const pluginData = await pluginResponse.arrayBuffer();

      // Transform the plugin record to match Rust's snake_case convention
      const manifest = {
        plugin_id: plugin.pluginId,
        version: plugin.version,
        name: plugin.name,
        description: plugin.description,
        author_id: plugin.authorId,
        language: plugin.language,
        entry_point: plugin.entryPoint,
        capabilities: {
          input_types: plugin.capabilities?.inputTypes || [],
          output_types: plugin.capabilities?.outputTypes || [],
        },
        status: plugin.status,
        created_at: plugin.createdAt,
        updated_at: plugin.updatedAt,
        s3_key: plugin.s3Key,
      };

      // Install plugin using Rust backend
      // await invoke('install_plugin', {
      //   pluginData: new Uint8Array(pluginData),
      //   manifest,
      // });

      await loadInstalledPlugins();
    } catch (error) {
      throw error;
    }
  };

  const uninstallPlugin = async (pluginId: string) => {
    try {
      // await invoke('uninstall_plugin', { pluginId });
      await loadInstalledPlugins();
    } catch (error) {
      throw error;
    }
  };

  const isPluginInstalled = (pluginId: string): boolean => {
    return installedPlugins.some(plugin => plugin.pluginId === pluginId);
  };

  const refetch = () => {
    setRefetchTrigger(prev => prev + 1);
  };

  return {
    plugins,
    installedPlugins,
    loading,
    error,
    hasMore: !!nextToken,
    loadMore,
    getPlugin,
    getPluginVersions,
    installPlugin,
    uninstallPlugin,
    isPluginInstalled,
    refetch,
  };
};

export default usePlugins;
