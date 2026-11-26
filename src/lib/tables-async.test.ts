import { isPendingTablePayload, resolveTablePayload } from '@/lib/tables-async';

jest.mock('@/lib/analysis-runs', () => ({
  waitForAnalysisRun: jest.fn(),
}));

import { waitForAnalysisRun } from '@/lib/analysis-runs';

const wait = waitForAnalysisRun as jest.Mock;

describe('tables-async (TEN-274)', () => {
  beforeEach(() => {
    wait.mockReset();
  });

  it.each([
    [{ status: 'pending', run_id: 'r1' }, true],
    [{ status: 'Pending', run_id: 'abc' }, true],
    [{ ok: true, rows: [] }, false],
    [{ status: 'pending' }, false],
    [{ status: 'complete', run_id: 'r1' }, false],
    [null, false],
  ])('isPendingTablePayload(%j) → %s', (body, expected) => {
    expect(isPendingTablePayload(body as never)).toBe(expected);
  });

  it('passes through a finished book without polling', async () => {
    const book = { ok: true, rows: [{ id: 'a' }] };
    await expect(resolveTablePayload(book)).resolves.toEqual(book);
    expect(wait).not.toHaveBeenCalled();
  });

  it('polls a pending run and returns the worker book', async () => {
    wait.mockResolvedValue({
      id: 'run-9',
      status: 'complete',
      result: { ok: true, rows: [{ id: 'row-1', cells: [{ column_percent: 12 }] }] },
    });
    const out = await resolveTablePayload({ status: 'pending', run_id: 'run-9' });
    expect(wait).toHaveBeenCalledWith('run-9', expect.any(Object));
    expect(out.rows).toHaveLength(1);
  });

  it('throws when the worker marks the run failed', async () => {
    wait.mockResolvedValue({ id: 'run-9', status: 'failed', result: {} });
    await expect(resolveTablePayload({ status: 'pending', run_id: 'run-9' })).rejects.toThrow(
      /could not build/i
    );
  });

  it('throws when the poll ends still pending', async () => {
    wait.mockResolvedValue({ id: 'run-9', status: 'pending', result: {} });
    await expect(resolveTablePayload({ status: 'pending', run_id: 'run-9' })).rejects.toThrow(
      /still building/i
    );
  });
});
