'use client';

import { Search } from 'lucide-react';
import { useState } from 'react';
import { Input } from '@/components/atoms/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/select';
import usePlugins from '@/hooks/api/use-plugin';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/atoms/card';
import { Button } from '@/components/atoms/button';
import { useRouter } from 'next/navigation';
import { PluginRecord } from '@/types/plugin';

interface PluginCardProps {
  plugin: PluginRecord;
  onSelect?: (pluginId: string) => void;
  isPluginInstalled: (pluginId: string) => boolean;
  installPlugin: (plugin: PluginRecord) => void;
  uninstallPlugin: (pluginId: string) => void;
}

const PluginCard = ({
  plugin,
  onSelect,
  isPluginInstalled,
  installPlugin,
  uninstallPlugin,
}: PluginCardProps) => {
  return (
    <Card
      className="cursor-pointer overflow-hidden hover:border-foreground transition-colors group bg-white"
      onClick={() => onSelect && onSelect(plugin.pluginId)}
    >
      {/* Image Section with padding */}
      <div className="p-3 pb-0">
        <div className="relative w-full aspect-[2/1] bg-gray-100 overflow-hidden rounded-md">
          <img
            src={plugin.thumbnailUrl || '/api/placeholder/480/320'}
            alt={plugin.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-2 right-2">
            <span
              className={`text-xs px-2 py-1 rounded-md ${
                plugin.isPaid ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              {plugin.isPaid ? 'Paid' : 'Free'}
            </span>
          </div>
        </div>
      </div>

      <CardHeader className="p-3 pb-1">
        <div className="flex justify-between items-start w-full">
          <div className="flex-1">
            <CardTitle className="text-sm font-medium text-gray-900">{plugin.name}</CardTitle>
            <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{plugin.description}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-3 pt-1">
        <div className="flex flex-wrap gap-2 mb-2">
          {plugin.tags &&
            plugin.tags.slice(0, 2).map((tag, index) => (
              <span key={index} className="px-2 py-1 bg-gray-100 rounded-sm text-xs text-gray-600">
                {tag}
              </span>
            ))}
          {plugin.tags && plugin.tags.length > 2 && (
            <span className="px-2 py-1 bg-gray-100 rounded-sm text-xs text-gray-600">
              +{plugin.tags.length - 2}
            </span>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex justify-between text-xs text-gray-500 p-3 pt-0">
        <span>by {plugin.authorId}</span>
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            onClick={e => {
              e.stopPropagation();
              if (isPluginInstalled(plugin.pluginId)) {
                uninstallPlugin(plugin.pluginId);
              } else {
                installPlugin(plugin);
              }
            }}
          >
            {isPluginInstalled(plugin.pluginId) ? 'Uninstall' : 'Install'}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

const PluginsLayout = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilters, setSelectedFilters] = useState({
    products: 'all products',
    resources: 'all resources',
    pricing: 'all',
  });
  const router = useRouter();

  const {
    plugins,
    loading,
    error,
    hasMore,
    loadMore,
    isPluginInstalled,
    installPlugin,
    uninstallPlugin,
  } = usePlugins();

  const filterOptions = [
    {
      id: 'products',
      label: 'All products',
      options: ['All products', 'Design', 'Development', 'Marketing'],
    },
    {
      id: 'resources',
      label: 'All resources',
      options: ['All resources', 'Plugins', 'Templates', 'UI Kits'],
    },
    {
      id: 'pricing',
      label: 'Paid + free',
      options: ['All', 'Free', 'Paid'],
    },
  ];

  const handleFilterChange = (filterId: string, value: string) => {
    setSelectedFilters(prev => ({
      ...prev,
      [filterId]: value,
    }));
  };

  const filteredPlugins = plugins.filter(plugin => {
    // Search filter
    if (
      searchQuery &&
      !plugin.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !plugin.description.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }

    // Pricing filter
    if (selectedFilters.pricing !== 'all') {
      const isPaid = selectedFilters.pricing === 'paid';
      if (plugin.isPaid !== isPaid) return false;
    }

    // Add more filters as needed
    return true;
  });

  const handlePluginSelect = (pluginId: string) => {
    router.push(`/plugins/${pluginId}`);
  };

  if (error) {
    return (
      <div className="w-full px-8 py-8 text-red-500">Error loading plugins: {error.message}</div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-secondary p-4 md:p-8">
      {/* Search and Filters Row */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8">
        <div className="relative w-full sm:w-[400px]">
          <Input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder='Search for resources like "portfolio"'
            className="w-full h-10 pl-10 bg-background"
          />
          <Search
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
            size={16}
          />
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {filterOptions.map(filter => (
            <Select key={filter.id} onValueChange={value => handleFilterChange(filter.id, value)}>
              <SelectTrigger className="w-[140px] bg-white h-10">
                <SelectValue placeholder={filter.label} />
              </SelectTrigger>
              <SelectContent>
                {filter.options.map(option => (
                  <SelectItem key={option} value={option.toLowerCase()}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}
        </div>
      </div>

      {/* Plugins Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPlugins.map(plugin => (
          <PluginCard
            key={plugin.pluginId}
            plugin={plugin}
            onSelect={handlePluginSelect}
            isPluginInstalled={isPluginInstalled}
            installPlugin={installPlugin}
            uninstallPlugin={uninstallPlugin}
          />
        ))}
      </div>

      {/* Load More Button */}
      {hasMore && (
        <div className="mt-8 text-center">
          <button
            onClick={loadMore}
            disabled={loading}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  );
};

export default PluginsLayout;
