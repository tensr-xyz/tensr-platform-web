import { exportStem, exportStemFromVersion } from '@/lib/dataset-data-export';

describe('dataset data export helpers', () => {
  it('builds a download stem from the file name', () => {
    expect(exportStem('wave_final.sav')).toBe('wave_final');
    expect(exportStem('coded themes.xlsx')).toBe('coded-themes');
    expect(exportStem(undefined)).toBe('dataset');
  });

  it('collapses runs of separators so downloads are not triple-dashed', () => {
    expect(exportStem('coffee_tracker_demo - weighted - 23 Nov 13:05:21')).toBe(
      'coffee_tracker_demo-weighted-23-Nov-13-05-21'
    );
    expect(exportStem('wave · coded · themes.csv')).toBe('wave-coded-themes');
  });

  it('uses the working-version label the user sees, not the parent file name', () => {
    expect(
      exportStemFromVersion({
        parent_dataset_id: 'parent-1',
        original_filename: 'coffee_tracker_demo-weighted-25-Nov-18-25-26',
        lineage_label: 'Edited labels',
      })
    ).toBe('Edited-labels');
  });

  it('falls back to the upload name for a root file', () => {
    expect(
      exportStemFromVersion({
        original_filename: 'wave_final.sav',
        lineage_label: 'Raw upload',
      })
    ).toBe('wave_final');
  });
});
