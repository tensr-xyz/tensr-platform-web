'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useMemo } from 'react';
import Workspace, { WorkspaceResource } from '@/components/templates/workspace';
import { SubscriptionGate } from '@/components/templates/subscription-gate';
import Loading from '@/components/molecules/loading';

function DatasetWorkspaceContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const datasetId = params.datasetId as string;
  const displayName = searchParams.get('name')?.trim() || 'Dataset';

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
