'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Clock, Plus } from 'lucide-react';
import { Button } from '@/components/atoms/button';
import { Loader } from '@/components/molecules/loading';
import { apiClient } from '@/lib/api-client';
import { formatApiErrorMessage } from '@/lib/api-error';
import type { CreatorPluginSummary, PluginStatus } from '@/types/plugin';

function statusStyles(status: PluginStatus): string {
  switch (status) {
    case 'APPROVED':
      return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400';
    case 'REJECTED':
      return 'bg-red-500/10 text-red-700 dark:text-red-400';
    case 'PENDING':
    default:
      return 'bg-amber-500/10 text-amber-800 dark:text-amber-400';
  }
}

function statusCopy(status: PluginStatus): string {
  switch (status) {
    case 'APPROVED':
      return 'Live in the marketplace';
    case 'REJECTED':
      return 'Not approved — update and re-upload if needed';
    case 'PENDING':
    default:
      return 'Submitted — waiting for Tensr review';
  }
}

function PluginCard({ plugin }: { plugin: CreatorPluginSummary }) {
  return (
    <div className="flex flex-col gap-3 border-b border-border px-6 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium text-foreground">{plugin.name}</p>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusStyles(plugin.status)}`}
          >
            {plugin.status}
          </span>
          {plugin.isPaid ? (
            <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
              {plugin.pricing?.price != null ? `$${plugin.pricing.price}` : 'Paid'}
            </span>
          ) : (
            <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
              Free
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          <code className="text-[11px]">{plugin.pluginId}</code>
          {' · '}
          {statusCopy(plugin.status)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {plugin.status === 'APPROVED' ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/plugins/${plugin.pluginId}`}>View listing</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export default function MyPlugins() {
  const [plugins, setPlugins] = useState<CreatorPluginSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.creator.plugins();
      setPlugins(data);
    } catch (err) {
      setError(formatApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pending = useMemo(() => plugins.filter(p => p.status === 'PENDING'), [plugins]);
  const others = useMemo(() => plugins.filter(p => p.status !== 'PENDING'), [plugins]);

  if (loading) {
    return <Loader centered message="Loading your plugins…" />;
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10 sm:px-0">
      <div className="text-center">
        <h2 className="text-lg font-medium tracking-tight">My plugins</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Track uploads in review, approved listings, and rejections.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="outline" size="sm" asChild>
          <Link href="/plugins">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Marketplace
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => load()}>
            Refresh
          </Button>
          <Button type="button" size="sm" asChild>
            <Link href="/plugins/upload">
              <Plus className="mr-2 h-4 w-4" />
              Publish
            </Link>
          </Button>
        </div>
      </div>

      {error ? (
        <section className="overflow-hidden rounded-lg border border-border bg-background">
          <div className="border-b border-border px-6 py-4">
            <h3 className="text-base font-medium text-red-600">Couldn&apos;t load plugins</h3>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          </div>
          <div className="flex justify-end border-t border-border bg-muted/30 px-6 py-4">
            <Button variant="outline" size="sm" onClick={() => load()}>
              Try again
            </Button>
          </div>
        </section>
      ) : null}

      {!error && plugins.length === 0 ? (
        <section className="overflow-hidden rounded-lg border border-border bg-background">
          <div className="px-6 py-12 text-center">
            <Clock className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              You haven&apos;t uploaded any plugins yet.
            </p>
            <Button className="mt-4" variant="outline" asChild>
              <Link href="/plugins/upload">Upload your first plugin</Link>
            </Button>
          </div>
        </section>
      ) : null}

      {!error && pending.length > 0 ? (
        <section className="overflow-hidden rounded-lg border border-border bg-background">
          <div className="border-b border-border px-6 py-4">
            <h3 className="text-base font-medium">In review</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {pending.length} plugin{pending.length === 1 ? '' : 's'} waiting for Tensr approval
            </p>
          </div>
          <div>
            {pending.map(plugin => (
              <PluginCard key={plugin.pluginId} plugin={plugin} />
            ))}
          </div>
        </section>
      ) : null}

      {!error && others.length > 0 ? (
        <section className="overflow-hidden rounded-lg border border-border bg-background">
          <div className="border-b border-border px-6 py-4">
            <h3 className="text-base font-medium">Published & other</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Approved marketplace listings and rejected submissions
            </p>
          </div>
          <div>
            {others.map(plugin => (
              <PluginCard key={plugin.pluginId} plugin={plugin} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
