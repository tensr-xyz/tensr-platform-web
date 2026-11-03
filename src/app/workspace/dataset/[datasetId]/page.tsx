'use client';

import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { LegacyRedirect } from '@/components/flow/legacy-redirect';

function DatasetRedirect() {
  const params = useParams<{ datasetId: string }>();
  const search = useSearchParams();
  return (
    <LegacyRedirect
      target={{ kind: 'dataset', id: String(params.datasetId || ''), run: search.get('run') }}
    />
  );
}

/** Old workspace dataset links open the file's project; a run link opens it in Outputs. */
export default function DatasetWorkspaceRedirect() {
  return (
    <Suspense fallback={null}>
      <DatasetRedirect />
    </Suspense>
  );
}
