import {
  derivedWorkspacePath,
  spreadsheetPatchFromDerivedDataset,
  userFacingSchemaColumns,
} from './adopt-derived-dataset';
import type { TabData } from '@/stores/tabs-store';

describe('spreadsheetPatchFromDerivedDataset', () => {
  const parentId = '11111111-1111-4111-8111-111111111111';
  const derivedId = 'e5d1c555-9f80-497d-b0fb-2bfa07983d4c';

  const current: TabData = {
    datasetId: parentId,
    filePath: parentId,
    initialColumns: [
      { id: 'Pos', accessor: 'Pos', header: 'Pos', width: 80, type: 'string' },
      { id: 'PTS', accessor: 'PTS', header: 'PTS', width: 80, type: 'numeric' },
    ],
    initialData: [{ Pos: 'PG', PTS: 18 }],
    totalRows: 1,
    totalColumns: 2,
  };

  it('points the tab at the derived dataset and adds PosGroup without a workspace remount payload', () => {
    const patch = spreadsheetPatchFromDerivedDataset(current, {
      dataset_id: derivedId,
      original_filename: "NBA Per-Game Stats ('23-24)_recoded.csv",
      n_rows: 505,
      n_cols: 32,
      preview: {
        variable_names: ['Pos', 'PTS', 'PosGroup', '_row_uid'],
        headers: ['Pos', 'PTS', 'Pos (recode)', '_row_uid'],
        rows: [['PG', 18, 'Guard', 'uid-1']],
        columns: [
          { name: 'Pos', type: 'string' },
          { name: 'PTS', type: 'numeric' },
          { name: 'PosGroup', type: 'string', label: 'Pos (recode)' },
          { name: '_row_uid', type: 'string' },
        ],
      },
    });

    expect(patch.datasetId).toBe(derivedId);
    expect(patch.filePath).toBe(derivedId);
    expect(patch.totalRows).toBe(505);
    expect(patch.initialColumns?.map(c => c.id)).toEqual(['Pos', 'PTS', 'PosGroup']);
    expect(patch.initialColumns?.find(c => c.id === 'PosGroup')?.header).toBe('Pos (recode)');
    expect(patch.initialData?.[0]).toEqual({ Pos: 'PG', PTS: 18, PosGroup: 'Guard' });
    expect(patch.initialData?.[0]).not.toHaveProperty('_row_uid');
  });

  it('still switches dataset id when preview is missing', () => {
    const patch = spreadsheetPatchFromDerivedDataset(current, { dataset_id: derivedId });
    expect(patch.datasetId).toBe(derivedId);
    expect(patch.initialColumns).toEqual(current.initialColumns);
  });
});

describe('userFacingSchemaColumns', () => {
  it('drops lineage internals so analysis pickers cannot select _row_uid', () => {
    const cols = userFacingSchemaColumns([
      { name: 'Pos', type: 'categorical', missing_count: 0 },
      { name: '_row_uid', type: 'categorical', missing_count: 0 },
      { name: '_weight', type: 'numeric', missing_count: 0 },
      { name: 'Age', type: 'numeric', missing_count: 0 },
    ]);
    expect(cols.map(c => c.name)).toEqual(['Pos', 'Age']);
  });
});

describe('derivedWorkspacePath', () => {
  it('does not use a Next.js navigation that remounts Workspace', () => {
    expect(derivedWorkspacePath('e5d1c555-9f80-497d-b0fb-2bfa07983d4c', 'nba_recoded.csv')).toBe(
      '/workspace/dataset/e5d1c555-9f80-497d-b0fb-2bfa07983d4c?name=nba_recoded.csv'
    );
  });
});
