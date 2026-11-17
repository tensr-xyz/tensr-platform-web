import { exportStem } from '@/lib/dataset-data-export';

describe('dataset data export helpers', () => {
  it('builds a download stem from the file name', () => {
    expect(exportStem('wave_final.sav')).toBe('wave_final');
    expect(exportStem('coded themes.xlsx')).toBe('coded-themes');
    expect(exportStem(undefined)).toBe('dataset');
  });
});
