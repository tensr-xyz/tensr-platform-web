import {
  decodeRowUidBitset,
  netUnionReconciles,
  provenanceTraceKind,
  resolveCompleteCell,
} from './click-through';

const ORIGIN = ['u0', 'u1', 'u2', 'u3'];
const BITSET_U0_U2 = 'BQ==';

describe('banner cell click-through', () => {
  it('decodes a complete origin bitset', () => {
    expect(decodeRowUidBitset(BITSET_U0_U2, ORIGIN)).toEqual(['u0', 'u2']);
  });

  it('is complete only when miss_count is 0 and a bitset is present', () => {
    expect(
      provenanceTraceKind({
        row_uid_bitset: BITSET_U0_U2,
        row_uid_bitset_miss_count: 0,
      })
    ).toBe('complete');
    expect(
      provenanceTraceKind({
        row_uid_bitset: BITSET_U0_U2,
        row_uid_bitset_miss_count: 1,
      })
    ).toBe('unavailable');
    expect(provenanceTraceKind({ provenance_unavailable: 'unknown_row_uids' })).toBe('unavailable');
    expect(provenanceTraceKind({})).toBe('unknown');
  });

  it('refuses unknown and unavailable instead of a partial respondent list', () => {
    expect(resolveCompleteCell({ provenance: {} }, ORIGIN).kind).toBe('unknown');
    expect(
      resolveCompleteCell(
        { provenance: { row_uid_bitset: BITSET_U0_U2, row_uid_bitset_miss_count: 2 } },
        ORIGIN
      ).kind
    ).toBe('unavailable');
    const complete = resolveCompleteCell(
      {
        provenance: { row_uid_bitset: BITSET_U0_U2, row_uid_bitset_miss_count: 0, n_uids: 2 },
        unweighted_n: 2,
        kind: 'net',
      },
      ORIGIN
    );
    expect(complete).toEqual({
      kind: 'complete',
      uids: ['u0', 'u2'],
      n: 2,
    });
  });

  it('reconciles a net cell to the union count, not a sum', () => {
    const cell = {
      kind: 'net',
      unweighted_n: 2,
      provenance: { row_uid_bitset: BITSET_U0_U2, row_uid_bitset_miss_count: 0, n_uids: 2 },
    };
    expect(netUnionReconciles(cell, ORIGIN)).toBe(true);
    expect(netUnionReconciles({ ...cell, unweighted_n: 3 }, ORIGIN)).toBe(false);
  });
});
