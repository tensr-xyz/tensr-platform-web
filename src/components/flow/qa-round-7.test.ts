import { datasetPreviewFromPage, twoGroupColumnNames } from '@/lib/analysis-definitions';
import {
  compareManyWaves,
  compareWaves,
  dedupeUploads,
  overlapsAny,
  sharedColumnShare,
} from './stack-waves';
import { mergeTableLists } from './project-tables';
import { agentSessionId, tableBodyFromAgentRun, themeRows } from './survey-screens';

describe('QA round 7', () => {
  test('1: an agent table is rebuilt from the run request with every row, and saved', () => {
    const body = tableBodyFromAgentRun([
      {
        name: 'run_analysis',
        procedure: 'banner_table',
        analysis_type: 'banner_table',
        request_body: {
          stub_column: 'Q7',
          banner_column: 'region',
          stubs: [{ column: 'Q7', values: [] }],
          nets: [{ label: 'Top 2 Box', values: ['4', '5'] }],
          significance_display: 'column_letters',
          low_base_threshold: 30,
          weight: 'rake_weight',
        },
      },
    ]);
    expect(body).toEqual({
      stubs: [{ column: 'Q7', nets: [{ label: 'Top 2 Box', values: ['4', '5'] }] }],
      banner: [{ column: 'region' }],
      statistics: ['column_proportion'],
      significance_display: 'column_letters',
      nest_banners: false,
      low_base_threshold: 30,
      weight: 'rake_weight',
      save: true,
    });
    expect(tableBodyFromAgentRun([{ procedure: 'frequencies', request_body: {} }])).toBeNull();
    expect(
      tableBodyFromAgentRun([
        {
          procedure: 'frequencies',
          request_body: {
            columns: ['sat_brewco'],
            row_filters: [{ column: 'region', op: 'eq', value: 'London' }],
            weight_column: 'none',
          },
        },
      ])
    ).toEqual({
      stubs: [{ column: 'sat_brewco' }],
      banner: [],
      statistics: ['column_proportion'],
      significance_display: 'none',
      nest_banners: false,
      filter_ref: { filters: [{ column: 'region', op: 'eq', value: 'London' }], combine: 'and' },
      weight: 'none',
      save: true,
    });
  });

  test('1: the open file tables show even when the project list misses them', () => {
    const merged = mergeTableLists(
      [{ id: 't1', label: 'Q7 by region', datasetId: 'old', filename: 'cars_EN.sav' }],
      [
        { id: 't2', label: 'Agent table', datasetId: 'new', filename: '' },
        { id: 't1', label: 'Q7 by region', datasetId: 'old', filename: '' },
      ]
    );
    expect(merged.map(table => table.id)).toEqual(['t2', 't1']);
  });

  test('1: the session id is read from turn_state', () => {
    expect(agentSessionId({ turn_state: { session_id: 'abc' } })).toBe('abc');
    expect(agentSessionId({ session_id: 'top' })).toBe('top');
  });

  test('3: grouping offers the 2-group variables, read by variable name, not label', () => {
    const preview = datasetPreviewFromPage({
      headers: ['Gender', 'Owns car A', 'Source'],
      variable_names: ['gender', 'owns_A', 'source_wave'],
      rows: [
        ['F', '1', 'EN'],
        ['M', '0', 'DE'],
        ['F', '1', 'FR'],
      ],
    });
    expect(preview?.headers).toEqual(['gender', 'owns_A', 'source_wave']);
    const schema = [
      { name: 'gender', type: 'categorical' },
      { name: 'owns_A', type: 'categorical', value_labels: { '0': 'No', '1': 'Yes' } },
      { name: 'source_wave', type: 'categorical' },
    ] as never;
    expect(twoGroupColumnNames(schema, preview)).toEqual(['gender', 'owns_A']);
  });

  test('4: translated labels on the same codes are info; a 4th code is a mismatch', () => {
    const en = { name: 'Q7', value_labels: { '1': 'Disagree', '5': 'Agree' } };
    const fr = { name: 'Q7', value_labels: { '1': "Pas d'accord", '5': "D'accord" } };
    const two = compareWaves([en], [fr], 'cars_EN', 'cars_FR')[0];
    expect(two.kind).toBe('matched');
    expect(two.reason).toBe('Same codes · labels translated');
    const regionEN = { name: 'region', value_labels: { '1': 'North', '2': 'South', '3': 'East' } };
    const regionDE = {
      name: 'region',
      value_labels: { '1': 'Nord', '2': 'Süd', '3': 'Ost', '4': 'Südost' },
    };
    const many = compareManyWaves([
      { name: 'cars_EN', columns: [regionEN, en] },
      { name: 'cars_DE', columns: [regionDE, en] },
      { name: 'cars_FR', columns: [regionDE, fr] },
    ]);
    const region = many.find(row => row.left === 'region');
    expect(region?.kind).toBe('check');
    expect(region?.reason).toBe('code 4 (Südost) only in cars_DE, cars_FR');
    const q7 = many.find(row => row.left === 'Q7');
    expect(q7?.kind).toBe('matched');
    expect(q7?.reason).toBe('Same codes · labels translated in cars_FR');
  });

  test('5: one row per upload, and only uploads that share columns', () => {
    const rows = dedupeUploads([
      { dataset_id: 'a', original_filename: 'cars_EN.sav', n_rows: 900, n_cols: 12 },
      { dataset_id: 'b', original_filename: 'cars_EN.sav', n_rows: 900, n_cols: 12 },
      { dataset_id: 'c', original_filename: 'cars_EN.sav', n_rows: 10, n_cols: 12 },
    ]);
    expect(rows.map(row => row.dataset_id)).toEqual(['a', 'c']);
    const cars = [{ name: 'Q7' }, { name: 'region' }, { name: 'aware_A' }, { name: '_row_uid' }];
    const other = [{ name: 'Q7' }, { name: 'region' }, { name: 'owns_A' }];
    const unrelated = [{ name: 'comments' }, { name: 'agree_value' }];
    expect(sharedColumnShare(cars, other)).toBeCloseTo(2 / 3);
    expect(overlapsAny(other, [cars])).toBe(true);
    expect(overlapsAny(unrelated, [cars])).toBe(false);
  });

  test('6: Not yet coded stays as a row at zero', () => {
    const cell = { banner_id: 'total', unweighted_n: 9, column_unweighted_n: 348 };
    const rows = themeRows([{ id: 'a', label: 'Price', cells: [cell] }] as never, 0);
    expect(rows.map(row => row.label)).toEqual(['Price', 'Not yet coded']);
  });
});
