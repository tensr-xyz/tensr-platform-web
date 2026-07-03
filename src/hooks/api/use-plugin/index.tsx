import { useState, useEffect, useCallback } from 'react';
import { PluginRecord } from '@/types/plugin';

import { getSessionJwt, getSessionToken } from '@/utils/auth';
import { tensrApiUrl } from '@/lib/tensr-api-url';
import { handleUnauthorizedResponse } from '@/lib/session-expired';

function pluginHeaders(): HeadersInit {
  const token = getSessionJwt() || getSessionToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

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
      const url = `${tensrApiUrl('/plugins')}${queryString ? `?${queryString}` : ''}`;

      const response = await fetch(url, { headers: pluginHeaders() });

      if (handleUnauthorizedResponse(response)) {
        throw new Error('Session expired');
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to fetch plugins: ${response.status}${errorText ? ` - ${errorText}` : ''}`
        );
      }

      const data: PaginatedResponse<PluginRecord> = await response.json();

      // Ensure all plugins have required properties with defaults
      const processedData = {
        ...data,
        items: data.items.map(plugin => ({
          ...plugin,
          status: plugin.status || 'PENDING',
          isPaid: plugin.isPaid || false,
          tags: plugin.tags || [],
          thumbnailUrl: plugin.thumbnailUrl || '',
          revenue: plugin.revenue || {
            totalSales: 0,
            totalDownloads: 0,
            platformFee: 0,
            creatorPayout: 0,
          },
        })),
      };

      return processedData;
    } catch (err) {
      throw err;
    }
  };

  // Load installed plugins - just track IDs in memory
  const loadInstalledPlugins = useCallback(async () => {
    // For web platform, we just track installed plugin IDs in memory
    // No local storage needed since we'll always fetch from API
    setInstalledPlugins([]);
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
    const url = `${tensrApiUrl(`/plugins/${pluginId}`)}${versionParam}`;
    const response = await fetch(url, { headers: pluginHeaders() });

    if (handleUnauthorizedResponse(response)) {
      throw new Error('Session expired');
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to fetch plugin: ${response.status}${errorText ? ` - ${errorText}` : ''}`
      );
    }

    const plugin: PluginRecord = await response.json();

    // Ensure plugin has required properties with defaults
    return {
      ...plugin,
      status: plugin.status || 'PENDING',
      isPaid: plugin.isPaid || false,
      tags: plugin.tags || [],
      thumbnailUrl: plugin.thumbnailUrl || '',
      revenue: plugin.revenue || {
        totalSales: 0,
        totalDownloads: 0,
        platformFee: 0,
        creatorPayout: 0,
      },
    };
  };

  const getPluginVersions = async (pluginId: string): Promise<PluginRecord[]> => {
    const url = tensrApiUrl(`/plugins/${pluginId}/versions`);
    const response = await fetch(url, { headers: pluginHeaders() });

    if (handleUnauthorizedResponse(response)) {
      throw new Error('Session expired');
    }

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
      // For web platform, just track the plugin as installed in memory
      // We'll fetch from API when needed
      setInstalledPlugins(prev => {
        if (prev.some(p => p.pluginId === plugin.pluginId)) {
          return prev;
        }
        return [...prev, plugin];
      });
    } catch (error) {
      throw error;
    }
  };

  const uninstallPlugin = async (pluginId: string) => {
    try {
      // Remove from installed plugins list
      setInstalledPlugins(prev => prev.filter(p => p.pluginId !== pluginId));
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
