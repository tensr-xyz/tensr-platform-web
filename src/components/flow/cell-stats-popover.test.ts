import {
  cellStatOptionsForWeight,
  reorderCellStatIds,
  selectedCellStatIds,
  statisticsFromCellStatIds,
} from './cell-stats-popover';
import { bookIsProjection } from './survey-screens';
import { extraCellStatLines } from '@/lib/flow-survey';

describe('TEN-178 cell stats popover', () => {
  it('hides Projected 000s unless the weight is a projection', () => {
    const projection = cellStatOptionsForWeight(true).map(option => option.id);
    const design = cellStatOptionsForWeight(false).map(option => option.id);
    expect(projection).toContain('projected');
    expect(design).not.toContain('projected');
    expect(design).toContain('count');
  });

  it('maps checklist order to API statistic kinds', () => {
    expect(
      statisticsFromCellStatIds(['column_pct', 'projected', 'index', 'unweighted'], true)
    ).toEqual(['column_proportion', 'projected_thousands', 'index', 'unweighted_base']);
    expect(statisticsFromCellStatIds(['inferential', 'bases', 'ci'], false)).toEqual([
      'z_statistic',
      'standard_error',
      'effective_base',
      'missing_count',
      'confidence_interval',
    ]);
  });

  it('reads selected checklist ids from saved statistics', () => {
    expect(
      selectedCellStatIds(
        ['column_proportion', 'projected_thousands', 'index', 'unweighted_base'],
        true
      )
    ).toEqual(['column_pct', 'projected', 'index', 'unweighted']);
  });

  it('reorders selected ids by drag target', () => {
    expect(
      reorderCellStatIds(['column_pct', 'index', 'unweighted'], 'unweighted', 'column_pct')
    ).toEqual(['unweighted', 'column_pct', 'index']);
  });

  it('treats book.is_projection as the projection flag', () => {
    expect(bookIsProjection({ weight: { is_projection: true, projection_unit: 'people' } })).toBe(
      true
    );
    expect(bookIsProjection({ weight: { is_projection: false } })).toBe(false);
    expect(bookIsProjection({ weight: { projection_unit: 'thousands' } })).toBe(true);
    expect(bookIsProjection(null)).toBe(false);
  });

  it('stacks inferential cell lines from selected statistics', () => {
    expect(
      extraCellStatLines(
        {
          banner_id: 'total',
          z_statistic: 1.96,
          standard_error: 0.012,
          effective_base: 4106,
          missing_count: 3,
          ci_low: 38.1,
          ci_high: 45.9,
        },
        ['z_statistic', 'standard_error', 'effective_base', 'missing_count', 'confidence_interval'],
        1
      )
    ).toEqual(['z 1.96', 'se 0.012', 'eff 4,106', 'miss 3', 'ci 38.1–45.9%']);
  });
});
