import { computeDataset, shiftDatasetColumns } from './dataset-data-ops';
import { adoptDerivedDataset } from './adopt-derived-dataset';
import { buildComputeBody } from './compute-transform';
import { useTabsStore, ViewType } from '@/stores/tabs-store';

const PARENT_ID = 'e2e00000-0000-4000-8000-000000000001';
const COMPUTED_ID = 'e5d1c555-9f80-497d-b0fb-2bfa07983d4c';
const SHIFTED_ID = 'a1b2c3d4-1111-4111-8111-111111111111';

function seedSheetTab() {
  useTabsStore.setState({
    tabs: [
      {
        id: 'sheet-1',
        name: 'e2e-sample.csv',
        type: ViewType.SPREADSHEET,
        content: '',
        isDirty: false,
        path: PARENT_ID,
        data: {
          datasetId: PARENT_ID,
          filePath: PARENT_ID,
          initialColumns: [
            { id: 'age', accessor: 'age', header: 'age', width: 80, type: 'numeric' },
            { id: 'score', accessor: 'score', header: 'score', width: 80, type: 'numeric' },
          ],
          initialData: [
            { age: 25, score: 88 },
            { age: 30, score: 92 },
          ],
          totalRows: 2,
          totalColumns: 2,
        },
      },
    ],
    activeTabId: 'sheet-1',
  });
}

describe('compute and shift sheet adoption', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    seedSheetTab();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('compute formula result appears as a new sheet column', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        dataset_id: COMPUTED_ID,
        original_filename: 'e2e-sample_computed.csv',
        n_rows: 2,
        n_cols: 3,
        preview: {
          headers: ['age', 'score', 'age_plus_score'],
          variable_names: ['age', 'score', 'age_plus_score'],
          rows: [
            [25, 88, 113],
            [30, 92, 122],
          ],
          columns: [
            { name: 'age', type: 'numeric' },
            { name: 'score', type: 'numeric' },
            { name: 'age_plus_score', type: 'numeric' },
          ],
        },
      }),
    });

    const body = buildComputeBody({
      target: 'age_plus_score',
      kind: 'formula',
      expr: 'age + score',
    });
    if ('error' in body) throw new Error(body.error);

    const res = await computeDataset(PARENT_ID, body, 'token');
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toEqual(
      expect.stringContaining(`/datasets/${PARENT_ID}/compute`)
    );
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)).toEqual({
      transforms: [{ kind: 'formula', target: 'age_plus_score', expr: 'age + score' }],
    });

    expect(adoptDerivedDataset(res)).toBe(true);
    const tab = useTabsStore.getState().tabs[0];
    expect(tab.data?.datasetId).toBe(COMPUTED_ID);
    expect(tab.data?.initialColumns?.map(c => c.id)).toEqual(['age', 'score', 'age_plus_score']);
    expect(tab.data?.initialData?.[0]).toEqual({ age: 25, score: 88, age_plus_score: 113 });
  });

  it('shift lag result appears as a new sheet column', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        dataset_id: SHIFTED_ID,
        original_filename: 'e2e-sample_lag.csv',
        n_rows: 2,
        n_cols: 3,
        preview: {
          headers: ['age', 'score', 'score_lag1'],
          variable_names: ['age', 'score', 'score_lag1'],
          rows: [
            [25, 88, null],
            [30, 92, 88],
          ],
          columns: [
            { name: 'age', type: 'numeric' },
            { name: 'score', type: 'numeric' },
            { name: 'score_lag1', type: 'numeric' },
          ],
        },
      }),
    });

    const res = await shiftDatasetColumns(
      PARENT_ID,
      { columns: ['score'], direction: 'lag', periods: 1 },
      'token'
    );
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toEqual(
      expect.stringContaining(`/datasets/${PARENT_ID}/shift`)
    );
    expect(adoptDerivedDataset(res)).toBe(true);
    const tab = useTabsStore.getState().tabs[0];
    expect(tab.data?.initialColumns?.map(c => c.id)).toContain('score_lag1');
    expect(tab.data?.initialData?.[1]).toEqual({ age: 30, score: 92, score_lag1: 88 });
  });
});
