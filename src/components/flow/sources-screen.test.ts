import { contextMark, fileMark, sourceFileNote, sourceRowCount } from './sources-screen';

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

  it('marks context documents by kind', () => {
    expect(contextMark('questionnaire')).toBe('PDF');
    expect(contextMark('brief')).toBe('DOC');
    expect(contextMark('report')).toBe('PPT');
    expect(fileMark('wave.sav')).toBe('SAV');
    expect(fileMark('extra.csv')).toBe('CSV');
  });
});
