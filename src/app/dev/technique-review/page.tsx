'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AnalysisReportView } from '@/components/organisms/analysis-report-view';
import type { AnalysisReport } from '@/lib/analysis-report-types';

type Payload = {
  report: AnalysisReport;
  provenance?: Record<string, unknown> | null;
};

function TechniqueReview() {
  const key = useSearchParams().get('key');
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    fetch(`/technique-review/${key}.json`)
      .then(response => {
        if (!response.ok) throw new Error(`Report ${key} failed to load (${response.status})`);
        return response.json() as Promise<Payload>;
      })
      .then(body => {
        if (!cancelled) setPayload(body);
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load the report');
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  if (!key) return <p>Missing technique key.</p>;
  if (error) return <p>{error}</p>;
  if (!payload) return <p>Loading report</p>;

  return (
    <div data-testid="technique-review" className="min-h-screen bg-white text-zinc-900">
      <AnalysisReportView report={payload.report} provenance={payload.provenance} />
    </div>
  );
}

export default function TechniqueReviewPage() {
  return (
    <Suspense fallback={<p>Loading report</p>}>
      <TechniqueReview />
    </Suspense>
  );
}
