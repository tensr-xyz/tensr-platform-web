import { analyzeRunBody } from './output-preferences';
import { getAnalysisRunBlockers } from './analysis-setup-validation';
import {
  bannerRerunPrefill,
  buildBodyFromForm,
  defaultFormFieldsFromSchema,
  formStateFromBody,
  type AnalysisFormState,
} from './analysis-definitions';
import type { SchemaColumn } from './analysis-report-types';

function col(name: string, type: string): SchemaColumn {
  return { name, type, missing_count: 0 };
}

const SCHEMA: SchemaColumn[] = [col('Q5', 'categorical'), col('Q3', 'categorical')];

function bannerForm(overrides: Partial<AnalysisFormState> = {}): AnalysisFormState {
  return {
    analysis: 'banner_table',
    ...defaultFormFieldsFromSchema(SCHEMA),
    ...overrides,
  };
}

describe('banner table rerun form', () => {
  it('prefills stub, banner and the stored output options', () => {
    const form = formStateFromBody(
      'banner_table',
      {
        stub_column: 'Q5',
        banner_column: 'Q3',
        weight: 'weight',
        decimals: 3,
        apa_format: true,
        include_charts: false,
        nets: [{ label: 'NET Agree', values: ['4', '5'] }],
        filter: "Q1 == 'Female'",
      },
      SCHEMA
    );
    expect(form.chiA).toBe('Q5');
    expect(form.chiB).toBe('Q3');
    expect(form.bannerWeight).toBe('weight');
    expect(form.bannerDecimals).toBe('3');
    expect(form.apaFormat).toBe(true);
    expect(form.includeCharts).toBe(false);
    expect(form.bannerNetRows).toEqual([{ label: 'NET Agree', codes: '4, 5' }]);
    expect(form.bannerFilter).toContain('Female');
    expect(getAnalysisRunBlockers('banner_table', form, SCHEMA, 'ds-1')).not.toContain(
      'Complete the required fields above.'
    );
    expect(buildBodyFromForm(form)).toMatchObject({
      stub_column: 'Q5',
      banner_column: 'Q3',
      weight: 'weight',
      decimal_places: 3,
      decimals: {
        column_proportion: 3,
        row_proportion: 3,
        total_proportion: 3,
        column_mean: 3,
      },
      apa_format: true,
      include_charts: false,
    });
    expect(form.bannerDecimals.startsWith('{')).toBe(false);
  });

  it('reopens a saved banner with charts off and a number of decimals', () => {
    const saved = {
      stub_column: 'Q5',
      banner_column: 'Q3',
      apa_format: false,
      include_charts: false,
      decimals: {
        column_proportion: 1,
        row_proportion: 1,
        total_proportion: 1,
        column_mean: 1,
      },
    };
    const form = formStateFromBody('banner_table', saved, SCHEMA);
    expect(form.bannerDecimals).toBe('1');
    expect(form.includeCharts).toBe(false);
    const body = buildBodyFromForm(form);
    expect(body.include_charts).toBe(false);
    expect(body.apa_format).toBe(false);
    expect(body.decimals).toEqual(saved.decimals);
  });

  it('posts one name for each output field', () => {
    const form = formStateFromBody(
      'banner_table',
      {
        stub_column: 'Q5',
        banner_column: 'Q3',
        apa_format: false,
        include_charts: false,
        decimals: {
          column_proportion: 1,
          row_proportion: 1,
          total_proportion: 1,
          column_mean: 1,
        },
      },
      SCHEMA
    );
    const body = analyzeRunBody(buildBodyFromForm(form), {
      apaFormat: true,
      includeCharts: true,
      decimalPlaces: 3,
    });
    expect(body).not.toHaveProperty('apaFormat');
    expect(body).not.toHaveProperty('includeCharts');
    expect(body).not.toHaveProperty('decimalPlaces');
    expect(body.apa_format).toBe(false);
    expect(body.include_charts).toBe(false);
    expect(body.decimal_places).toBe(1);
    expect(typeof body.decimal_places).toBe('number');
    expect(body.decimals).toEqual({
      column_proportion: 1,
      row_proportion: 1,
      total_proportion: 1,
      column_mean: 1,
    });
    expect(form.bannerDecimals).toBe('1');
  });

  it('reads camelCase output flags and report preferences the body left out', () => {
    const fromAgent = formStateFromBody(
      'banner_table',
      {
        stub_column: 'Q5',
        banner_column: 'Q3',
        apaFormat: true,
        includeCharts: true,
      },
      SCHEMA
    );
    expect(fromAgent.apaFormat).toBe(true);
    expect(fromAgent.includeCharts).toBe(true);

    const prefill = bannerRerunPrefill(
      { stub_column: 'Q5', banner_column: 'Q3' },
      { run_id: 'run-1' },
      { apaFormat: true, includeCharts: true }
    );
    expect(prefill).not.toHaveProperty('run_id');
    const form = formStateFromBody('banner_table', prefill, SCHEMA);
    expect(form.apaFormat).toBe(true);
    expect(form.includeCharts).toBe(true);

    const explicit = bannerRerunPrefill(
      { stub_column: 'Q5', banner_column: 'Q3', apa_format: false, include_charts: false },
      null,
      { apaFormat: true, includeCharts: true }
    );
    const kept = formStateFromBody('banner_table', explicit, SCHEMA);
    expect(kept.apaFormat).toBe(false);
    expect(kept.includeCharts).toBe(false);
  });

  it('prefills one decimal when the stored body only has the analyze default of 3', () => {
    const form = formStateFromBody(
      'banner_table',
      {
        stub_column: 'Q1_Satisfaction',
        banner_column: 'Group',
        decimal_places: 3,
      },
      SCHEMA
    );
    expect(form.bannerDecimals).toBe('1');
    expect(buildBodyFromForm(form).decimals).toMatchObject({ column_proportion: 1 });
  });

  it('keeps run disabled until the stub and banner are set', () => {
    const blockers = getAnalysisRunBlockers(
      'banner_table',
      bannerForm({ chiA: '', chiB: '' }),
      SCHEMA,
      'ds-1'
    );
    expect(blockers).toEqual(expect.arrayContaining(['Select the stub.', 'Select the banner.']));
  });
});
