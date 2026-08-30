import {
  datasetExportPath,
  mapDatasetVersionToFileVersion,
  type DatasetVersionRow,
} from './dataset-versions';

const recode: DatasetVersionRow = {
  dataset_id: 'e5d1c555-9f80-497d-b0fb-2bfa07983d4c',
  original_filename: 'nba.csv',
  producing_operation: 'recoded',
  parent_dataset_id: '11111111-1111-4111-8111-111111111111',
  origin_dataset_id: '11111111-1111-4111-8111-111111111111',
  updated_at: '2026-01-03T00:00:00+00:00',
  is_latest: true,
  n_rows: 5,
  n_cols: 4,
};

describe('mapDatasetVersionToFileVersion', () => {
  it('keeps the version id as the dataset id so restore opens that parquet', () => {
    const mapped = mapDatasetVersionToFileVersion(recode);
    expect(mapped.versionId).toBe(recode.dataset_id);
    expect(mapped.isLatest).toBe(true);
    expect(mapped.lastModified).toBe(recode.updated_at);
    expect(mapped.label).toBe('recoded');
    expect(mapped.fileName).toBe('nba.csv');
  });
});

describe('datasetExportPath', () => {
  it('downloads a version through the dataset export route', () => {
    expect(datasetExportPath(recode.dataset_id)).toBe(`/datasets/${recode.dataset_id}/export`);
  });
});
