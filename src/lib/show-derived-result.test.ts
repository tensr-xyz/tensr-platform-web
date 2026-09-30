import { showDerivedResult } from './show-derived-result';
import { adoptDerivedDataset } from '@/lib/adopt-derived-dataset';
import { openAnalysisResultTab } from '@/lib/open-analysis-result-tab';
import type { AnalysisReport } from '@/lib/analysis-report-types';

jest.mock('@/lib/adopt-derived-dataset', () => ({ adoptDerivedDataset: jest.fn() }));
jest.mock('@/lib/open-analysis-result-tab', () => ({ openAnalysisResultTab: jest.fn() }));

const adopt = adoptDerivedDataset as jest.Mock;
const openTab = openAnalysisResultTab as jest.Mock;

const report = { title: 'Merge datasets' } as unknown as AnalysisReport;
const response = {
  dataset_id: 'child-1',
  original_filename: 'survey_merged.csv',
  n_rows: 24,
  n_cols: 9,
  preview: { headers: ['id'], variable_names: ['id'], rows: [[1]], columns: [] },
  report,
  provenance: { dataset_id: 'child-1' },
};

describe('showDerivedResult', () => {
  beforeEach(() => {
    adopt.mockReset();
    openTab.mockReset();
  });

  it('opens the saved dataset in the sheet and adds its report tab without stealing focus', () => {
    adopt.mockReturnValue(true);
    expect(showDerivedResult('merge_datasets', response, { keys: ['id'] })).toBe(true);
    expect(adopt).toHaveBeenCalledWith(
      expect.objectContaining({ dataset_id: 'child-1', n_rows: 24, preview: response.preview })
    );
    expect(openTab).toHaveBeenCalledWith(
      expect.objectContaining({
        op: 'merge_datasets',
        sourceDatasetId: 'child-1',
        activate: false,
        envelope: expect.objectContaining({ report, provenance: response.provenance }),
        parameters: expect.objectContaining({ keys: ['id'], derived_dataset_id: 'child-1' }),
      })
    );
  });

  it('reports false and opens no tab when there is no sheet to switch', () => {
    adopt.mockReturnValue(false);
    expect(showDerivedResult('fuse_waves', response, {})).toBe(false);
    expect(openTab).not.toHaveBeenCalled();
  });

  it('skips the report tab when the route returned no report', () => {
    adopt.mockReturnValue(true);
    showDerivedResult('rake', { ...response, report: undefined }, {});
    expect(openTab).not.toHaveBeenCalled();
  });
});
