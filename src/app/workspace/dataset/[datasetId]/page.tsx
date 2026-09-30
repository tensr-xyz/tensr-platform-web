'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import Workspace, { WorkspaceResource } from '@/components/templates/workspace';
import { SubscriptionGate } from '@/components/templates/subscription-gate';
import Loading from '@/components/molecules/loading';
import { SessionRestore } from '@/components/molecules/session-restore';
import { openAnalysisRunById } from '@/lib/analysis-runs';

function DatasetWorkspaceContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const datasetId = params.datasetId as string;
  const displayName = searchParams.get('name')?.trim() || 'Dataset';
  const openedRun = useRef<string | null>(null);

  useEffect(() => {
    const runId = searchParams.get('run')?.trim();
    if (!runId || openedRun.current === runId) return;
    let cancelled = false;
    const attempt = async (remaining: number) => {
      if (cancelled) return;
      const opened = await openAnalysisRunById(runId);
      if (cancelled) return;
      if (opened) {
        openedRun.current = runId;
        return;
      }
      if (remaining <= 1) return;
      await new Promise(resolve => setTimeout(resolve, 400));
      await attempt(remaining - 1);
    };
    void attempt(5);
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const resource = useMemo<WorkspaceResource>(
    () => ({
      id: datasetId,
      name: displayName,
      path: datasetId,
      type: 'file',
    }),
    [datasetId, displayName]
  );

  return (
    <SubscriptionGate>
      <SessionRestore />
      {/* Remount on dataset change so loader refs / local state cannot leak across datasets */}
      <Workspace key={datasetId} resource={resource} />
    </SubscriptionGate>
  );
}

export default function DatasetWorkspacePage() {
  return (
    <Suspense fallback={<Loading fullScreen />}>
      <DatasetWorkspaceContent />
    </Suspense>
  );
}
