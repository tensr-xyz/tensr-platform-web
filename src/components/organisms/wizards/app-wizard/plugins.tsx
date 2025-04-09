import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/molecules/tabs';
import { Badge } from '@/components/atoms/badge';
import { Button } from '@/components/atoms/button';
import { toast } from '@/hooks/ui/use-toast';
import { Input } from '@/components/atoms/input';
import usePlugins from '@/hooks/api/use-plugin';
import { PluginRecord, SupportedLanguages } from '@/types/plugin';
import { Loader2, Search, Download } from 'lucide-react';

const LanguageIcon = ({ language }: { language: SupportedLanguages }) => {
  const iconStyles = {
    typescript: 'bg-blue-100 text-blue-600',
    python: 'bg-yellow-100 text-yellow-600',
    r: 'bg-blue-200 text-blue-700',
  };

  return (
    <div
      className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconStyles[language]}`}
    >
      {language.slice(0, 2).toUpperCase()}
    </div>
  );
};

const PluginRow = ({
  plugin,
  onInstall,
  onUninstall,
  isInstalled,
  isInstalling,
}: {
  plugin: PluginRecord;
  onInstall: () => void;
  onUninstall: () => void;
  isInstalled: boolean;
  isInstalling: boolean;
}) => (
  <div className="flex items-center p-4 bg-white hover:bg-gray-50 border-b">
    <LanguageIcon language={plugin.language} />

    <div className="ml-4 flex-1 min-w-0">
      <div className="flex items-center gap-3">
        <h3 className="font-medium text-gray-900">{plugin.name}</h3>
      </div>

      <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
        <span>{plugin.authorId}</span>
        <span>v{plugin.version}</span>
        {plugin.license && <span>{plugin.license}</span>}
      </div>

      <p className="mt-1 text-sm text-gray-600 line-clamp-1">{plugin.description}</p>
    </div>

    <Button
      size="sm"
      className="ml-4 w-24"
      onClick={isInstalled ? onUninstall : onInstall}
      disabled={isInstalling}
      variant={isInstalled ? 'destructive' : 'default'}
    >
      {isInstalling ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {isInstalled ? 'Removing...' : 'Installing...'}
        </>
      ) : isInstalled ? (
        'Remove'
      ) : (
        <>
          <Download className="mr-2 h-4 w-4" />
          Install
        </>
      )}
    </Button>
  </div>
);

export default function Plugins() {
  const {
    plugins,
    installedPlugins,
    loading,
    error,
    hasMore,
    loadMore,
    installPlugin,
    uninstallPlugin,
    isPluginInstalled,
  } = usePlugins({ limit: 15 });

  const [searchQuery, setSearchQuery] = useState('');
  const [installingId, setInstallingId] = useState<string | null>(null);

  const handleInstall = async (plugin: PluginRecord) => {
    try {
      setInstallingId(plugin.pluginId);
      await installPlugin(plugin);
      toast({
        title: 'Success',
        description: `${plugin.name} has been installed successfully.`,
      });
    } catch (err) {
      toast({
        title: 'Installation Failed',
        description: err instanceof Error ? err.message : 'Failed to install plugin',
        variant: 'destructive',
      });
    } finally {
      setInstallingId(null);
    }
  };

  const handleUninstall = async (plugin: PluginRecord) => {
    try {
      setInstallingId(plugin.pluginId);
      await uninstallPlugin(plugin.pluginId);
      toast({
        title: 'Success',
        description: `${plugin.name} has been uninstalled successfully.`,
      });
    } catch (err) {
      toast({
        title: 'Uninstallation Failed',
        description: err instanceof Error ? err.message : 'Failed to uninstall plugin',
        variant: 'destructive',
      });
    } finally {
      setInstallingId(null);
    }
  };

  const filterPlugins = (plugins: PluginRecord[]) => {
    if (!searchQuery) return plugins;
    const query = searchQuery.toLowerCase();
    return plugins.filter(
      plugin =>
        plugin.name.toLowerCase().includes(query) ||
        plugin.description?.toLowerCase().includes(query) ||
        plugin.authorId.toLowerCase().includes(query)
    );
  };

  const LoadingState = () => (
    <div className="space-y-1">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
      ))}
    </div>
  );

  if (error) {
    return (
      <div className="p-6 text-red-500 bg-red-50 rounded-lg">
        Error loading plugins: {error.message}
      </div>
    );
  }

  const PluginList = ({ plugins }: { plugins: PluginRecord[] }) => {
    const filteredPlugins = filterPlugins(plugins);

    if (filteredPlugins.length === 0) {
      return (
        <div className="text-center p-8 text-gray-500 bg-gray-50 rounded-lg">
          No plugins found matching your search.
        </div>
      );
    }

    return (
      <div>
        {filteredPlugins.map(plugin => (
          <PluginRow
            key={plugin.pluginId}
            plugin={plugin}
            onInstall={() => handleInstall(plugin)}
            onUninstall={() => handleUninstall(plugin)}
            isInstalled={isPluginInstalled(plugin.pluginId)}
            isInstalling={installingId === plugin.pluginId}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Tabs defaultValue="marketplace">
        <TabsList>
          <TabsTrigger value="marketplace">Marketplace</TabsTrigger>
          <TabsTrigger value="installed">
            Installed
            {installedPlugins.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {installedPlugins.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="marketplace">
          {loading && plugins.length === 0 ? (
            <LoadingState />
          ) : (
            <div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search plugins..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <PluginList plugins={plugins} />
              {hasMore && (
                <div className="flex justify-center">
                  <Button onClick={() => loadMore()} disabled={loading} variant="outline">
                    {loading ? 'Loading...' : 'Load More'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="installed">
          {loading ? (
            <LoadingState />
          ) : installedPlugins.length === 0 ? (
            <div className="text-center p-8 text-gray-500 bg-gray-50 rounded-lg">
              No plugins installed yet.
            </div>
          ) : (
            <PluginList plugins={installedPlugins} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
