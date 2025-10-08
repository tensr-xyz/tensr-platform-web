'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/card';
import { Button } from '@/components/atoms/button';
import { Badge } from '@/components/atoms/badge';
import { Separator } from '@/components/atoms/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/molecules/tabs';
import { Download, Star, Eye, Code, FileText, Users, Calendar, Tag } from 'lucide-react';
import { PluginRecord } from '@/types/plugin';
import usePlugins from '@/hooks/api/use-plugin';

export default function PluginDetails() {
  const params = useParams();
  const router = useRouter();
  const { getPlugin, isPluginInstalled, installPlugin } = usePlugins();

  const [plugin, setPlugin] = useState<PluginRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (params.pluginId) {
      fetchPlugin();
    }
  }, [params.pluginId]);

  const fetchPlugin = async () => {
    try {
      const pluginData = await getPlugin(params.pluginId as string);
      setPlugin(pluginData);
    } catch (err) {
      setError('Failed to load plugin');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (!plugin) return;

    setPurchasing(true);
    setError(null);

    try {
      if (plugin.isPaid) {
        // Redirect to purchase flow
        router.push(`/plugins/${plugin.pluginId}/purchase`);
      } else {
        // Free plugin - install directly
        await installPlugin(plugin);
        router.push('/workspace');
      }
    } catch (err) {
      setError('Failed to process purchase');
    } finally {
      setPurchasing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-lg">Loading plugin...</p>
        </div>
      </div>
    );
  }

  if (error || !plugin) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Plugin Not Found</h1>
          <p className="text-muted-foreground mb-6">
            {error || 'The requested plugin could not be found.'}
          </p>
          <Button onClick={() => router.push('/plugins')}>Back to Marketplace</Button>
        </div>
      </div>
    );
  }

  const isInstalled = isPluginInstalled(plugin.pluginId);
  const canPurchase = !isInstalled && plugin.status === 'APPROVED';

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <Button variant="outline" onClick={() => router.push('/plugins')} className="mb-4">
          ← Back to Marketplace
        </Button>

        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold">{plugin.name}</h1>
              <Badge variant={plugin.status === 'APPROVED' ? 'default' : 'secondary'}>
                {plugin.status}
              </Badge>
              {plugin.isPaid && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  Paid
                </Badge>
              )}
            </div>
            <p className="text-xl text-muted-foreground mb-4">{plugin.description}</p>

            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span>By {plugin.authorId}</span>
              </div>
              <div className="flex items-center gap-2">
                <Code className="h-4 w-4" />
                <span>{plugin.language}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>
                  Updated {new Date(plugin.updatedAt || plugin.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          <div className="text-right">
            {plugin.isPaid && plugin.pricing && (
              <div className="mb-4">
                <div className="text-3xl font-bold">
                  ${plugin.pricing.price}
                  {plugin.pricing.model === 'subscription' && (
                    <span className="text-lg text-muted-foreground">
                      /{plugin.pricing.subscriptionInterval}
                    </span>
                  )}
                </div>
                {plugin.pricing.trialDays && plugin.pricing.trialDays > 0 && (
                  <p className="text-sm text-green-600">
                    {plugin.pricing.trialDays}-day free trial
                  </p>
                )}
              </div>
            )}

            <Button
              onClick={handlePurchase}
              disabled={!canPurchase || purchasing}
              className="w-full"
              size="lg"
            >
              {purchasing
                ? 'Processing...'
                : isInstalled
                  ? 'Installed'
                  : plugin.isPaid
                    ? 'Purchase Plugin'
                    : 'Install Free Plugin'}
            </Button>

            {plugin.revenue && (
              <div className="mt-3 text-xs text-muted-foreground">
                <div>Downloads: {plugin.revenue.totalDownloads.toLocaleString()}</div>
                {plugin.isPaid && <div>Revenue: ${plugin.revenue.totalSales.toFixed(2)}</div>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Plugin Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Thumbnail */}
          {plugin.thumbnailUrl && (
            <Card>
              <CardContent className="p-0">
                <img
                  src={plugin.thumbnailUrl}
                  alt={plugin.name}
                  className="w-full h-64 object-cover rounded-t-lg"
                />
              </CardContent>
            </Card>
          )}

          {/* Tabs */}
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="capabilities">Capabilities</TabsTrigger>
              <TabsTrigger value="versions">Versions</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>About This Plugin</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed">{plugin.description}</p>

                  {plugin.tags && plugin.tags.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-medium mb-2">Tags</h4>
                      <div className="flex flex-wrap gap-2">
                        {plugin.tags.map((tag, index) => (
                          <Badge key={index} variant="secondary">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Technical Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Language:</span> {plugin.language}
                    </div>
                    <div>
                      <span className="font-medium">Entry Point:</span> {plugin.entryPoint}
                    </div>
                    <div>
                      <span className="font-medium">Version:</span> {plugin.version}
                    </div>
                    <div>
                      <span className="font-medium">License:</span>{' '}
                      {plugin.license || 'Not specified'}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="capabilities" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Input & Output Types</CardTitle>
                </CardHeader>
                <CardContent>
                  {plugin.capabilities && (
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium mb-2">Input Types</h4>
                        <div className="flex flex-wrap gap-2">
                          {plugin.capabilities.inputTypes.map((type, index) => (
                            <Badge key={index} variant="outline">
                              {type}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h4 className="font-medium mb-2">Output Types</h4>
                        <div className="flex flex-wrap gap-2">
                          {plugin.capabilities.outputTypes.map((type, index) => (
                            <Badge key={index} variant="outline">
                              {type}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="versions" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Version History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-muted rounded-md">
                      <div>
                        <div className="font-medium">v{plugin.version}</div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(plugin.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <Badge variant="default">Current</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Column - Sidebar */}
        <div className="space-y-6">
          {/* Creator Info */}
          <Card>
            <CardHeader>
              <CardTitle>Creator</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="w-16 h-16 bg-muted rounded-full mx-auto mb-3 flex items-center justify-center">
                  <Users className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-medium">{plugin.authorId}</h3>
                <p className="text-sm text-muted-foreground">Plugin Developer</p>
              </div>
            </CardContent>
          </Card>

          {/* Pricing Details */}
          {plugin.isPaid && plugin.pricing && (
            <Card>
              <CardHeader>
                <CardTitle>Pricing</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Price:</span>
                    <span className="font-medium">
                      ${plugin.pricing.price}
                      {plugin.pricing.model === 'subscription' && (
                        <span className="text-muted-foreground">
                          /{plugin.pricing.subscriptionInterval}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Model:</span>
                    <span className="font-medium capitalize">{plugin.pricing.model}</span>
                  </div>
                  {plugin.pricing.trialDays && plugin.pricing.trialDays > 0 && (
                    <div className="flex justify-between">
                      <span>Trial:</span>
                      <span className="font-medium text-green-600">
                        {plugin.pricing.trialDays} days
                      </span>
                    </div>
                  )}
                  <Separator />
                  <div className="text-xs text-muted-foreground">
                    Platform fee: 10% (automatically deducted)
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Installation */}
          <Card>
            <CardHeader>
              <CardTitle>Installation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <Download className="h-4 w-4 text-green-600" />
                  <span>Automatic installation after purchase</span>
                </div>
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-blue-600" />
                  <span>Access from workspace</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-purple-600" />
                  <span>Documentation included</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
