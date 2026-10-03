import { analysisRequiredFieldsSatisfied } from './analysis-setup-validation';
import {
  defaultFormFieldsFromSchema,
  type AnalysisFormState,
  type AnalysisKey,
} from './analysis-definitions';
import type { SchemaColumn } from './analysis-report-types';

function col(name: string, type: string): SchemaColumn {
  return { name, type, missing_count: 0 };
}

const SCHEMA: SchemaColumn[] = [
  col('a', 'numeric'),
  col('b', 'numeric'),
  col('c', 'numeric'),
  col('g', 'categorical'),
  col('h', 'categorical'),
  col('s', 'categorical'),
];

function filledForm(analysis: AnalysisKey): AnalysisFormState {
  return {
    analysis,
    ...defaultFormFieldsFromSchema(SCHEMA),
    selectedCols: ['a', 'b', 'c'],
    independentCols: ['b', 'c'],
    depCol: 'a',
    groupCol: 'g',
    valueCol: 'b',
    chiA: 'g',
    chiB: 'h',
    pairedBeforeCol: 'a',
    pairedAfterCol: 'b',
    oneSampleCol: 'a',
  };
}

const FORM_DRIVEN: AnalysisKey[] = [
  'shapiro_wilk',
  'lilliefors_ks',
  'runs_test',
  'sign_test',
  'mcnemar',
  'median_test',
  'jonckheere_terpstra',
  'moses_test',
  'cochrans_q',
  'canonical_correlation',
  'multidimensional_scaling',
  'hotelling_t2',
  'fleiss_kappa',
  'weighted_kappa',
  'kendalls_w',
  'fishers_exact',
  'odds_ratio',
  'relative_risk',
  'goodman_kruskal_gamma',
  'somers_d',
  'goodman_kruskal_lambda',
  'probit_regression',
  'negative_binomial_regression',
  'ordinal_regression',
];

describe('analysisRequiredFieldsSatisfied for analyses without a dedicated rule', () => {
  it.each(FORM_DRIVEN)('%s can run once its columns are chosen', analysis => {
    expect(analysisRequiredFieldsSatisfied(analysis, filledForm(analysis), SCHEMA)).toBe(true);
  });

  it('blocks a normality test with no test variable', () => {
    const form = { ...filledForm('shapiro_wilk'), oneSampleCol: '' };
    expect(analysisRequiredFieldsSatisfied('shapiro_wilk', form, SCHEMA)).toBe(false);
  });

  it('blocks McNemar with only one variable', () => {
    const form = { ...filledForm('mcnemar'), chiB: '' };
    expect(analysisRequiredFieldsSatisfied('mcnemar', form, SCHEMA)).toBe(false);
  });

  it.each([
    'probit_regression',
    'negative_binomial_regression',
    'ordinal_regression',
    'cochrans_q',
    'canonical_correlation',
    'multidimensional_scaling',
    'hotelling_t2',
  ] as AnalysisKey[])('%s stays blocked with no variables chosen instead of throwing', analysis => {
    const form: AnalysisFormState = {
      analysis,
      ...defaultFormFieldsFromSchema(SCHEMA),
      selectedCols: [],
      independentCols: [],
    };
    expect(analysisRequiredFieldsSatisfied(analysis, form, SCHEMA)).toBe(false);
  });

  it('keeps banner tables on their own dialog', () => {
    expect(
      analysisRequiredFieldsSatisfied('banner_table', filledForm('banner_table'), SCHEMA)
    ).toBe(false);
  });
});
