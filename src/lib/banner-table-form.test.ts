import {
  buildBodyFromForm,
  defaultFormFieldsFromSchema,
  formStateFromBody,
} from './analysis-definitions';

const schema = [
  { name: 'Gender', type: 'categorical' as const, missing_count: 0 },
  { name: 'Group', type: 'categorical' as const, missing_count: 0 },
  { name: 'Q1_satisfaction', type: 'numeric' as const, missing_count: 1 },
];

describe('banner_table setup', () => {
  it('keeps the stub and banner from the last run', () => {
    const form = formStateFromBody(
      'banner_table',
      { stub_column: 'Gender', banner_column: 'Group', column_percent: true },
      schema
    );
    expect(buildBodyFromForm(form)).toEqual({
      stub_column: 'Gender',
      banner_column: 'Group',
      column_percent: true,
      column_letters: true,
      significance_display: 'column_letters',
      significance_alpha: 0.05,
      letter_levels: 2,
      letter_case: 'lower',
      letter_upper_alpha: 0.01,
      multiple_comparison: 'fdr',
      apa_format: false,
      include_charts: false,
      decimal_places: 1,
      decimals: {
        column_proportion: 1,
        row_proportion: 1,
        total_proportion: 1,
        column_mean: 1,
      },
    });
  });

  it('does not submit an empty crosstab body', () => {
    const form = {
      analysis: 'banner_table' as const,
      ...defaultFormFieldsFromSchema(schema),
      chiA: '',
      chiB: '',
    };
    expect(() => buildBodyFromForm(form)).toThrow(/stub column/i);
  });
});
