export type TraceKind = 'complete' | 'unavailable' | 'unknown';

export type CellProvenance = {
  row_uid_bitset?: string;
  row_uid_bitset_miss_count?: number;
  provenance_unavailable?: string;
  n_uids?: number;
  origin_dataset_id?: string;
};

export type ClickableCell = {
  kind?: string;
  unweighted_n?: number | null;
  provenance?: CellProvenance;
};

export type CellClickResult =
  | { kind: 'complete'; uids: string[]; n: number }
  | { kind: 'unavailable'; reason: string }
  | { kind: 'unknown'; reason: string };

export function decodeRowUidBitset(encoded: string, originUids: string[]): string[] {
  const binary =
    typeof atob === 'function' ? atob(encoded) : Buffer.from(encoded, 'base64').toString('binary');
  const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
  const out: string[] = [];
  for (let i = 0; i < originUids.length; i += 1) {
    const byte = bytes[Math.floor(i / 8)] ?? 0;
    if (byte & (1 << (i % 8))) out.push(originUids[i]);
  }
  return out;
}

export function provenanceTraceKind(provenance: CellProvenance | undefined | null): TraceKind {
  if (!provenance || typeof provenance !== 'object') return 'unknown';
  if (
    typeof provenance.provenance_unavailable === 'string' &&
    provenance.provenance_unavailable.trim()
  ) {
    return 'unavailable';
  }
  const miss = provenance.row_uid_bitset_miss_count;
  const bitset = provenance.row_uid_bitset;
  if (typeof miss === 'number' && miss > 0) return 'unavailable';
  if (typeof bitset === 'string' && bitset && (miss == null || miss === 0)) return 'complete';
  return 'unknown';
}

export function resolveCompleteCell(cell: ClickableCell, originUids: string[]): CellClickResult {
  const kind = provenanceTraceKind(cell.provenance);
  if (kind === 'unavailable') {
    return {
      kind,
      reason: cell.provenance?.provenance_unavailable || 'unknown_row_uids',
    };
  }
  if (kind !== 'complete' || !cell.provenance?.row_uid_bitset) {
    return { kind: 'unknown', reason: 'provenance unknown' };
  }
  const uids = decodeRowUidBitset(cell.provenance.row_uid_bitset, originUids);
  return { kind: 'complete', uids, n: uids.length };
}

export function netUnionReconciles(cell: ClickableCell, originUids: string[]): boolean {
  const resolved = resolveCompleteCell(cell, originUids);
  if (resolved.kind !== 'complete') return false;
  const unique = new Set(resolved.uids);
  const declared = cell.unweighted_n;
  const nUids = cell.provenance?.n_uids;
  return (
    unique.size === resolved.n &&
    (declared == null || declared === unique.size) &&
    (nUids == null || nUids === unique.size)
  );
}
