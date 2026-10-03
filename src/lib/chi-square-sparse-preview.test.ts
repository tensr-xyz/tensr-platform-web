import {
  computeWizardFieldErrors,
  computeWizardFieldNotices,
  hasWizardBlockingErrors,
} from './analysis-setup-validation';
import { defaultFormFieldsFromSchema, type AnalysisFormState } from './analysis-definitions';
import type { DatasetPreview, SchemaColumn } from './analysis-report-types';

const SCHEMA: SchemaColumn[] = [
  { name: 'Interval', type: 'categorical', missing_count: 0 },
  { name: 'Time_zone', type: 'categorical', missing_count: 0 },
];

const PREVIEW: DatasetPreview = {
  headers: ['Interval', 'Time_zone'],
  rows: [
    ['short', 'Eastern'],
    ['short', 'Eastern'],
    ['medium', 'Pacific'],
    ['medium', 'Eastern'],
    ['long', 'Central'],
    ['long', 'Other'],
  ],
};

describe('chi-square on a sparse preview', () => {
  const form: AnalysisFormState = {
    analysis: 'chi_square',
    ...defaultFormFieldsFromSchema(SCHEMA),
    chiA: 'Interval',
    chiB: 'Time_zone',
  };

  it('warns about sparse cells but leaves the run to the full dataset', () => {
    const errors = computeWizardFieldErrors('chi_square', form, SCHEMA, PREVIEW);
    expect(hasWizardBlockingErrors(errors)).toBe(false);
    const notices = computeWizardFieldNotices('chi_square', form, SCHEMA, PREVIEW);
    const messages = Object.values(notices)
      .flat()
      .map(n => n?.message ?? '');
    expect(messages.some(m => m.startsWith('Sparse contingency table in preview'))).toBe(true);
  });
});
