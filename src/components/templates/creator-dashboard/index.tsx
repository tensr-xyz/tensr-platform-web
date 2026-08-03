'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Plus,
  DollarSign,
  Download,
  Users,
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/card';
import { Button } from '@/components/atoms/button';
import { Badge } from '@/components/atoms/badge';
import { Loader } from '@/components/molecules/loading';
import { apiClient } from '@/lib/api-client';
import { formatApiErrorMessage } from '@/lib/api-error';
import type { CreatorPluginSummary, CreatorStats } from '@/types/plugin';

function formatUsd(amount: number): string {
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
        </div>
        <Icon className="h-8 w-8 text-muted-foreground/40" />
      </CardContent>
    </Card>
  );
}

function StripeConnectCard({
  stats,
  onConnect,
  connecting,
}: {
  stats: CreatorStats;
  onConnect: () => void;
  connecting: boolean;
}) {
  if (!stats.stripeConfigured) {
    return (
      <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            Payouts not configured
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This Tensr deployment hasn&apos;t configured Stripe yet, so paid plugin checkout and
            creator payouts aren&apos;t available. Free plugins work normally. Ask your
            administrator to set <code className="text-xs">STRIPE_SECRET_KEY</code> on tensr-api to
            enable payouts.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (stats.stripeConnected) {
    return (
      <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20">
        <CardContent className="flex items-center gap-3 p-5">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          <div>
            <p className="text-sm font-medium">Payouts connected</p>
            <p className="text-xs text-muted-foreground">
              Stripe Connect is set up. Paid plugin sales are transferred to your account
              automatically, minus a 10% platform fee.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <DollarSign className="h-4 w-4" />
          Get paid for your plugins
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">
          {stats.stripeConnectStatus === 'pending'
            ? "You've started Stripe onboarding but haven't finished it yet. Continue to enable paid plugin checkout."
            : 'Connect a Stripe account to sell paid plugins. Tensr takes a 10% platform fee; the rest is transferred to you automatically.'}
        </p>
        <Button onClick={onConnect} disabled={connecting}>
          {connecting ? (
            <Loader size="sm" className="mr-2" />
          ) : (
            <ExternalLink className="mr-2 h-4 w-4" />
          )}
          {stats.stripeConnectStatus === 'pending' ? 'Continue Stripe setup' : 'Connect Stripe'}
        </Button>
      </CardContent>
    </Card>
  );
}

function PluginRow({ plugin }: { plugin: CreatorPluginSummary }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link
            href={`/plugins/${plugin.pluginId}`}
            className="truncate text-sm font-medium hover:underline"
          >
            {plugin.name}
          </Link>
          <Badge
            variant={plugin.status === 'APPROVED' ? 'default' : 'secondary'}
            className="text-[10px]"
          >
            {plugin.status}
          </Badge>
          {plugin.isPaid ? (
            <Badge variant="outline" className="text-[10px]">
              {plugin.pricing?.price != null ? `$${plugin.pricing.price}` : 'Paid'}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] text-emerald-600">
              Free
            </Badge>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Updated {new Date(plugin.lastUpdated).toLocaleDateString()}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-6 text-sm">
        <div className="text-right">
          <div className="font-mono tabular-nums">{plugin.downloads}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Sales</div>
        </div>
        <div className="text-right">
          <div className="font-mono tabular-nums">{formatUsd(plugin.revenue)}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Revenue</div>
        </div>
      </div>
    </div>
  );
}

export default function CreatorDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [stats, setStats] = useState<CreatorStats | null>(null);
  const [plugins, setPlugins] = useState<CreatorPluginSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const [statsData, pluginsData] = await Promise.all([
        apiClient.creator.stats(),
        apiClient.creator.plugins(),
      ]);
      setStats(statsData);
      setPlugins(pluginsData);
    } catch (err) {
      setError(formatApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Returning from Stripe Connect onboarding — re-check status so the CTA updates.
  useEffect(() => {
    if (searchParams.get('connect')) {
      fetchData();
      router.replace('/creator');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleConnect = async () => {
    setConnecting(true);
    setConnectError(null);
    try {
      const res = await apiClient.creator.connectOnboarding('/creator');
      window.location.href = res.url;
    } catch (err) {
      setConnectError(formatApiErrorMessage(err));
      setConnecting(false);
    }
  };

  if (loading) {
    return <Loader fullScreen />;
  }

  if (error || !stats) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <AlertTriangle className="mx-auto mb-4 h-8 w-8 text-amber-600" />
        <h1 className="text-lg font-medium">Couldn&apos;t load your creator dashboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        <Button className="mt-6" variant="outline" onClick={fetchData}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Creator dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your plugins, track sales, and set up payouts.
          </p>
        </div>
        <Button asChild>
          <Link href="/plugins/upload">
            <Plus className="mr-2 h-4 w-4" />
            Upload plugin
          </Link>
        </Button>
      </div>

      {connectError ? (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
          {connectError}
        </div>
      ) : null}

      <div className="mb-6">
        <StripeConnectCard stats={stats} onConnect={handleConnect} connecting={connecting} />
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Plugins" value={String(stats.totalPlugins)} icon={TrendingUp} />
        <StatCard label="Sales" value={String(stats.totalDownloads)} icon={Download} />
        <StatCard label="Total revenue" value={formatUsd(stats.totalRevenue)} icon={DollarSign} />
        <StatCard label="Last 30 days" value={formatUsd(stats.monthlyRevenue)} icon={Users} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">My plugins</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {plugins.length === 0 ? (
            <div className="p-8 text-center">
              <Clock className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                You haven&apos;t published any plugins yet.
              </p>
              <Button className="mt-4" variant="outline" asChild>
                <Link href="/plugins/upload">Upload your first plugin</Link>
              </Button>
            </div>
          ) : (
            plugins.map(plugin => <PluginRow key={plugin.pluginId} plugin={plugin} />)
          )}
        </CardContent>
      </Card>
    </div>
  );
}
