'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { LoaderCircle, BarChart3 } from 'lucide-react';
import {
  formatRunLabel,
  formatRunTime,
  listDatasetAnalysisRuns,
  openAnalysisRunById,
  openStoredAnalysisRun,
  type StoredAnalysisRun,
} from '@/lib/analysis-runs';
import { cn } from '@/utils';

type Props = {
  datasetId?: string;
  /** In-session entries from the spreadsheet tab (may include runId). */
  localEntries?: {
    id: string;
    runId?: string;
    analysisType: string;
    subtitle?: string;
    createdAt: string;
  }[];
};

export function DatasetAnalysisRuns({ datasetId, localEntries = [] }: Props) {
  const [runs, setRuns] = useState<StoredAnalysisRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!datasetId) {
      setRuns([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setRuns(await listDatasetAnalysisRuns(datasetId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load saved analyses');
      setRuns([]);
    } finally {
      setLoading(false);
    }
  }, [datasetId]);

  useEffect(() => {
    load();
  }, [load]);

  const openRun = async (runId: string, cached?: StoredAnalysisRun) => {
    setOpeningId(runId);
    try {
      if (cached) {
        openStoredAnalysisRun(cached);
      } else {
        const ok = await openAnalysisRunById(runId);
        if (!ok) setError('Saved analysis not found');
      }
    } finally {
      setOpeningId(null);
    }
  };

  const serverIds = new Set(runs.map(r => r.id));
  const localOnly = localEntries.filter(e => e.runId && !serverIds.has(e.runId));

  if (!datasetId && localEntries.length === 0) return null;

  return (
    <div className="border-t border-border px-2 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Saved analyses
        </p>
        {datasetId ? (
          <button
            type="button"
            onClick={load}
            className="text-[10px] text-muted-foreground hover:text-foreground"
          >
            Refresh
          </button>
        ) : null}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-2 text-[11px] text-muted-foreground">
          <LoaderCircle className="size-3 animate-spin" aria-hidden />
          Loading…
        </div>
      ) : null}

      {error ? <p className="text-[11px] text-destructive">{error}</p> : null}

      <div className="flex flex-col gap-0.5">
        {runs.map(run => (
          <button
            key={run.id}
            type="button"
            disabled={openingId === run.id}
            onClick={() => openRun(run.id, run)}
            className={cn(
              'flex w-full flex-col gap-0.5 rounded-sm px-2 py-1.5 text-left text-xs transition-colors',
              'hover:bg-muted/50 text-foreground',
              openingId === run.id && 'opacity-60'
            )}
          >
            <span className="inline-flex items-center gap-1.5 font-medium">
              <BarChart3 className="size-3 shrink-0 text-primary" aria-hidden />
              <span className="truncate">{formatRunLabel(run)}</span>
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">
              {formatRunTime(run.created_at)}
            </span>
          </button>
        ))}

        {localOnly.map(entry => (
          <button
            key={entry.id}
            type="button"
            disabled={openingId === entry.runId}
            onClick={() => entry.runId && openRun(entry.runId)}
            className="flex w-full flex-col gap-0.5 rounded-sm px-2 py-1.5 text-left text-xs hover:bg-muted/50"
          >
            <span className="truncate font-medium">{entry.analysisType.replace(/_/g, ' ')}</span>
            {entry.subtitle ? (
              <span className="truncate text-[10px] text-muted-foreground">{entry.subtitle}</span>
            ) : null}
          </button>
        ))}

        {!loading && runs.length === 0 && localOnly.length === 0 ? (
          <p className="py-1 text-[11px] leading-relaxed text-muted-foreground">
            Run an analysis with ⌘K. Results are saved on the server and listed here.
          </p>
        ) : null}
      </div>
    </div>
  );
}
