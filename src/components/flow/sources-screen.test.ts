import {
  contextMark,
  fileMark,
  filesInProject,
  resolveStackedSource,
  sourceFileNote,
  sourceRowCount,
  orderedVersionGroup,
  sourceFileName,
  sourceVersionTitle,
  workingVersionSections,
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
    expect(sourceFileNote({ parent_dataset_id: 'parent' })).toBe('New version');
    expect(
      sourceFileNote({
        producing_operation: 'qualtrics_pull',
        lineage_label: 'Qualtrics · Wave 1 brand check',
      })
    ).toBe('Qualtrics · Wave 1 brand check');
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
      'coded themes',
      'standardised',
      'derived',
      'raked to region',
      'raked to age, region',
    ];
    for (const label of labels) {
      const titled = sourceVersionTitle({
        parent_dataset_id: 'parent-file',
        lineage_label: label,
        created_at: '2026-11-05T15:42:07Z',
      });
      const headed = label.charAt(0).toUpperCase() + label.slice(1);
      expect(titled.startsWith(`${headed} · `)).toBe(true);
      expect(titled).toMatch(/\d{1,2} \w{3} \d{2}:\d{2}:\d{2}$/);
      expect(titled).not.toBe(label);
    }
    expect(
      sourceVersionTitle({
        parent_dataset_id: 'parent-file',
        lineage_label: 'raked to region · 5 Nov 15:42:07',
        created_at: '2026-11-05T15:42:07Z',
      })
    ).toBe('Raked to region · 5 Nov 15:42:07');
    expect(sourceVersionTitle({ original_filename: 'panel.sav' })).toBe('panel.sav');
    expect(
      sourceVersionTitle({
        parent_dataset_id: 'parent-file',
        original_filename: 'cars_EN + DE + FR',
        lineage_label: 'fused',
        created_at: '2026-11-05T15:42:07Z',
      })
    ).toMatch(/^cars_EN \+ DE \+ FR · /);
  });

  it('names versions by the operation, not a generic file-style weighted stamp', () => {
    expect(
      sourceVersionTitle({
        parent_dataset_id: 'parent-file',
        original_filename: 'coffee_tracker_demo - weighted 16 Nov 00:42',
        lineage_label: 'raked to region · 16 Nov 00:42:01',
        created_at: '2026-11-16T00:42:01Z',
      })
    ).toBe('Raked to region · 16 Nov 00:42:01');
    expect(
      sourceVersionTitle({
        parent_dataset_id: 'parent-file',
        original_filename: 'coffee_tracker_demo.sav',
        lineage_label: 'coded themes · 16 Nov 00:42:15',
        created_at: '2026-11-16T00:42:15Z',
      })
    ).toBe('Coded themes · 16 Nov 00:42:15');
  });

  it('lists every version of one upload with the newest first', () => {
    const ordered = orderedVersionGroup([
      { dataset_id: 'early', updated_at: '2026-01-02T00:00:00Z' },
      { dataset_id: 'late', updated_at: '2026-03-02T00:00:00Z' },
      { dataset_id: 'mid', created_at: '2026-02-02T00:00:00Z' },
    ]);
    expect(ordered.map(file => file.dataset_id)).toEqual(['late', 'mid', 'early']);
  });

  it('puts every older version under one shared fold', () => {
    const sections = workingVersionSections([
      {
        dataset_id: 'a-new',
        origin_dataset_id: 'upload-a',
        parent_dataset_id: 'upload-a',
        updated_at: '2026-03-01T00:00:00Z',
      },
      {
        dataset_id: 'a-old',
        origin_dataset_id: 'upload-a',
        parent_dataset_id: 'upload-a',
        updated_at: '2026-01-01T00:00:00Z',
      },
      {
        dataset_id: 'b-new',
        origin_dataset_id: 'upload-b',
        parent_dataset_id: 'upload-b',
        updated_at: '2026-04-01T00:00:00Z',
      },
      {
        dataset_id: 'b-old',
        origin_dataset_id: 'upload-b',
        parent_dataset_id: 'upload-b',
        updated_at: '2026-02-01T00:00:00Z',
      },
    ]);
    expect(sections.tips.map(file => file.dataset_id)).toEqual(['b-new', 'a-new']);
    expect(sections.older.map(file => file.dataset_id)).toEqual(['b-old', 'a-old']);
    expect(sections.tipIdFor(sections.older[0])).toBe('b-new');
    expect(sections.tipIdFor(sections.older[1])).toBe('a-new');
  });

  it('keeps a raked working version on Sources when project_id was blank', () => {
    const listed = filesInProject(
      [
        {
          dataset_id: 'upload',
          project_id: 'coffee',
          original_filename: 'coffee_tracker_demo.csv',
        },
        {
          dataset_id: 'raked',
          project_id: '',
          parent_dataset_id: 'upload',
          original_filename: 'coffee_tracker_demo - 6 Nov 00:20',
        },
        {
          dataset_id: 'other',
          project_id: 'elsewhere',
          parent_dataset_id: 'upload',
        },
      ],
      'coffee'
    );
    expect(listed.map(file => file.dataset_id)).toEqual(['upload', 'raked']);
  });

  it('opens a stacked source when the file is in the library, else says why not', () => {
    const library = [
      {
        dataset_id: 'de',
        original_filename: 'cars_DE.sav',
        project_id: 'other',
      },
    ];
    expect(resolveStackedSource('cars_DE.sav', library).file?.dataset_id).toBe('de');
    expect(resolveStackedSource('cars_FR.sav', library)).toEqual({
      file: null,
      note: 'Used in a stacked file · not on this project',
    });
  });

  it('marks context documents by kind', () => {
    expect(contextMark('questionnaire')).toBe('PDF');
    expect(contextMark('brief')).toBe('DOC');
    expect(contextMark('report')).toBe('PPT');
    expect(fileMark('wave.sav')).toBe('SAV');
    expect(fileMark('wave.zsav')).toBe('SAV');
    expect(fileMark('extra.csv')).toBe('CSV');
    expect(fileMark('panel.tsv')).toBe('TSV');
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
