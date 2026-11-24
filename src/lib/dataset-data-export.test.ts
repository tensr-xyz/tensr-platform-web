import { exportStem } from '@/lib/dataset-data-export';

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
});
