import { WIZARD_FIELD, computeWizardFieldErrors } from './analysis-setup-validation';
import {
  SPSS_MENU_PATHS,
  buildBodyFromForm,
  defaultFormFieldsFromSchema,
  type AnalysisFormState,
} from './analysis-definitions';
import type { SchemaColumn } from './analysis-report-types';

function col(name: string, type: string): SchemaColumn {
  return { name, type, missing_count: 0 };
}

const SCHEMA: SchemaColumn[] = [col('x', 'numeric'), col('y', 'numeric')];

function clusterForm(overrides: Partial<AnalysisFormState> = {}): AnalysisFormState {
  return {
    analysis: 'cluster_analysis',
    ...defaultFormFieldsFromSchema(SCHEMA),
    selectedCols: ['x', 'y'],
    ...overrides,
  };
}

describe('survival SPSS menu paths', () => {
  it('stores Analyze → Survival, not Time series → Survival', () => {
    expect(SPSS_MENU_PATHS.kaplan_meier).toBe('Analyze → Survival → Kaplan-Meier');
    expect(SPSS_MENU_PATHS.cox_proportional_hazards).toBe('Analyze → Survival → Cox PH');
    expect(SPSS_MENU_PATHS.nelson_aalen).toBe('Analyze → Survival → Nelson-Aalen');
  });
});

describe('tree wizard defaults', () => {
  it('posts max_depth 5 and min_samples_leaf 5', () => {
    const form: AnalysisFormState = {
      analysis: 'decision_tree',
      ...defaultFormFieldsFromSchema(SCHEMA),
      depCol: 'y',
      independentCols: ['x'],
    };
    const body = buildBodyFromForm(form);
    expect(body.max_depth).toBe(5);
    expect(body.min_samples_leaf).toBe(5);
  });

  it('omits max_depth when the depth field is cleared', () => {
    const form: AnalysisFormState = {
      analysis: 'decision_tree',
      ...defaultFormFieldsFromSchema(SCHEMA),
      depCol: 'y',
      independentCols: ['x'],
      treeMaxDepth: '',
    };
    const body = buildBodyFromForm(form);
    expect(body.max_depth).toBeUndefined();
    expect(body.min_samples_leaf).toBe(5);
  });
});

describe('cluster k field', () => {
  it('posts n_clusters from nClusters, not pcaNComponents', () => {
    const body = buildBodyFromForm(clusterForm({ nClusters: '4', pcaNComponents: '9' }));
    expect(body.n_clusters).toBe(4);
  });

  it('validates k on its own field', () => {
    const errors = computeWizardFieldErrors(
      'cluster_analysis',
      clusterForm({ nClusters: '1' }),
      SCHEMA
    );
    expect(errors[WIZARD_FIELD.nClusters]?.length).toBeGreaterThan(0);
    expect(errors[WIZARD_FIELD.columns]).toBeUndefined();
  });
});
