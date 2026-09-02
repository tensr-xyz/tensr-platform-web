/** Map the Compute Variable dialog onto POST /datasets/{id}/compute. */

export type ComputeKind = 'formula' | 'row_mean' | 'reverse_score';

export type ComputeTransform = {
  kind: ComputeKind;
  target: string;
  source?: string;
  sources?: string[];
  subtract_from?: number;
  expr?: string;
};

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function isComputeIdentifier(name: string): boolean {
  return IDENT.test(name);
}

export function buildComputeBody(args: {
  target: string;
  kind: ComputeKind;
  expr?: string;
  sources?: string[];
  source?: string;
  subtractFrom?: number;
}): { transforms: ComputeTransform[] } | { error: string } {
  const target = args.target.trim();
  if (!target) return { error: 'Enter a name for the new variable' };
  if (!isComputeIdentifier(target)) {
    return {
      error:
        'New variable name must start with a letter or underscore and contain only letters, digits, or underscores',
    };
  }

  if (args.kind === 'formula') {
    const expr = (args.expr ?? '').trim();
    if (!expr) return { error: 'Enter a formula using column names and + - * /' };
    return { transforms: [{ kind: 'formula', target, expr }] };
  }

  if (args.kind === 'row_mean') {
    const sources = (args.sources ?? []).map(s => s.trim()).filter(Boolean);
    if (!sources.length) return { error: 'Select at least one column for the row mean' };
    return { transforms: [{ kind: 'row_mean', target, sources }] };
  }

  const source = (args.source ?? '').trim();
  if (!source) return { error: 'Select a source column to reverse-score' };
  const transform: ComputeTransform = { kind: 'reverse_score', target, source };
  if (args.subtractFrom != null && Number.isFinite(args.subtractFrom)) {
    transform.subtract_from = args.subtractFrom;
  }
  return { transforms: [transform] };
}
