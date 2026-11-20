import {
  achievedShare,
  buildCombineWeightsBody,
  buildScreenRakeBody,
  categoryMeanWeight,
  countsFromPercents,
  marginFor,
  PREVIOUS_WEIGHT,
  resolveWeightedTotal,
  shareLabel,
  targetPercents,
} from './weight-targets';

describe('weight modal', () => {
  it('sends the typed percents, the same encoding the agent uses', () => {
    expect(
      targetPercents([
        { code: 'East', percent: '25' },
        { code: 'West', percent: '75' },
        { code: 'Blank', percent: '' },
      ])
    ).toEqual({ East: 25, West: 75 });
  });

  it('still converts percents to counts when a caller asks for expansion totals', () => {
    expect(countsFromPercents([{ code: 'East', percent: '25' }], 400)).toEqual({ East: 100 });
    expect(countsFromPercents([{ code: 'East', percent: '' }], 400)).toEqual({});
  });

  it('reads the weighted share and the category mean from the rake margin', () => {
    const margin = marginFor(
      [{ column: 'region', level: 'East', achieved: 100 }],
      'region',
      'East'
    );
    expect(shareLabel(0.182)).toBe('18.2%');
    expect(achievedShare(margin?.achieved || 0, 400)).toBe('25.0%');
    expect(categoryMeanWeight(100, 80)).toBe('1.25');
  });

  it('posts floor, cap, and a named design weight with the percent targets', () => {
    expect(
      buildScreenRakeBody(
        [
          {
            column: 'region',
            codes: [
              { code: 'East', percent: '40' },
              { code: 'West', percent: '60' },
            ],
          },
        ],
        { floor: '0.5', cap: '3', startFrom: 'panel_weight', preview: true }
      )
    ).toEqual({
      categorical_targets: { region: { East: 40, West: 60 } },
      lower: 0.5,
      upper: 3,
      design_weight_column: 'panel_weight',
      preview: true,
    });
  });

  it('posts use_existing_weight when the screen starts from the previous weight', () => {
    expect(
      buildScreenRakeBody([{ column: 'sex', codes: [{ code: 'F', percent: '51' }] }], {
        startFrom: PREVIOUS_WEIGHT,
      })
    ).toEqual({
      categorical_targets: { sex: { F: 51 } },
      use_existing_weight: true,
    });
  });

  it('resolves weighted totals for sample, people, thousands, and custom', () => {
    expect(resolveWeightedTotal('sample', '1204')).toBeUndefined();
    expect(resolveWeightedTotal('people', '45200')).toBe(45200);
    expect(resolveWeightedTotal('thousands', '45.2')).toBe(45200);
    expect(resolveWeightedTotal('custom', '0')).toBeUndefined();
  });

  it('posts weighted_total with the rake body when Limits & total sets one', () => {
    expect(
      buildScreenRakeBody([{ column: 'region', codes: [{ code: 'East', percent: '40' }] }], {
        weightedTotal: 500,
        floor: '0.3',
        cap: '3',
      })
    ).toEqual({
      categorical_targets: { region: { East: 40 } },
      lower: 0.3,
      upper: 3,
      weighted_total: 500,
    });
  });

  it('builds a combine body with at least two columns and an optional total', () => {
    expect(buildCombineWeightsBody(['design_wt'])).toBeNull();
    expect(buildCombineWeightsBody(['design_wt', 'nr_wt'], { total: 1204 })).toEqual({
      columns: ['design_wt', 'nr_wt'],
      total: 1204,
    });
  });
});
