import {
  analysisRequiredFieldsSatisfied,
  computeWizardFieldErrors,
} from './analysis-setup-validation';
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

const SCHEMA: SchemaColumn[] = [
  col('from_id', 'string'),
  col('to_id', 'string'),
  col('w', 'numeric'),
  col('n1', 'numeric'),
  col('n2', 'numeric'),
  col('n3', 'numeric'),
];

function networkForm(overrides: Partial<AnalysisFormState> = {}): AnalysisFormState {
  return {
    analysis: 'network',
    ...defaultFormFieldsFromSchema(SCHEMA),
    ...overrides,
  };
}

describe('network analysis form', () => {
  it('builds an edge-list body with source, target, and optional weight', () => {
    const form = networkForm({
      networkIngest: 'edge_list',
      chiA: 'from_id',
      chiB: 'to_id',
      networkWeightCol: 'w',
    });
    expect(buildBodyFromForm(form)).toEqual({
      source: 'from_id',
      target: 'to_id',
      weight: 'w',
    });
  });

  it('omits weight when the optional column is empty', () => {
    const form = networkForm({
      networkIngest: 'edge_list',
      chiA: 'from_id',
      chiB: 'to_id',
      networkWeightCol: '',
    });
    expect(buildBodyFromForm(form)).toEqual({ source: 'from_id', target: 'to_id' });
  });

  it('builds an adjacency body from selected numeric columns', () => {
    const form = networkForm({
      networkIngest: 'adjacency',
      selectedCols: ['n1', 'n2', 'n3'],
    });
    expect(buildBodyFromForm(form)).toEqual({ adjacency_columns: ['n1', 'n2', 'n3'] });
  });

  it('does not treat leftover selected columns as an adjacency matrix in edge-list mode', () => {
    const form = networkForm({
      networkIngest: 'edge_list',
      chiA: 'from_id',
      chiB: 'to_id',
      selectedCols: ['n1', 'n2', 'n3'],
    });
    expect(buildBodyFromForm(form)).toEqual({ source: 'from_id', target: 'to_id' });
  });

  it('restores edge-list and adjacency bodies into the form', () => {
    const edge = formStateFromBody(
      'network',
      { source: 'from_id', target: 'to_id', weight: 'w' },
      SCHEMA
    );
    expect(edge.networkIngest).toBe('edge_list');
    expect(edge.chiA).toBe('from_id');
    expect(edge.chiB).toBe('to_id');
    expect(edge.networkWeightCol).toBe('w');

    const adj = formStateFromBody('network', { adjacency_columns: ['n1', 'n2', 'n3'] }, SCHEMA);
    expect(adj.networkIngest).toBe('adjacency');
    expect(adj.selectedCols).toEqual(['n1', 'n2', 'n3']);
  });

  it('requires source and target, or at least two adjacency columns', () => {
    const edgeEmpty = networkForm({ networkIngest: 'edge_list', chiA: '', chiB: '' });
    expect(analysisRequiredFieldsSatisfied('network', edgeEmpty, SCHEMA)).toBe(false);
    expect(
      computeWizardFieldErrors('network', edgeEmpty, SCHEMA, null).chiA?.length
    ).toBeGreaterThan(0);

    const edgeOk = networkForm({ networkIngest: 'edge_list', chiA: 'from_id', chiB: 'to_id' });
    expect(analysisRequiredFieldsSatisfied('network', edgeOk, SCHEMA)).toBe(true);

    const adjEmpty = networkForm({ networkIngest: 'adjacency', selectedCols: [] });
    expect(analysisRequiredFieldsSatisfied('network', adjEmpty, SCHEMA)).toBe(false);

    const adjOk = networkForm({ networkIngest: 'adjacency', selectedCols: ['n1', 'n2'] });
    expect(analysisRequiredFieldsSatisfied('network', adjOk, SCHEMA)).toBe(true);
  });
});
