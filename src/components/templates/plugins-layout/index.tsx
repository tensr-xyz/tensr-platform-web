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

const PluginsLayout = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilters, setSelectedFilters] = useState({
    products: 'all products',
    resources: 'all resources',
    pricing: 'all',
  });

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

  const handleFilterChange = (filterId, value) => {
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

  if (error) {
    return (
      <div className="w-full px-8 py-8 text-red-500">Error loading plugins: {error.message}</div>
    );
  }

  return (
    <div className="w-full px-8 py-8">
      {/* Search and Filters Row */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8">
        <div className="relative w-full sm:w-[400px]">
          <Input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder='Search for resources like "portfolio"'
            className="w-full h-10 pl-10"
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {filteredPlugins.map(plugin => (
          <div key={plugin.pluginId} className="group overflow-hidden cursor-pointer bg-white">
            {/* Image Section */}
            <div className="relative w-full aspect-5/3 bg-gray-100 overflow-hidden">
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

            {/* Content Section */}
            <div className="py-3">
              <h3 className="text-sm font-medium">{plugin.name}</h3>
              <p className="text-xs text-gray-600 mt-0.5 mb-2 line-clamp-2">{plugin.description}</p>

              {/* Footer */}
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>by {plugin.authorId}</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      if (isPluginInstalled(plugin.pluginId)) {
                        uninstallPlugin(plugin.pluginId);
                      } else {
                        installPlugin(plugin);
                      }
                    }}
                    className="px-2 py-1 bg-blue-500 text-white rounded-sm hover:bg-blue-600 transition-colors"
                  >
                    {isPluginInstalled(plugin.pluginId) ? 'Uninstall' : 'Install'}
                  </button>
                </div>
              </div>
            </div>
          </div>
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
