import {
  datasetFileLabel,
  defaultTableWeight,
  isTableWeightColumn,
  savedTableMatches,
  stubHeaderLabel,
  tablePickerColumns,
} from '@/components/flow/survey-screens';

const FILES = [
  { original_filename: 'harbour_wave.csv', source_filenames: [] },
  { original_filename: 'till_receipts.sav', source_filenames: [] },
  { original_filename: 'clinic_notes.xlsx', source_filenames: [] },
  { original_filename: 'lane_counts.parquet', source_filenames: [] },
  { original_filename: 'shelf_audit.csv', source_filenames: [] },
  { original_filename: 'depot_scan.sav', source_filenames: [] },
  { original_filename: 'garden_plots.csv', source_filenames: [] },
  { original_filename: 'ferry_loads.xlsx', source_filenames: [] },
  { original_filename: 'bakery_hours.csv', source_filenames: [] },
  { original_filename: 'quay_tides.sav', source_filenames: [] },
  {
    original_filename: '8c1d0e2a-4b3f-4a11-9c22-1a2b3c4d5e6f',
    source_filenames: ['named_file.csv'],
  },
  { original_filename: '', source_filenames: ['second_file.sav'] },
];

describe('table screen defaults', () => {
  it.each(FILES)('shows a file name for $original_filename', row => {
    const label = datasetFileLabel(row);
    expect(label).not.toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(label.length).toBeGreaterThan(0);
  });

  it('uses the active weight, including the internal raked copy', () => {
    expect(defaultTableWeight('raked', ['raked', 'other'])).toBe('raked');
    expect(defaultTableWeight('_weight', ['raked'])).toBe('raked');
    expect(defaultTableWeight('', ['raked'])).toBe('');
  });

  it('leaves ids, open text, and weights out of the stub list', () => {
    const columns = [
      { name: 'respondent_id', label: 'Respondent', labels: {}, type: 'id' },
      { name: 'note', label: 'Comment', labels: {}, type: 'text' },
      { name: 'design_w', label: 'Design weight', labels: {}, type: 'numeric', role: 'weight' },
      {
        name: 'q_region',
        label: 'Region',
        labels: { '1': 'North', '2': 'South' },
        type: 'numeric',
      },
      { name: 'q_score', label: 'Score', labels: {}, type: 'numeric' },
      { name: 'q_brand', label: 'Brand', labels: { a: 'One', b: 'Two' }, type: 'string' },
      { name: 'q_time', label: 'Time', labels: {}, type: 'numeric' },
      { name: 'q_site', label: 'Site', labels: { x: 'East' }, type: 'string' },
      { name: 'q_wave', label: 'Wave', labels: {}, type: 'numeric' },
      { name: 'q_item', label: 'Item', labels: { y: 'Yes' }, type: 'string' },
      { name: '_row_uid', label: 'Row', labels: {}, type: 'id' },
      { name: 'comment_2', label: 'Another comment', labels: {}, type: 'string' },
      { name: 'case_key', label: 'Respondent ID', labels: {}, type: 'numeric' },
      { name: 'mass', label: 'Design weight', labels: {}, type: 'numeric' },
      { name: 'why', label: 'Why that score?', labels: {}, type: 'string' },
    ];
    const names = tablePickerColumns(columns, []).map(column => column.name);
    expect(names).toEqual([
      'q_region',
      'q_score',
      'q_brand',
      'q_time',
      'q_site',
      'q_wave',
      'q_item',
    ]);
    expect(isTableWeightColumn({ name: 'mass', label: 'Design weight' })).toBe(true);
  });

  it('uses the question label for the stub header and the rail name', () => {
    expect(
      stubHeaderLabel({ column: 'q_sat', label: 'q_sat' }, [
        { name: 'q_sat', label: 'How satisfied are you overall?' },
      ])
    ).toBe('How satisfied are you overall?');
    expect(stubHeaderLabel({ column: 'q_sat', label: 'How satisfied are you overall?' }, [])).toBe(
      'How satisfied are you overall?'
    );
  });

  it('keeps Save until the table is in the saved list', () => {
    expect(savedTableMatches(false, 'city', [], 'city', [])).toBe(false);
    expect(savedTableMatches(true, 'city', ['region'], 'city', ['region'])).toBe(true);
    expect(savedTableMatches(true, 'city', [], 'city', ['region'])).toBe(false);
  });
});
