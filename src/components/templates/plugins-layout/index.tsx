'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Star, Download, ChevronDown, Zap, User, ArrowRight } from 'lucide-react';
import { Button } from '@/components/atoms/button';
import { Input } from '@/components/atoms/input';
import { PluginRecord } from '@/types/plugin';
import usePlugins from '@/hooks/api/use-plugin';
import { Loading } from '@/components/molecules/loading';

interface FilterOptions {
  search: string;
  category: string;
}

export default function PluginsLayout() {
  const router = useRouter();
  const { plugins, isPluginInstalled, installPlugin } = usePlugins();

  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterOptions>({
    search: '',
    category: '',
  });

  useEffect(() => {
    if (plugins.length > 0 || !loading) {
      setLoading(false);
    }
  }, [plugins, loading]);

  const filteredPlugins = useMemo(() => {
    return plugins.filter(plugin => {
      if (
        filters.search &&
        !plugin.name.toLowerCase().includes(filters.search.toLowerCase()) &&
        !plugin.description.toLowerCase().includes(filters.search.toLowerCase())
      ) {
        return false;
      }

      if (filters.category && plugin.language !== filters.category) {
        return false;
      }

      return true;
    });
  }, [plugins, filters]);

  const categories = useMemo(() => {
    const cats = [...new Set(plugins.map(p => p.language))];
    return cats.sort();
  }, [plugins]);

  const handleInstall = async (plugin: PluginRecord) => {
    try {
      if (plugin.isPaid) {
        router.push(`/plugins/${plugin.pluginId}/purchase`);
      } else {
        await installPlugin(plugin);
      }
    } catch (error) {
      console.error('Error installing plugin:', error);
    }
  };

  const handleViewDetails = (plugin: PluginRecord) => {
    router.push(`/plugins/${plugin.pluginId}`);
  };

  if (loading) {
    return <Loading fullScreen />;
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Top Navigation - Notion Style */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-semibold text-gray-900">Discover</h1>
          <div className="flex items-center gap-4 text-gray-600">
            <span className="flex items-center gap-1 cursor-pointer hover:text-gray-900">
              Work <ChevronDown className="h-4 w-4" />
            </span>
            <span className="flex items-center gap-1 cursor-pointer hover:text-gray-900">
              Life <ChevronDown className="h-4 w-4" />
            </span>
            <span className="flex items-center gap-1 cursor-pointer hover:text-gray-900">
              School <ChevronDown className="h-4 w-4" />
            </span>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Try 'data analysis'"
            value={filters.search}
            onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
            className="pl-10 w-64 border-gray-200 focus:border-gray-400 focus:ring-0"
          />
        </div>
      </div>

      {/* Category Pills - Exact Notion Style */}
      <div className="flex flex-wrap gap-2 mb-8">
        <button
          onClick={() => setFilters(prev => ({ ...prev, category: '' }))}
          className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
            filters.category === ''
              ? 'bg-gray-100 text-gray-900 border-gray-200'
              : 'text-gray-600 hover:bg-gray-50 border-gray-200'
          }`}
        >
          All
        </button>
        {categories.map(category => (
          <button
            key={category}
            onClick={() => setFilters(prev => ({ ...prev, category }))}
            className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
              filters.category === category
                ? 'bg-gray-100 text-gray-900 border-gray-200'
                : 'text-gray-600 hover:bg-gray-50 border-gray-200'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Main Content Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* AI Section Card */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center">
              <Zap className="h-4 w-4 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-gray-900">AI</span>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Your agent, your rules</h2>
          <p className="text-gray-600 mb-4">
            Connect any page to your agent to customize how your agent talks, thinks, and works
          </p>
          <div className="flex items-center gap-2 text-blue-600 font-medium">
            <span>Explore</span>
            <ArrowRight className="h-4 w-4" />
          </div>
          {/* Illustration placeholder */}
          <div className="mt-4 flex justify-center">
            <div className="w-32 h-32 bg-gray-100 rounded-full flex items-center justify-center">
              <div className="text-gray-400 text-sm">AI Agent</div>
            </div>
          </div>
        </div>

        {/* Top Creator Card */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 bg-gray-100 rounded flex items-center justify-center">
              <User className="h-4 w-4 text-gray-600" />
            </div>
            <span className="text-sm font-medium text-gray-900">Top creator</span>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
              <User className="h-6 w-6 text-gray-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-1">Plugin Creator</h3>
              <p className="text-gray-600 text-sm">
                Beginner-friendly analysis plugins for everyday data processing and insights
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Featured Plugins Section */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Star className="h-5 w-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Featured plugins</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {filteredPlugins.slice(0, 3).map(plugin => (
            <FeaturedPluginCard
              key={plugin.pluginId}
              plugin={plugin}
              onInstall={handleInstall}
              onViewDetails={handleViewDetails}
              isInstalled={isPluginInstalled(plugin.pluginId)}
            />
          ))}
        </div>
      </div>

      {/* All Plugins Grid */}
      {filteredPlugins.length > 3 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">All plugins</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPlugins.slice(3).map(plugin => (
              <PluginCard
                key={plugin.pluginId}
                plugin={plugin}
                onInstall={handleInstall}
                onViewDetails={handleViewDetails}
                isInstalled={isPluginInstalled(plugin.pluginId)}
              />
            ))}
          </div>
        </div>
      )}

      {filteredPlugins.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No plugins found</h3>
          <p className="text-gray-600 mb-4">Try adjusting your search terms or filters.</p>
          <Button
            variant="outline"
            onClick={() => setFilters({ search: '', category: '' })}
            className="border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            Clear filters
          </Button>
        </div>
      )}
    </div>
  );
}

// Featured Plugin Card - Exact Notion Template Style
function FeaturedPluginCard({
  plugin,
  onInstall,
  onViewDetails,
  isInstalled,
}: {
  plugin: PluginRecord;
  onInstall: (plugin: PluginRecord) => void;
  onViewDetails: (plugin: PluginRecord) => void;
  isInstalled: boolean;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:border-gray-300 transition-colors">
      {/* Template Preview */}
      <div className="aspect-video bg-gray-100 flex items-center justify-center">
        {plugin.thumbnailUrl ? (
          <img src={plugin.thumbnailUrl} alt={plugin.name} className="w-full h-full object-cover" />
        ) : (
          <div className="text-gray-400 text-sm">Template Preview</div>
        )}
      </div>

      {/* Template Info */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium text-gray-900">{plugin.name}</h3>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
            <span>4.6</span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Free</span>
          <Button
            onClick={() => onViewDetails(plugin)}
            size="sm"
            className="text-xs bg-gray-900 hover:bg-gray-800 text-white"
          >
            View
          </Button>
        </div>
      </div>
    </div>
  );
}

// Plugin Card Component - Notion Style
function PluginCard({
  plugin,
  onInstall,
  onViewDetails,
  isInstalled,
}: {
  plugin: PluginRecord;
  onInstall: (plugin: PluginRecord) => void;
  onViewDetails: (plugin: PluginRecord) => void;
  isInstalled: boolean;
}) {
  return (
    <div className="group border border-gray-200 rounded-lg p-6 hover:border-gray-300 transition-colors bg-white">
      {/* Plugin Preview/Thumbnail */}
      <div className="aspect-video bg-gray-100 rounded-md mb-4 flex items-center justify-center">
        {plugin.thumbnailUrl ? (
          <img
            src={plugin.thumbnailUrl}
            alt={plugin.name}
            className="w-full h-full object-cover rounded-md"
          />
        ) : (
          <div className="text-gray-400 text-sm">Preview</div>
        )}
      </div>

      {/* Plugin Info */}
      <div className="space-y-3">
        <div>
          <h3 className="font-medium text-gray-900 mb-1">{plugin.name}</h3>
          <p className="text-sm text-gray-600 line-clamp-2">{plugin.description}</p>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <Download className="h-3 w-3" />
            <span>{plugin.revenue?.totalDownloads || 0}</span>
          </div>
          <div className="flex items-center gap-1">
            <Star className="h-3 w-3" />
            <span>4.6</span>
          </div>
          <span className="text-gray-400">•</span>
          <span className="capitalize">{plugin.language}</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2">
          <Button
            onClick={() => onViewDetails(plugin)}
            variant="outline"
            size="sm"
            className="flex-1 border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            View Details
          </Button>

          {!isInstalled && plugin.status === 'APPROVED' ? (
            <Button
              onClick={() => onInstall(plugin)}
              size="sm"
              className="flex-1 bg-gray-900 hover:bg-gray-800 text-white"
            >
              {plugin.isPaid ? 'Purchase' : 'Install'}
            </Button>
          ) : (
            <Button
              disabled
              size="sm"
              className="flex-1 bg-gray-100 text-gray-400 cursor-not-allowed"
            >
              {isInstalled ? 'Installed' : 'Unavailable'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
