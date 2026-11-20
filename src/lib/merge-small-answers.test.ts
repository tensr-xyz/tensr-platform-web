import {
  DEFAULT_MERGE_SMALL_MAX_PCT,
  formatMergeSmallPct,
  mergeSmallConfirmLabel,
  mergeSmallPreviewRows,
  mergeSmallRowDetail,
  mergeSmallThresholdOptions,
  parseMergeSmallMaxPct,
  type MergeSmallPreview,
} from './merge-small-answers';

describe('merge small answers helpers', () => {
  it('lists Displayr-style thresholds and formats row copy', () => {
    expect(mergeSmallThresholdOptions().map(item => item.label)).toEqual([
      '0.5%',
      '1%',
      '2%',
      '3%',
      '4%',
      '5%',
    ]);
    expect(formatMergeSmallPct(14.2)).toBe('14.2%');
    expect(formatMergeSmallPct(3)).toBe('3%');
    expect(mergeSmallRowDetail({ pct: 14.2, action: 'stay' }, 'Other')).toBe('14.2% · stays');
    expect(mergeSmallRowDetail({ pct: 2.1, action: 'merge' }, 'Other supermarket')).toBe(
      '2.1% → Other supermarket'
    );
    expect(mergeSmallConfirmLabel(3)).toBe('Merge 3 answers');
    expect(mergeSmallConfirmLabel(1)).toBe('Merge 1 answer');
    expect(parseMergeSmallMaxPct('3')).toBe(3);
    expect(parseMergeSmallMaxPct('7')).toBe(DEFAULT_MERGE_SMALL_MAX_PCT);
  });

  it('prefers categories with stay/merge actions from the preview', () => {
    const preview: MergeSmallPreview = {
      column: 'brand',
      max_pct: 3,
      combined_label: 'Other',
      base_n: 100,
      categories: [
        { value: 'A', label: 'Aldi', n: 70, pct: 70, action: 'stay' },
        { value: 'W', label: 'Waitrose', n: 2, pct: 2.1, action: 'merge' },
      ],
      small_categories: [{ value: 'W', label: 'Waitrose', n: 2, pct: 2.1 }],
      mappings: [{ from: ['W'], to: 'Other', to_label: 'Other' }],
    };
    const rows = mergeSmallPreviewRows(preview);
    expect(rows).toHaveLength(2);
    expect(rows[0].action).toBe('stay');
    expect(rows[1].action).toBe('merge');
    expect(mergeSmallPreviewRows(null)).toEqual([]);
  });
});
