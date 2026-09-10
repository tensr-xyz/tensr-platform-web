import { provenanceTraceState } from '@/lib/analysis-runs';

export const CONVENTION_TUPLE_KEYS = [
  'variance_mode',
  'test_type',
  'overlap_mode',
  'bessel_means',
  'bessel_proportions',
  'extra_deff',
] as const;

export function truncateFingerprint(fp: unknown, max = 16): string | null {
  if (typeof fp !== 'string' || !fp.trim()) return null;
  const s = fp.trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

export function weightVectorSummary(weight: unknown): string | null {
  if (weight == null) return null;
  if (typeof weight !== 'object') return String(weight);
  const w = weight as Record<string, unknown>;
  if (w.explicit_null === true) return 'explicit_null';
  const parts: string[] = [];
  if (typeof w.identity === 'string' && w.identity) parts.push(`identity=${w.identity}`);
  if (typeof w.method === 'string' && w.method) parts.push(`method=${w.method}`);
  if (typeof w.n === 'number') parts.push(`n=${w.n}`);
  if (!parts.length) {
    const keys = Object.keys(w);
    return keys.length ? `keys=${keys.slice(0, 4).join(',')}` : 'present';
  }
  return parts.join(', ');
}

export function formatProvenanceConventionMarkdown(
  provenance: Record<string, unknown> | null | undefined
): string | null {
  if (!provenance || typeof provenance !== 'object') return null;
  const lines: string[] = ['### Provenance / Convention'];
  const state = provenanceTraceState(provenance);
  lines.push(
    `- **Trace:** ${state.kind}${
      state.kind === 'unavailable' && state.reason ? ` (${state.reason})` : ''
    }`
  );
  const convention =
    provenance.convention && typeof provenance.convention === 'object'
      ? (provenance.convention as Record<string, unknown>)
      : null;
  if (convention) {
    for (const key of CONVENTION_TUPLE_KEYS) {
      if (convention[key] !== undefined) {
        lines.push(`- **${key}:** \`${String(convention[key])}\``);
      }
    }
  }
  const weight = weightVectorSummary(provenance.weight_vector);
  if (weight) lines.push(`- **weight_vector:** ${weight}`);
  const fp = truncateFingerprint(provenance.content_fingerprint, 24);
  if (fp) lines.push(`- **content_fingerprint:** \`${fp}\``);
  if (typeof provenance.origin_dataset_id === 'string' && provenance.origin_dataset_id.trim()) {
    lines.push(`- **origin_dataset_id:** \`${provenance.origin_dataset_id.trim()}\``);
  }
  return lines.join('\n');
}
