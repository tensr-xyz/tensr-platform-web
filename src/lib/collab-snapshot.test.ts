import { parquetReadObjects } from 'hyparquet';
import { fetchSnapshotRows, jsonSafeCell } from './collab-snapshot';

// hyparquet ships ESM-only `exports`, which Jest's resolver cannot load.
jest.mock('hyparquet', () => ({ parquetReadObjects: jest.fn() }), { virtual: true });

describe('fetchSnapshotRows', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    }) as unknown as typeof fetch;
  });

  it('returns INT64 cells as numbers so ops carrying them can be sent', async () => {
    (parquetReadObjects as jest.Mock).mockResolvedValue([{ group: 'b', score: 8n }]);

    const rows = await fetchSnapshotRows('https://example.test/snapshot.parquet');

    expect(rows).toEqual([{ group: 'b', score: 8 }]);
    const op = { kind: 'update_cell', row: 7, column: 'score', oldValue: rows[0].score };
    expect(JSON.stringify(op)).toContain('"oldValue":8');
  });
});

describe('jsonSafeCell', () => {
  it('keeps integers beyond the safe range exact as strings', () => {
    expect(jsonSafeCell(9007199254740993n)).toBe('9007199254740993');
  });

  it('leaves other values alone', () => {
    expect(jsonSafeCell(2.5)).toBe(2.5);
    expect(jsonSafeCell('a')).toBe('a');
    expect(jsonSafeCell(null)).toBeNull();
  });
});
