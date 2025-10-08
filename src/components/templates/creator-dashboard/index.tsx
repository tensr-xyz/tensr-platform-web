'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, TrendingUp, Download, DollarSign, Users, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/card';
import { Button } from '@/components/atoms/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/molecules/tabs';
import { Badge } from '@/components/atoms/badge';

interface CreatorStats {
  totalPlugins: number;
  totalDownloads: number;
  totalRevenue: number;
  totalCustomers: number;
  monthlyRevenue: number;
  monthlyGrowth: number;
}

interface PluginData {
  pluginId: string;
  name: string;
  status: string;
  downloads: number;
  revenue: number;
  createdAt: string;
  lastUpdated: string;
}

export default function CreatorDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<CreatorStats>({
    totalPlugins: 0,
    totalDownloads: 0,
    totalRevenue: 0,
    totalCustomers: 0,
    monthlyRevenue: 0,
    monthlyGrowth: 0,
  });
  const [plugins, setPlugins] = useState<PluginData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCreatorData();
  }, []);

  const fetchCreatorData = async () => {
    try {
      // Fetch creator stats and plugins
      const [statsResponse, pluginsResponse] = await Promise.all([
        fetch('/api/creator/stats'),
        fetch('/api/creator/plugins'),
      ]);

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }

      if (pluginsResponse.ok) {
        const pluginsData = await pluginsResponse.json();
        setPlugins(pluginsData);
      }
    } catch (error) {
      console.error('Error fetching creator data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadPlugin = () => {
    router.push('/plugins/upload');
  };

  const handleConnectStripe = async () => {
    try {
      const response = await fetch('/api/creator/connect/onboarding', {
        method: 'POST',
      });

      if (response.ok) {
        const { url } = await response.json();
        window.location.href = url;
      }
    } catch (error) {
      console.error('Error starting Stripe Connect onboarding:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-lg">Loading creator dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Creator Dashboard</h1>
          <p className="text-muted-foreground mt-2">Manage your plugins and track your success</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleConnectStripe}>
            <DollarSign className="h-4 w-4 mr-2" />
            Connect Stripe
          </Button>
          <Button onClick={handleUploadPlugin}>
            <Plus className="h-4 w-4 mr-2" />
            Upload Plugin
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Plugins</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPlugins}</div>
            <p className="text-xs text-muted-foreground">Active plugins</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Downloads</CardTitle>
            <Download className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalDownloads.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">After platform fees</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.monthlyRevenue.toFixed(2)}</div>
            <p
              className={`text-xs ${stats.monthlyGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}
            >
              {stats.monthlyGrowth >= 0 ? '+' : ''}
              {stats.monthlyGrowth}% from last month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="plugins" className="space-y-6">
        <TabsList>
          <TabsTrigger value="plugins">My Plugins</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="payouts">Payouts</TabsTrigger>
        </TabsList>

        <TabsContent value="plugins" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Plugin Management</h2>
            <Button onClick={handleUploadPlugin} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New Plugin
            </Button>
          </div>

          <div className="grid gap-4">
            {plugins.map(plugin => (
              <Card key={plugin.pluginId}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{plugin.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Created {new Date(plugin.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant={plugin.status === 'APPROVED' ? 'default' : 'secondary'}>
                      {plugin.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Downloads</p>
                      <p className="font-semibold">{plugin.downloads.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Revenue</p>
                      <p className="font-semibold">${plugin.revenue.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Last Updated</p>
                      <p className="font-semibold">
                        {new Date(plugin.lastUpdated).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button variant="outline" size="sm">
                      Edit
                    </Button>
                    <Button variant="outline" size="sm">
                      View Analytics
                    </Button>
                    <Button variant="outline" size="sm">
                      Manage Versions
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            {plugins.length === 0 && (
              <Card>
                <CardContent className="text-center py-12">
                  <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No plugins yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Start building your plugin empire by uploading your first plugin
                  </p>
                  <Button onClick={handleUploadPlugin}>
                    <Plus className="h-4 w-4 mr-2" />
                    Upload Your First Plugin
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <h2 className="text-xl font-semibold">Revenue Analytics</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Revenue Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  Chart placeholder - Revenue over time
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Performing Plugins</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  Chart placeholder - Plugin performance
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="payouts" className="space-y-4">
          <h2 className="text-xl font-semibold">Payout Information</h2>
          <Card>
            <CardContent className="py-6">
              <div className="text-center">
                <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Stripe Connect Required</h3>
                <p className="text-muted-foreground mb-4">
                  Connect your Stripe account to start receiving payouts for your plugins
                </p>
                <Button onClick={handleConnectStripe}>
                  <DollarSign className="h-4 w-4 mr-2" />
                  Connect Stripe Account
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
