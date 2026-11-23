import {
  DEFAULT_TIDY_CRITERIA,
  reasonRowLabel,
  tidyConfirmLabel,
  tidyCriteriaBody,
  tidyModeLabel,
  tidyNeedsRebuildCount,
  tidyNeedsRebuildNote,
  tidyReasonRows,
  tidyScanBody,
} from './tidy-tables';

describe('tidy tables helpers', () => {
  it('builds Paper 9b criterion labels and confirm copy', () => {
    expect(reasonRowLabel('not_significant')).toBe('No significant differences at 95%');
    expect(reasonRowLabel('small_base')).toBe('Every column base under 50');
    expect(reasonRowLabel('broken')).toBe('Broken (a source question was removed)');
    expect(reasonRowLabel('needs_rebuild')).toBe('Need a rebuild first');
    expect(tidyModeLabel('park', 25)).toBe('Park 25 tables');
    expect(tidyModeLabel('delete', 1)).toBe('Delete 1 table');
    expect(tidyModeLabel('hide', 0)).toBe('Hide 0 tables');
  });

  it('posts scan_saved dry-run and apply bodies with criteria', () => {
    expect(JSON.parse(tidyScanBody(DEFAULT_TIDY_CRITERIA, true))).toEqual({
      scan_saved: true,
      dry_run: true,
      apply_to_report: true,
      criteria: tidyCriteriaBody(DEFAULT_TIDY_CRITERIA),
    });
    expect(tidyCriteriaBody({ ...DEFAULT_TIDY_CRITERIA, mode: 'delete' })).toMatchObject({
      mode: 'delete',
      alpha: 0.05,
      min_base: 50,
      delete_if_broken: true,
      delete_if_not_significant: true,
    });
  });

  it('prefers API reason rows and confirm labels', () => {
    const rows = tidyReasonRows({
      reason_counts: { not_significant: 19, small_base: 4, broken: 2, needs_rebuild: 4 },
      reason_rows: [
        { reason: 'not_significant', count: 19, label: 'No significant differences at 95%' },
        { reason: 'small_base', count: 4, label: 'Every column base under 50' },
        { reason: 'broken', count: 2, label: 'Broken (a source question was removed)' },
        { reason: 'needs_rebuild', count: 4, label: 'Need a rebuild first' },
      ],
      n_pruned: 25,
      n_needs_rebuild: 4,
      confirm_label: 'Park 25 tables',
      criteria: { mode: 'park' },
    });
    // Paper 9b prune rows only — rebuild count is separate.
    expect(rows.map(row => row.count)).toEqual([19, 4, 2]);
    expect(tidyNeedsRebuildCount({ n_needs_rebuild: 4 })).toBe(4);
    expect(tidyNeedsRebuildNote(4)).toBe('4 tables need a rebuild first — left alone.');
    expect(tidyNeedsRebuildNote(1)).toBe('1 table needs a rebuild first — left alone.');
    expect(
      tidyConfirmLabel(
        { confirm_label: 'Park 25 tables', criteria: { mode: 'park' }, n_pruned: 25 },
        'park'
      )
    ).toBe('Park 25 tables');
    expect(tidyConfirmLabel({ n_pruned: 4 }, 'hide')).toBe('Hide 4 tables');
  });
});
