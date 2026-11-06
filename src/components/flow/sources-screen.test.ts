import {
  contextMark,
  fileMark,
  sourceFileNote,
  sourceRowCount,
  sourceVersionTitle,
} from './sources-screen';

describe('sources screen', () => {
  it('labels a raw upload and a stacked file from the record', () => {
    expect(sourceFileNote({ original_filename: 'wave.sav' })).toBe('Raw upload');
    expect(
      sourceFileNote({
        parent_dataset_id: 'parent',
        lineage_label: 'Stacked wave.sav + extra.csv',
      })
    ).toBe('Stacked wave.sav + extra.csv');
    expect(sourceFileNote({ parent_dataset_id: 'parent' })).toBe('Stacked');
    expect(sourceRowCount({ n_rows: 2406 })).toBe('2,406 rows');
    expect(sourceRowCount({})).toBe('No rows');
  });

  it('adds the day and time to a version label that does not already have them', () => {
    const labels = [
      'joined',
      'scaled',
      'filtered',
      'stacked',
      'computed',
      'calibrated',
      'merged',
      'coded',
      'standardised',
      'derived',
      'weighted to region',
      'weighted to age, region',
    ];
    for (const label of labels) {
      const titled = sourceVersionTitle({
        parent_dataset_id: 'parent-file',
        lineage_label: label,
        updated_at: '2026-11-05T15:42:00Z',
      });
      expect(titled.startsWith(`${label} · `)).toBe(true);
      expect(titled).toMatch(/\d{1,2} \w{3} \d{2}:\d{2}$/);
      expect(titled).not.toBe(label);
    }
    expect(
      sourceVersionTitle({
        parent_dataset_id: 'parent-file',
        lineage_label: 'weighted to region · 5 Nov 15:42',
        updated_at: '2026-11-05T15:42:00Z',
      })
    ).toBe('weighted to region · 5 Nov 15:42');
    expect(sourceVersionTitle({ original_filename: 'panel.sav' })).toBe('panel.sav');
  });

  it('marks context documents by kind', () => {
    expect(contextMark('questionnaire')).toBe('PDF');
    expect(contextMark('brief')).toBe('DOC');
    expect(contextMark('report')).toBe('PPT');
    expect(fileMark('wave.sav')).toBe('SAV');
    expect(fileMark('extra.csv')).toBe('CSV');
  });
});
