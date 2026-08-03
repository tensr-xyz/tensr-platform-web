'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/atoms/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/card';
import { Textarea } from '@/components/atoms/text-area';
import { Label } from '@/components/atoms/label';
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
    return (
      <div className="flex justify-center p-12">
        <Loader size="md" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Plugin review queue</h1>
        <p className="text-sm text-muted-foreground mt-1">
          PENDING plugins awaiting manual approval. Network-capable manifests are rejected at upload
          — only offline plugins reach this queue.
        </p>
      </div>

      {error && <div className="text-sm text-red-500">{error}</div>}

      {!items.length && !error && (
        <p className="text-muted-foreground">No plugins awaiting review.</p>
      )}

      {items.map(plugin => (
        <Card key={`${plugin.pluginId}-${plugin.version}`}>
          <CardHeader>
            <CardTitle className="text-lg">
              {plugin.name}{' '}
              <span className="text-sm font-normal text-muted-foreground">
                v{plugin.version} · {plugin.pluginId}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>{plugin.description}</p>
            <div className="grid grid-cols-2 gap-2 text-muted-foreground">
              <div>Author: {plugin.authorId}</div>
              <div>Entry: {plugin.entryPoint}</div>
              <div>Filesystem: {plugin.capabilities?.filesystem || 'none'}</div>
              <div>Memory: {plugin.capabilities?.maxMemoryMb ?? '—'} MB</div>
              <div>Timeout: {plugin.capabilities?.maxExecutionSeconds ?? '—'}s</div>
              <div>Data access: {(plugin.capabilities?.dataAccess || []).join(', ') || '—'}</div>
            </div>
            {plugin.scanResults && (
              <div className="rounded-md border p-3 space-y-1">
                <div className="font-medium">
                  Scan: {plugin.scanResults.passed ? 'passed' : 'findings'} (
                  {plugin.scanResults.scanType})
                </div>
                {(plugin.scanResults.findings || []).map((f, i) => (
                  <div key={i} className="text-amber-700 dark:text-amber-400">
                    {f}
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor={`notes-${plugin.pluginId}`}>Review notes</Label>
              <Textarea
                id={`notes-${plugin.pluginId}`}
                value={notes[plugin.pluginId] || ''}
                onChange={e => setNotes(prev => ({ ...prev, [plugin.pluginId]: e.target.value }))}
              />
            </div>
            <div className="flex gap-2">
              <Button
                disabled={busyId === plugin.pluginId}
                onClick={() => review(plugin.pluginId, 'APPROVED')}
              >
                Approve
              </Button>
              <Button
                variant="destructive"
                disabled={busyId === plugin.pluginId}
                onClick={() => review(plugin.pluginId, 'REJECTED')}
              >
                Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
