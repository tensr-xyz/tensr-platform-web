'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LoaderCircle, BarChart3 } from 'lucide-react';
import { ANALYSIS_LABELS, type AnalysisKey } from '@/lib/analysis-definitions';
import {
  formatRunLabel,
  formatRunTime,
  listDatasetAnalysisRuns,
  openAnalysisRunById,
  type AnalysisRunSummary,
} from '@/lib/analysis-runs';
import { runWhenIdle } from '@/lib/dataset-open';
import { useSession, wsService } from '@/hooks/ui/use-session';
import { Button } from '@/components/atoms/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/atoms/empty';
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
  const { currentSession } = useSession();
  const [runs, setRuns] = useState<AnalysisRunSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const knownRunIdsRef = useRef<Set<string>>(new Set());
  const localEntriesRef = useRef(localEntries);
  localEntriesRef.current = localEntries;
  const liveSession =
    !!currentSession &&
    !!datasetId &&
    (currentSession.datasetId === datasetId || !currentSession.datasetId);

  const load = useCallback(
    async (opts?: { silent?: boolean; autoOpenRemote?: boolean; fresh?: boolean }) => {
      if (!datasetId) {
        setRuns([]);
        return;
      }
      if (!opts?.silent) {
        setLoading(true);
      }
      setError(null);
      try {
        const next = await listDatasetAnalysisRuns(datasetId, { fresh: opts?.fresh });
        if (opts?.autoOpenRemote && knownRunIdsRef.current.size > 0) {
          const newest = next[0];
          if (
            newest &&
            !knownRunIdsRef.current.has(newest.id) &&
            !localEntriesRef.current.some(e => e.runId === newest.id)
          ) {
            void openAnalysisRunById(newest.id);
          }
        }
        knownRunIdsRef.current = new Set(next.map(r => r.id));
        setRuns(next);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load saved analyses');
        setRuns([]);
      } finally {
        if (!opts?.silent) {
          setLoading(false);
        }
      }
    },
    [datasetId]
  );

  useEffect(() => {
    return runWhenIdle(() => {
      void load();
    });
  }, [load]);

  const localRunKey = localEntries
    .map(entry => entry.runId)
    .filter((id): id is string => Boolean(id))
    .join(',');
  useEffect(() => {
    if (!datasetId || !localRunKey) return;
    void load({ silent: true, fresh: true });
  }, [datasetId, localRunKey, load]);

  // Live collab: peers push `analysis_run_created` over WS — no REST polling.
  useEffect(() => {
    if (!liveSession || !datasetId) return;
    return wsService.onAnalysisRunCreated(event => {
      if (event.datasetId !== datasetId) return;
      void load({ silent: true, autoOpenRemote: true, fresh: true });
    });
  }, [liveSession, datasetId, load]);

  const openRun = async (runId: string) => {
    setOpeningId(runId);
    try {
      const ok = await openAnalysisRunById(runId);
      if (!ok) setError('Saved analysis not found');
    } finally {
      setOpeningId(null);
    }
  };

  const serverIds = new Set(runs.map(r => r.id));
  const localOnly = localEntries.filter(e => e.runId && !serverIds.has(e.runId));
  const listed = [
    ...runs.map(run => ({
      key: run.id,
      runId: run.id,
      title: formatRunLabel(run),
      createdAt: run.created_at,
    })),
    ...localOnly.map(entry => ({
      key: entry.id,
      runId: entry.runId as string,
      title:
        (entry.subtitle &&
        entry.subtitle.replace(/_/g, ' ').toLowerCase() !== entry.analysisType.replace(/_/g, ' ').toLowerCase()
          ? entry.subtitle
          : ANALYSIS_LABELS[entry.analysisType as AnalysisKey]) ||
        entry.analysisType.replace(/_/g, ' '),
      createdAt: entry.createdAt,
    })),
  ].sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  if (!datasetId && localEntries.length === 0) return null;

  return (
    <div className="border-t border-border px-2 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Saved analyses
        </p>
        {datasetId ? (
          <Button
            size="compact"
            type="button"
            variant="ghost"
            onClick={() => void load()}
            className="h-auto px-1 text-[10px] text-muted-foreground hover:text-foreground"
          >
            Refresh
          </Button>
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
        {listed.map(row => (
          <Button
            size="compact"
            key={row.key}
            type="button"
            variant="ghost"
            disabled={openingId === row.runId}
            onClick={() => openRun(row.runId)}
            className={cn(
              'h-auto w-full flex-col items-start gap-0.5 rounded-sm px-2 py-1.5 text-left text-xs font-normal',
              'hover:bg-muted/50 text-foreground',
              openingId === row.runId && 'opacity-60'
            )}
          >
            <span className="inline-flex items-center gap-1.5 font-medium">
              <BarChart3 className="size-3 shrink-0 text-primary" aria-hidden />
              <span className="truncate">{row.title}</span>
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">
              {formatRunTime(row.createdAt)}
            </span>
          </Button>
        ))}

        {!loading && runs.length === 0 && localOnly.length === 0 ? (
          <Empty className="min-h-0 border-0 p-4 md:p-4">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BarChart3 />
              </EmptyMedia>
              <EmptyTitle className="text-sm">No saved analyses</EmptyTitle>
              <EmptyDescription className="text-[11px]">
                Run an analysis with ⌘K. Results are saved on the server and listed here.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}
      </div>
    </div>
  );
}
