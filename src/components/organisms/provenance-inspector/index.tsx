'use client';

import {
  CONVENTION_TUPLE_KEYS,
  truncateFingerprint,
  weightVectorSummary,
} from '@/lib/provenance-inspector';
import { provenanceTraceState } from '@/lib/analysis-runs';

export { truncateFingerprint, weightVectorSummary } from '@/lib/provenance-inspector';

export function ProvenanceInspector({
  provenance,
}: {
  provenance?: Record<string, unknown> | null;
}) {
  if (!provenance || typeof provenance !== 'object') return null;

  const state = provenanceTraceState(provenance);
  const convention =
    provenance.convention && typeof provenance.convention === 'object'
      ? (provenance.convention as Record<string, unknown>)
      : null;
  const fingerprint = truncateFingerprint(provenance.content_fingerprint);
  const weight = weightVectorSummary(provenance.weight_vector);
  const origin =
    typeof provenance.origin_dataset_id === 'string' && provenance.origin_dataset_id.trim()
      ? provenance.origin_dataset_id.trim()
      : null;

  return (
    <div
      data-testid="provenance-inspector"
      className="border-b border-border/60 bg-muted/20 px-[22px] py-3"
    >
      <p className="text-xs font-medium text-foreground">Provenance</p>
      <dl className="mt-2 grid gap-1.5 text-[12px] leading-snug text-muted-foreground sm:grid-cols-[8.5rem_1fr]">
        <dt className="font-medium text-foreground/80">Trace</dt>
        <dd className="font-mono text-[11px]">
          {state.kind}
          {state.kind === 'unavailable' && state.reason ? ` (${state.reason})` : ''}
        </dd>

        {convention
          ? CONVENTION_TUPLE_KEYS.map(key =>
              convention[key] !== undefined ? (
                <div key={key} className="contents">
                  <dt className="font-medium text-foreground/80">{key}</dt>
                  <dd className="font-mono text-[11px]">{String(convention[key])}</dd>
                </div>
              ) : null
            )
          : null}

        {weight ? (
          <>
            <dt className="font-medium text-foreground/80">weight_vector</dt>
            <dd className="font-mono text-[11px]">{weight}</dd>
          </>
        ) : null}

        {fingerprint ? (
          <>
            <dt className="font-medium text-foreground/80">content_fingerprint</dt>
            <dd className="font-mono text-[11px]">{fingerprint}</dd>
          </>
        ) : null}

        {origin ? (
          <>
            <dt className="font-medium text-foreground/80">origin_dataset_id</dt>
            <dd className="font-mono text-[11px]">{origin}</dd>
          </>
        ) : null}
      </dl>
    </div>
  );
}
