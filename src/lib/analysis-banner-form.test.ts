import { getAnalysisRunBlockers } from './analysis-setup-validation';
import {
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
    expect(form.bannerNets).toContain('NET Agree');
    expect(form.bannerFilter).toContain('Female');
    expect(
      getAnalysisRunBlockers('banner_table', form, SCHEMA, 'ds-1')
    ).not.toContain('Complete the required fields above.');
    expect(buildBodyFromForm(form)).toMatchObject({
      stub_column: 'Q5',
      banner_column: 'Q3',
      weight: 'weight',
      apa_format: true,
      include_charts: false,
    });
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
