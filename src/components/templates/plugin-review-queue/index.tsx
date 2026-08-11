'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/atoms/button';
import { Textarea } from '@/components/atoms/text-area';
import { Loader } from '@/components/molecules/loading';
import { apiClient } from '@/lib/api-client';
import type { PluginRecord } from '@/types/plugin';

export default function PluginReviewQueue() {
  const [items, setItems] = useState<PluginRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.plugins.reviewQueue();
      setItems(res.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load review queue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const review = async (pluginId: string, status: 'APPROVED' | 'REJECTED') => {
    setBusyId(pluginId);
    try {
      await apiClient.plugins.review(pluginId, {
        status,
        notes: notes[pluginId],
      });
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Review failed');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <Loader centered message="Loading review queue…" />;
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10 sm:px-0">
      <div className="text-center">
        <h2 className="text-lg font-medium tracking-tight">Plugins in review</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Admin only. PENDING uploads awaiting approval. You cannot approve or reject your own
          plugin — use My plugins for your upload status.
        </p>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="outline" size="sm" asChild>
          <Link href="/plugins">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Marketplace
          </Link>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => load()}
          disabled={!!busyId}
        >
          Refresh
        </Button>
      </div>

      {error ? (
        <section className="overflow-hidden rounded-lg border border-border bg-background">
          <div className="border-b border-border px-6 py-4">
            <h3 className="text-base font-medium text-red-600">Could not load queue</h3>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          </div>
          <div className="space-y-2 px-6 py-4 text-sm text-muted-foreground">
            <p>
              Review requires plugin admin access (
              <code className="text-xs">PLUGIN_ADMIN_EMAILS</code> or{' '}
              <code className="text-xs">PLUGIN_ADMIN_USER_IDS</code> on the plugins Lambda).
            </p>
          </div>
        </section>
      ) : null}

      {!error && items.length === 0 ? (
        <section className="overflow-hidden rounded-lg border border-border bg-background">
          <div className="px-6 py-10 text-center text-sm text-muted-foreground">
            No plugins awaiting review.
          </div>
        </section>
      ) : null}

      {items.map(plugin => (
        <section
          key={`${plugin.pluginId}-${plugin.version}`}
          className="overflow-hidden rounded-lg border border-border bg-background"
        >
          <div className="border-b border-border px-6 py-4">
            <h3 className="text-base font-medium">{plugin.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              v{plugin.version} · <code className="text-xs">{plugin.pluginId}</code> · PENDING
            </p>
          </div>
          <div className="space-y-4 p-6 text-sm">
            <p className="text-muted-foreground">{plugin.description}</p>
            <div className="grid grid-cols-1 gap-2 text-muted-foreground sm:grid-cols-2">
              <div>
                <span className="font-medium text-foreground">Author:</span> {plugin.authorId}
              </div>
              <div>
                <span className="font-medium text-foreground">Entry:</span> {plugin.entryPoint}
              </div>
              <div>
                <span className="font-medium text-foreground">Filesystem:</span>{' '}
                {plugin.capabilities?.filesystem || 'none'}
              </div>
              <div>
                <span className="font-medium text-foreground">Memory:</span>{' '}
                {plugin.capabilities?.maxMemoryMb ?? '—'} MB
              </div>
              <div>
                <span className="font-medium text-foreground">Timeout:</span>{' '}
                {plugin.capabilities?.maxExecutionSeconds ?? '—'}s
              </div>
              <div>
                <span className="font-medium text-foreground">Data access:</span>{' '}
                {(plugin.capabilities?.dataAccess || []).join(', ') || '—'}
              </div>
            </div>
            {plugin.scanResults ? (
              <div className="rounded-md border border-border bg-muted/30 px-4 py-3">
                <p className="text-sm font-medium">
                  Scan: {plugin.scanResults.passed ? 'passed' : 'findings'} (
                  {plugin.scanResults.scanType})
                </p>
                {(plugin.scanResults.findings || []).map((f, i) => (
                  <p key={i} className="mt-1 text-sm text-amber-700 dark:text-amber-400">
                    {f}
                  </p>
                ))}
              </div>
            ) : null}
            <div>
              <label
                htmlFor={`notes-${plugin.pluginId}`}
                className="mb-1 block text-sm font-medium text-muted-foreground"
              >
                Review notes
              </label>
              <Textarea
                id={`notes-${plugin.pluginId}`}
                value={notes[plugin.pluginId] || ''}
                onChange={e => setNotes(prev => ({ ...prev, [plugin.pluginId]: e.target.value }))}
                disabled={busyId === plugin.pluginId}
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-border bg-muted/30 px-6 py-4">
            <Button
              variant="destructive"
              disabled={busyId === plugin.pluginId}
              onClick={() => review(plugin.pluginId, 'REJECTED')}
            >
              Reject
            </Button>
            <Button
              disabled={busyId === plugin.pluginId}
              onClick={() => review(plugin.pluginId, 'APPROVED')}
            >
              Approve
            </Button>
          </div>
        </section>
      ))}
    </div>
  );
}
