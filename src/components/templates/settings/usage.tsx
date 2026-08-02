'use client';

import { useState } from 'react';
import { AlertTriangle, TrendingUp, Activity, Sparkles, FileText, RefreshCw } from 'lucide-react';
import { Button } from '@/components/atoms/button';
import { Skeleton } from '@/components/atoms/skeleton';
import { useBilling } from '@/hooks/api/use-billing';
import Link from 'next/link';

function PageHeader() {
  return (
    <div className="text-center">
      <h2 className="text-lg font-medium tracking-tight">Usage</h2>
      <p className="mt-1 text-sm text-muted-foreground">Monitor your platform usage and limits</p>
    </div>
  );
}

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
      <div className="space-y-6">
        <PageHeader />
        <section className="overflow-hidden rounded-lg border border-border bg-background">
          <div className="border-b border-border px-6 py-4">
            <h3 className="text-base font-medium">Overview</h3>
            <p className="mt-1 text-sm text-muted-foreground">Current period usage summary</p>
          </div>
          <div className="space-y-4 p-6">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </section>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader />
        <section className="overflow-hidden rounded-lg border border-red-200 bg-red-50">
          <div className="p-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-red-500" />
              <div>
                <h3 className="font-medium text-red-800">Error Loading Usage Data</h3>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
            <Button onClick={handleRefresh} className="mt-4" variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </div>
        </section>
      </div>
    );
  }

  const usage = usageStats?.usage;
  const limits = usageStats?.limits;
  const percentages = usageStats?.usagePercentages;
  const assistant = usageStats?.assistant_current_period;
  const period = usageStats?.period || usageStats?.summary?.period;
  const operationTypes = usage?.operationTypes || usageStats?.summary?.by_event_type || {};

  const analyses = usage?.analyses ?? usageStats?.summary?.analyses ?? 0;
  const reports = usage?.reports ?? usageStats?.summary?.reports ?? 0;
  const aiRequests = usage?.aiRequests ?? assistant?.requests ?? 0;
  const aiCap = limits?.assistant_requests ?? assistant?.request_cap ?? 0;
  const reportCap = limits?.reports ?? 0;
  const aiPct = percentages?.assistant_requests ?? 0;
  const reportPct = percentages?.reports ?? 0;

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

  const showWarning = aiPct >= 75 || reportPct >= 75;

  return (
    <div className="space-y-6">
      <PageHeader />

      <section className="overflow-hidden rounded-lg border border-border bg-background">
        <div className="flex items-start justify-between border-b border-border px-6 py-4">
          <div>
            <h3 className="text-base font-medium">Overview</h3>
            <p className="mt-1 text-sm text-muted-foreground">Current period usage summary</p>
          </div>
          <Button onClick={handleRefresh} variant="outline" size="sm" disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-md border border-border p-4">
              <div className="mb-4 flex items-center gap-2">
                <Activity className="h-5 w-5 text-muted-foreground" />
                <h4 className="text-sm font-medium">Analyses</h4>
              </div>
              <div className="space-y-2">
                <span className="text-2xl font-medium">{analyses.toLocaleString()}</span>
                <p className="text-xs text-muted-foreground">Analysis runs this month</p>
              </div>
            </div>

            <div className="rounded-md border border-border p-4">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-muted-foreground" />
                  <h4 className="text-sm font-medium">AI requests</h4>
                </div>
                {getUsageWarning(aiPct) && (
                  <span
                    className={`rounded px-2 py-1 text-xs ${
                      getUsageWarning(aiPct)?.severity === 'error'
                        ? 'bg-red-100 text-red-700'
                        : getUsageWarning(aiPct)?.severity === 'warning'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {getUsageWarning(aiPct)?.message}
                  </span>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-medium">{aiRequests.toLocaleString()}</span>
                  <span className="text-sm text-muted-foreground">
                    / {aiCap > 0 ? aiCap.toLocaleString() : '—'}
                  </span>
                </div>
                {aiCap > 0 && (
                  <div className="h-2 w-full rounded-full bg-muted">
                    <div
                      className={`h-2 rounded-full ${getUsageColor(aiPct)}`}
                      style={{ width: `${Math.min(100, aiPct)}%` }}
                    />
                  </div>
                )}
                <p className="text-xs text-muted-foreground">AI assistant requests this month</p>
              </div>
            </div>

            <div className="rounded-md border border-border p-4">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <h4 className="text-sm font-medium">Reports</h4>
                </div>
                {getUsageWarning(reportPct) && (
                  <span
                    className={`rounded px-2 py-1 text-xs ${
                      getUsageWarning(reportPct)?.severity === 'error'
                        ? 'bg-red-100 text-red-700'
                        : getUsageWarning(reportPct)?.severity === 'warning'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {getUsageWarning(reportPct)?.message}
                  </span>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-medium">{reports.toLocaleString()}</span>
                  <span className="text-sm text-muted-foreground">
                    / {reportCap > 0 ? reportCap.toLocaleString() : '—'}
                  </span>
                </div>
                {reportCap > 0 && (
                  <div className="h-2 w-full rounded-full bg-muted">
                    <div
                      className={`h-2 rounded-full ${getUsageColor(reportPct)}`}
                      style={{ width: `${Math.min(100, reportPct)}%` }}
                    />
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Reports generated this month</p>
              </div>
            </div>
          </div>
        </div>

        {period && (
          <div className="border-t border-border bg-muted/30 px-6 py-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Period:</span>{' '}
              {formatDate(period.start)} - {formatDate(period.end)}
            </p>
          </div>
        )}
      </section>

      {showWarning && (
        <section className="overflow-hidden rounded-lg border border-yellow-200 bg-yellow-50">
          <div className="p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-600" />
              <div className="flex-1">
                <h3 className="mb-1 text-base font-medium text-yellow-800">Usage Warning</h3>
                <p className="text-sm text-yellow-700">
                  {aiPct >= 100 || reportPct >= 100
                    ? 'You have exceeded a plan limit. Upgrade to continue without interruption.'
                    : 'You are approaching a plan limit. Consider upgrading to avoid service interruption.'}
                </p>
                <Link href="/payment" className="mt-2 inline-block">
                  <Button className="mt-2" size="sm">
                    Upgrade Plan
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {Object.keys(operationTypes).length > 0 && (
        <section className="overflow-hidden rounded-lg border border-border bg-background">
          <div className="border-b border-border px-6 py-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-base font-medium">Usage by type</h3>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Breakdown of events this month</p>
          </div>
          <div className="space-y-3 p-6">
            {Object.entries(operationTypes)
              .sort(([, a], [, b]) => Number(b) - Number(a))
              .map(([operationType, count]) => (
                <div key={operationType} className="flex items-center justify-between">
                  <span className="text-sm capitalize text-muted-foreground">
                    {operationType.replace(/_/g, ' ')}
                  </span>
                  <span className="text-sm font-medium">{Number(count).toLocaleString()}</span>
                </div>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}
