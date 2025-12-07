'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, TrendingUp, Activity, Database, Clock, RefreshCw } from 'lucide-react';
import { Button } from '@/components/atoms/button';
import { Skeleton } from '@/components/atoms/skeleton';
import { useBilling } from '@/hooks/api/use-billing';
import Link from 'next/link';

export default function UsageDashboard() {
  const { usageStats, isLoading, error, setError, formatDate, fetchUsageStats } = useBilling();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      await fetchUsageStats();
    } catch (err) {
      console.error('Error refreshing usage stats:', err);
    } finally {
      setRefreshing(false);
    }
  };

  if (isLoading && !usageStats) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-xl font-medium">Usage Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Monitor your platform usage and limits</p>
        </div>
        <div className="space-y-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-xl font-medium">Usage Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Monitor your platform usage and limits</p>
        </div>
        <div className="border border-red-200 rounded-md p-6 bg-red-50">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-red-500" />
            <div>
              <h3 className="font-medium text-red-800">Error Loading Usage Data</h3>
              <p className="text-red-700">{error}</p>
            </div>
          </div>
          <Button onClick={handleRefresh} className="mt-4" variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  const stats = usageStats as any;
  const limits = stats?.limits;
  const usage = stats?.usage;
  const usagePercentages = stats?.usagePercentages;

  const formatBytes = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-red-600';
    if (percentage >= 90) return 'bg-yellow-500';
    if (percentage >= 75) return 'bg-blue-500';
    return 'bg-green-500';
  };

  const getUsageWarning = (percentage: number) => {
    if (percentage >= 100) return { severity: 'error', message: 'Limit exceeded' };
    if (percentage >= 90) return { severity: 'warning', message: 'Approaching limit' };
    if (percentage >= 75) return { severity: 'info', message: 'High usage' };
    return null;
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium">Usage Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Monitor your platform usage and limits</p>
        </div>
        <Button onClick={handleRefresh} variant="outline" disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Usage Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Operations Usage */}
        <div className="border border-gray-200 rounded-md p-6 bg-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-gray-500" />
              <h3 className="text-sm font-medium text-gray-700">Operations</h3>
            </div>
            {usagePercentages?.operations && getUsageWarning(usagePercentages.operations) && (
              <span
                className={`text-xs px-2 py-1 rounded ${
                  getUsageWarning(usagePercentages.operations)?.severity === 'error'
                    ? 'bg-red-100 text-red-700'
                    : getUsageWarning(usagePercentages.operations)?.severity === 'warning'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-blue-100 text-blue-700'
                }`}
              >
                {getUsageWarning(usagePercentages.operations)?.message}
              </span>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-medium">
                {usage?.totalOperations?.toLocaleString() || 0}
              </span>
              <span className="text-sm text-gray-500">
                / {limits?.operations?.toLocaleString() || 'Unlimited'}
              </span>
            </div>
            {limits?.operations && (
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${getUsageColor(usagePercentages?.operations || 0)}`}
                  style={{
                    width: `${Math.min(100, usagePercentages?.operations || 0)}%`,
                  }}
                ></div>
              </div>
            )}
            {usagePercentages?.operations && (
              <p className="text-xs text-gray-500">
                {Math.round(usagePercentages.operations)}% of limit used
              </p>
            )}
          </div>
        </div>

        {/* Data Processed Usage */}
        <div className="border border-gray-200 rounded-md p-6 bg-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-gray-500" />
              <h3 className="text-sm font-medium text-gray-700">Data Processed</h3>
            </div>
            {usagePercentages?.dataProcessed && getUsageWarning(usagePercentages.dataProcessed) && (
              <span
                className={`text-xs px-2 py-1 rounded ${
                  getUsageWarning(usagePercentages.dataProcessed)?.severity === 'error'
                    ? 'bg-red-100 text-red-700'
                    : getUsageWarning(usagePercentages.dataProcessed)?.severity === 'warning'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-blue-100 text-blue-700'
                }`}
              >
                {getUsageWarning(usagePercentages.dataProcessed)?.message}
              </span>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-medium">
                {formatBytes(usage?.totalDataProcessed || 0)}
              </span>
              <span className="text-sm text-gray-500">
                / {limits?.dataProcessed ? formatBytes(limits.dataProcessed) : 'Unlimited'}
              </span>
            </div>
            {limits?.dataProcessed && (
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${getUsageColor(usagePercentages?.dataProcessed || 0)}`}
                  style={{
                    width: `${Math.min(100, usagePercentages?.dataProcessed || 0)}%`,
                  }}
                ></div>
              </div>
            )}
            {usagePercentages?.dataProcessed && (
              <p className="text-xs text-gray-500">
                {Math.round(usagePercentages.dataProcessed)}% of limit used
              </p>
            )}
          </div>
        </div>

        {/* Execution Time */}
        <div className="border border-gray-200 rounded-md p-6 bg-white">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-gray-500" />
            <h3 className="text-sm font-medium text-gray-700">Execution Time</h3>
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-medium">
                {usage?.totalExecutionTime
                  ? `${(usage.totalExecutionTime / 1000).toFixed(1)}s`
                  : '0s'}
              </span>
            </div>
            <p className="text-xs text-gray-500">Total processing time this period</p>
          </div>
        </div>
      </div>

      {/* Warnings and Alerts */}
      {((usagePercentages?.operations && usagePercentages.operations >= 75) ||
        (usagePercentages?.dataProcessed && usagePercentages.dataProcessed >= 75)) && (
        <div className="mb-6 border border-yellow-200 rounded-md p-4 bg-yellow-50">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium text-yellow-800 mb-1">Usage Warning</h3>
              <p className="text-sm text-yellow-700">
                {usagePercentages?.operations >= 100 || usagePercentages?.dataProcessed >= 100
                  ? 'You have exceeded your usage limits. Please upgrade your plan to continue using the platform.'
                  : 'You are approaching your usage limits. Consider upgrading your plan to avoid service interruption.'}
              </p>
              <Link href="/payment" className="mt-2 inline-block">
                <Button className="mt-2" size="sm">
                  Upgrade Plan
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Usage Breakdown by Operation Type */}
      {usage?.operationTypes && Object.keys(usage.operationTypes).length > 0 && (
        <div className="border border-gray-200 rounded-md p-6 bg-white mb-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-gray-500" />
            <h2 className="text-base font-medium">Usage by Operation Type</h2>
          </div>
          <div className="space-y-3">
            {Object.entries(usage.operationTypes)
              .sort(([, a]: any, [, b]: any) => b - a)
              .map(([operationType, count]: [string, any]) => (
                <div key={operationType} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 capitalize">
                    {operationType.replace(/_/g, ' ')}
                  </span>
                  <span className="text-sm font-medium">{count.toLocaleString()}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Period Information */}
      {stats?.period && (
        <div className="border border-gray-200 rounded-md p-4 bg-gray-50">
          <p className="text-sm text-gray-600">
            <span className="font-medium">Period:</span> {formatDate(stats.period.start)} -{' '}
            {formatDate(stats.period.end)}
          </p>
        </div>
      )}
    </div>
  );
}
