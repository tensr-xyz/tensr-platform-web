import {
  DEFAULT_TABLE_SIGNIFICANCE,
  alphaFromConfidence,
  arrowForCell,
  comparisonTypeFromShowAs,
  confidenceFromAlpha,
  displayFromShowAs,
  settingsFromSpec,
  showAsFromDisplay,
  significanceFootnoteLine,
  significanceRequestFields,
  significanceToolbarLabel,
} from './table-significance';

describe('table significance settings', () => {
  it('defaults many-columns correction to none (Displayr column comparisons)', () => {
    expect(DEFAULT_TABLE_SIGNIFICANCE.multipleComparison).toBe('none');
  });

  it('maps confidence, display mode and request fields', () => {
    expect(alphaFromConfidence(90)).toBe(0.1);
    expect(alphaFromConfidence(99)).toBe(0.01);
    expect(confidenceFromAlpha(0.05)).toBe(95);
    expect(displayFromShowAs('letters')).toBe('column_letters');
    expect(displayFromShowAs('arrows')).toBe('cell_comparisons');
    expect(displayFromShowAs('off')).toBe('none');
    expect(comparisonTypeFromShowAs('arrows')).toBe('subgroup_vs_total');
    expect(showAsFromDisplay('none')).toBe('off');
    expect(showAsFromDisplay('cell_comparisons')).toBe('arrows');
    expect(
      significanceRequestFields({
        ...DEFAULT_TABLE_SIGNIFICANCE,
        showAs: 'arrows',
        confidence: 99,
        multipleComparison: 'fdr',
        meansPostHoc: 'dunnett',
        dunnettControl: 'North',
      })
    ).toMatchObject({
      significance_display: 'cell_comparisons',
      significance_alpha: 0.01,
      multiple_comparison: 'fdr',
      comparison_type: 'subgroup_vs_total',
      means_post_hoc: 'dunnett',
      post_hoc_control: 'North',
    });
    expect(
      significanceToolbarLabel({ ...DEFAULT_TABLE_SIGNIFICANCE, showAs: 'letters', confidence: 95 })
    ).toBe('Significance · 95% letters');
    expect(
      significanceToolbarLabel({ ...DEFAULT_TABLE_SIGNIFICANCE, showAs: 'arrows', confidence: 90 })
    ).toBe('Significance · 90% arrows');
  });

  it('restores settings from a saved table spec', () => {
    expect(
      settingsFromSpec({
        significance_display: 'cell_comparisons',
        comparison_type: 'subgroup_vs_total',
        significance_alpha: 0.01,
        multiple_comparison: 'none',
        means_post_hoc: 'fisher_lsd',
      })
    ).toMatchObject({
      showAs: 'arrows',
      confidence: 99,
      multipleComparison: 'none',
      meansPostHoc: 'fisher_lsd',
    });
  });

  it('builds the letters footnote and arrow marks vs the total', () => {
    const book = {
      significance_display: 'cell_comparisons',
      significance_alpha: 0.05,
      mcc: 'bonferroni',
      means_post_hoc: 'tukey',
      banner_columns: [{ id: 'a' }, { id: 'b' }, { id: 'total' }],
      tests: {
        mcc: { default: 'bonferroni' },
        items: [
          {
            stub_row_id: 'row1',
            left: 'a',
            right: 'total',
            significant: true,
          },
        ],
      },
      rows: [
        {
          id: 'row1',
          cells: [
            { banner_id: 'a', percent: 34 },
            { banner_id: 'b', percent: 22 },
            { banner_id: 'total', percent: 28 },
          ],
        },
      ],
    };
    expect(arrowForCell(book, 'row1', 'a')).toBe('↑');
    expect(arrowForCell(book, 'row1', 'b')).toBe('');
    expect(significanceFootnoteLine(book)).toContain(
      'Arrows: higher or lower than the total at 95%'
    );
    expect(
      significanceFootnoteLine({
        ...book,
        significance_display: 'column_letters',
        letters: [{ stub_row_id: 'row1', banner_id: 'a', letter: 'c' }],
      })
    ).toBe(
      'Letters: higher than that column at 95%, Bonferroni-corrected across 2 columns · Means: Tukey HSD'
    );
  });

  it('keeps Paired McNemar on item tables even when chrome is set to arrows', () => {
    expect(
      significanceFootnoteLine(
        {
          significance_display: 'cell_comparisons',
          significance_alpha: 0.05,
          paired_within_items: true,
          letter_test: 'Paired McNemar test at 95%.',
          banner_columns: [{ id: 'a' }, { id: 'total' }],
        },
        { ...DEFAULT_TABLE_SIGNIFICANCE, showAs: 'arrows', confidence: 90 }
      )
    ).toBe(
      'Paired McNemar test at 90%. A letter marks a value significantly higher than that column.'
    );
    expect(
      significanceFootnoteLine(
        {
          significance_display: 'column_letters',
          significance_alpha: 0.05,
          paired_within_items: true,
          letter_test: 'Paired McNemar test at 95%.',
          banner_columns: [{ id: 'total' }],
        },
        { ...DEFAULT_TABLE_SIGNIFICANCE, showAs: 'letters', confidence: 90 }
      )
    ).toBe(
      'Paired McNemar test at 90%. A letter marks a value significantly higher than that column.'
    );
  });

  it('still uses arrows for non-paired tables at the chosen confidence', () => {
    expect(
      significanceFootnoteLine(
        {
          significance_display: 'cell_comparisons',
          significance_alpha: 0.05,
          banner_columns: [{ id: 'a' }, { id: 'total' }],
        },
        { ...DEFAULT_TABLE_SIGNIFICANCE, showAs: 'arrows', confidence: 90 }
      )
    ).toBe('Arrows: higher or lower than the total at 90%');
  });
});
