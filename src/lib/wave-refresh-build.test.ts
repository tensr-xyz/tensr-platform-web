import { waveRefreshCanBuild, waveRefreshSpecIds } from './wave-refresh-build';

describe('waveRefreshSpecIds', () => {
  it('merges live and stale ids without duplicates', () => {
    expect(
      waveRefreshSpecIds([{ id: 'a' }, { id: 'b' }], [{ id: 'b' }, { id: 'c' }, { id: '' }])
    ).toEqual(['a', 'b', 'c']);
  });

  it('keeps only stale when live open failed', () => {
    expect(waveRefreshSpecIds([], [{ id: 'stale-1' }, { id: 'stale-2' }])).toEqual([
      'stale-1',
      'stale-2',
    ]);
  });

  it('returns empty when nothing is saved', () => {
    expect(waveRefreshSpecIds([], [])).toEqual([]);
    expect(waveRefreshCanBuild({ deckId: '', specIds: [] })).toBe(false);
    expect(waveRefreshCanBuild({ deckId: 'deck-1', specIds: [] })).toBe(true);
    expect(waveRefreshCanBuild({ deckId: '', specIds: ['t1'] })).toBe(true);
  });
});
