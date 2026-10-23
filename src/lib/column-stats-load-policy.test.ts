import {
  shouldClearAttemptOnPathChange,
  shouldClearAttemptOnShowStats,
  shouldKeepAttemptAfterFetchSettled,
  shouldLoadColumnStats,
} from '@/lib/column-stats-load-policy';

const ready = {
  hasPath: true,
  isProjectFile: false,
  hasUsableStats: false,
  isLoading: false,
  statsPanelOpen: true,
};

describe('column stats load policy', () => {
  it('does not load on dataset open', () => {
    expect(shouldLoadColumnStats({ ...ready, statsPanelOpen: false, attempted: false })).toBe(
      false
    );
  });

  it('loads once when the stats panel opens and the grid has no stats yet', () => {
    expect(shouldLoadColumnStats({ ...ready, attempted: false })).toBe(true);
  });

  it('does not refetch after analyze-file fails (retry storm)', () => {
    const attempted = shouldKeepAttemptAfterFetchSettled();
    expect(attempted).toBe(true);
    expect(shouldLoadColumnStats({ ...ready, attempted })).toBe(false);
  });

  it('opening the stats panel does not clear a failed attempt', () => {
    expect(shouldClearAttemptOnShowStats()).toBe(false);
  });

  it('a new file path may load again', () => {
    expect(shouldClearAttemptOnPathChange()).toBe(true);
    expect(shouldLoadColumnStats({ ...ready, attempted: false })).toBe(true);
  });
});
