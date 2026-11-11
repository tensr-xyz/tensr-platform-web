import {
  contextMark,
  fileMark,
  sourceFileNote,
  sourceRowCount,
  orderedVersionGroup,
  sourceFileName,
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

  it('lists every version of one upload with the newest first', () => {
    const ordered = orderedVersionGroup([
      { dataset_id: 'early', updated_at: '2026-01-02T00:00:00Z' },
      { dataset_id: 'late', updated_at: '2026-03-02T00:00:00Z' },
      { dataset_id: 'mid', created_at: '2026-02-02T00:00:00Z' },
    ]);
    expect(ordered.map(file => file.dataset_id)).toEqual(['late', 'mid', 'early']);
  });

  it('marks context documents by kind', () => {
    expect(contextMark('questionnaire')).toBe('PDF');
    expect(contextMark('brief')).toBe('DOC');
    expect(contextMark('report')).toBe('PPT');
    expect(fileMark('wave.sav')).toBe('SAV');
    expect(fileMark('extra.csv')).toBe('CSV');
  });

  it('shows the file name and never the id', () => {
    expect(
      sourceFileName({
        id: 'fa975e35-6c23-4a11-8abc-1234567890ab',
        original_filename: 'fa975e35-6c23-4a11-8abc-1234567890ab.sav',
        source_filenames: ['coffee_tracker_demo.sav'],
      })
    ).toBe('coffee_tracker_demo.sav');
    expect(
      sourceFileName({
        id: 'fa975e35-6c23-4a11-8abc-1234567890ab',
        lineage_label: 'Coded',
      })
    ).toBe('Coded');
  });
});
