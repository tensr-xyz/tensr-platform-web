'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/card';
import { Badge } from '@/components/atoms/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/molecules/tabs';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Download,
  Users,
  BarChart3,
  Activity,
} from 'lucide-react';

interface PlatformStats {
  totalPlugins: number;
  totalUsers: number;
  totalRevenue: number;
  totalDownloads: number;
  monthlyRevenue: number;
  monthlyGrowth: number;
  activeCreators: number;
  approvalRate: number;
}

interface RevenueData {
  date: string;
  revenue: number;
  platformFees: number;
  creatorPayouts: number;
}

interface PluginPerformance {
  pluginId: string;
  name: string;
  downloads: number;
  revenue: number;
  creator: string;
  status: string;
}

export default function PlatformAnalytics() {
  const [stats, setStats] = useState<PlatformStats>({
    totalPlugins: 0,
    totalUsers: 0,
    totalRevenue: 0,
    totalDownloads: 0,
    monthlyRevenue: 0,
    monthlyGrowth: 0,
    activeCreators: 0,
    approvalRate: 0,
  });
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [topPlugins, setTopPlugins] = useState<PluginPerformance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      // Demo data only — replace with platform analytics API when available.
      setStats({
        totalPlugins: 156,
        totalUsers: 2847,
        totalRevenue: 45678.9,
        totalDownloads: 12453,
        monthlyRevenue: 5432.1,
        monthlyGrowth: 12.5,
        activeCreators: 89,
        approvalRate: 94.2,
      });

      setRevenueData([
        { date: '2024-01', revenue: 4200, platformFees: 420, creatorPayouts: 3780 },
        { date: '2024-02', revenue: 4800, platformFees: 480, creatorPayouts: 4320 },
        { date: '2024-03', revenue: 5200, platformFees: 520, creatorPayouts: 4680 },
        { date: '2024-04', revenue: 5432, platformFees: 543, creatorPayouts: 4889 },
      ]);

      setTopPlugins([
        {
          pluginId: '1',
          name: 'Advanced Statistical Analysis',
          downloads: 1247,
          revenue: 12470,
          creator: 'DataSciencePro',
          status: 'APPROVED',
        },
        {
          pluginId: '2',
          name: 'Machine Learning Pipeline',
          downloads: 892,
          revenue: 8920,
          creator: 'MLExpert',
          status: 'APPROVED',
        },
        {
          pluginId: '3',
          name: 'Data Visualization Suite',
          downloads: 756,
          revenue: 7560,
          creator: 'VizMaster',
          status: 'APPROVED',
        },
        {
          pluginId: '4',
          name: 'Time Series Forecasting',
          downloads: 634,
          revenue: 6340,
          creator: 'ForecastGuru',
          status: 'APPROVED',
        },
        {
          pluginId: '5',
          name: 'Regression Analysis Tools',
          downloads: 523,
          revenue: 5230,
          creator: 'StatsWizard',
          status: 'APPROVED',
        },
      ]);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-lg">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
        <strong>Demo data.</strong> Platform analytics below are sample figures for layout preview
        only — not live production metrics.
      </div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Platform Analytics</h1>
        <p className="text-muted-foreground mt-2">
          Monitor marketplace performance and revenue metrics
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">All time platform revenue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.monthlyRevenue.toLocaleString()}</div>
            <p
              className={`text-xs ${stats.monthlyGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}
            >
              {stats.monthlyGrowth >= 0 ? '+' : ''}
              {stats.monthlyGrowth}% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Downloads</CardTitle>
            <Download className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalDownloads.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Plugin downloads</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Creators</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeCreators}</div>
            <p className="text-xs text-muted-foreground">Plugin developers</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="revenue">Revenue Analysis</TabsTrigger>
          <TabsTrigger value="plugins">Plugin Performance</TabsTrigger>
          <TabsTrigger value="users">User Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Platform Growth</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Total Plugins:</span>
                    <span className="font-medium">{stats.totalPlugins}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Total Users:</span>
                    <span className="font-medium">{stats.totalUsers}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Approval Rate:</span>
                    <span className="font-medium">{stats.approvalRate}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Platform Fee:</span>
                    <span className="font-medium">10%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Revenue Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Platform Fees:</span>
                    <span className="font-medium">${(stats.totalRevenue * 0.1).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Creator Payouts:</span>
                    <span className="font-medium">${(stats.totalRevenue * 0.9).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Average Plugin Price:</span>
                    <span className="font-medium">
                      ${(stats.totalRevenue / stats.totalPlugins).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Revenue per Download:</span>
                    <span className="font-medium">
                      ${(stats.totalRevenue / stats.totalDownloads).toFixed(2)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="revenue" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {revenueData.map(month => (
                  <div
                    key={month.date}
                    className="flex items-center justify-between p-4 bg-muted rounded-md"
                  >
                    <div className="flex-1">
                      <div className="font-medium">{month.date}</div>
                      <div className="text-sm text-muted-foreground">
                        Total: ${month.revenue.toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <div className="text-sm">
                        <span className="text-muted-foreground">Platform:</span> $
                        {month.platformFees}
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Creators:</span> $
                        {month.creatorPayouts}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plugins" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Top Performing Plugins</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topPlugins.map((plugin, index) => (
                  <div
                    key={plugin.pluginId}
                    className="flex items-center justify-between p-4 border rounded-md"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center text-sm font-medium">
                        #{index + 1}
                      </div>
                      <div>
                        <div className="font-medium">{plugin.name}</div>
                        <div className="text-sm text-muted-foreground">by {plugin.creator}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">${plugin.revenue.toLocaleString()}</div>
                      <div className="text-sm text-muted-foreground">
                        {plugin.downloads} downloads
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>User Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Plugin Creators:</span>
                    <span className="font-medium">{stats.activeCreators}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Plugin Users:</span>
                    <span className="font-medium">{stats.totalUsers - stats.activeCreators}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Total Users:</span>
                    <span className="font-medium">{stats.totalUsers}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Engagement Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Avg. Downloads per Plugin:</span>
                    <span className="font-medium">
                      {Math.round(stats.totalDownloads / stats.totalPlugins)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Avg. Revenue per Creator:</span>
                    <span className="font-medium">
                      ${Math.round((stats.totalRevenue * 0.9) / stats.activeCreators)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Plugin Success Rate:</span>
                    <span className="font-medium">{stats.approvalRate}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
