import {
  distinctTables,
  findingFromStale,
  findingFromTable,
  findingsWithOutOfDate,
  missingBanner,
  outOfDateLine,
  partitionLiveAndStale,
  reportTableFromBook,
  shownPercent,
  titledWithQuestions,
  type ReportTable,
} from './flow-report';
import { liveOfTotalLabel } from '@/components/flow/project-tables';

const table: ReportTable = {
  id: 'spec-1',
  label: 'agree by region',
  index: 1,
  tested: true,
  decimals: 1,
  columns: [
    { id: 'north', label: 'region=North', letter_slot: 'A' },
    { id: 'east', label: 'region=East', letter_slot: 'B' },
  ],
  letters: [{ stub_row_id: 'price', banner_id: 'east', letter: 'A' }],
  rows: [
    {
      id: 'staff',
      label: 'Staff',
      kind: 'value',
      cells: [
        {
          banner_id: 'north',
          percent: 2,
          unweighted_n: 2,
          column_unweighted_n: 80,
          low_base: true,
        },
        { banner_id: 'east', percent: 4, unweighted_n: 3, column_unweighted_n: 81, low_base: true },
      ],
    },
    {
      id: 'price',
      label: 'Price too high',
      kind: 'value',
      cells: [
        { banner_id: 'north', percent: 7.5, unweighted_n: 6, column_unweighted_n: 80 },
        { banner_id: 'east', percent: 16, unweighted_n: 13, column_unweighted_n: 81 },
      ],
    },
  ],
};

const flat: ReportTable = {
  ...table,
  id: 'spec-2',
  index: 2,
  letters: [],
  rows: [
    {
      id: 'agree',
      label: 'Agree',
      kind: 'value',
      cells: [
        { banner_id: 'north', percent: 40 },
        { banner_id: 'east', percent: 38 },
      ],
    },
    {
      id: 'top2',
      label: 'Top 2',
      kind: 'net',
      cells: [
        { banner_id: 'north', percent: 85.5 },
        { banner_id: 'east', percent: 84 },
      ],
    },
  ],
};

describe('report findings', () => {
  it('leads with Top 2 when another row has the larger gap', () => {
    const scale: ReportTable = {
      ...table,
      id: 'sat',
      letters: [
        { stub_row_id: 'neither', banner_id: 'east', letter: 'A' },
        { stub_row_id: 'top2', banner_id: 'north', letter: 'B' },
      ],
      rows: [
        {
          id: 'neither',
          label: 'Neither',
          kind: 'value',
          cells: [
            { banner_id: 'north', percent: 19 },
            { banner_id: 'east', percent: 41 },
          ],
        },
        {
          id: 'top2',
          label: 'Top 2',
          kind: 'net',
          cells: [
            { banner_id: 'north', percent: 62 },
            { banner_id: 'east', percent: 48 },
          ],
        },
      ],
    };
    const finding = findingFromTable(scale, null, null);
    expect(finding.headline).toBe('Top 2: 62% among North vs 48% among East.');
    expect(finding.significant).toBe(true);
  });

  it('leads with the mean when the table has no Yes or Top 2 row', () => {
    const means: ReportTable = {
      ...table,
      id: 'mean',
      letters: [{ stub_row_id: 'other', banner_id: 'east', letter: 'A' }],
      rows: [
        {
          id: 'other',
          label: 'Other',
          kind: 'value',
          cells: [
            { banner_id: 'north', percent: 10 },
            { banner_id: 'east', percent: 40 },
          ],
        },
        {
          id: 'mean',
          label: 'Mean',
          kind: 'mean',
          cells: [
            { banner_id: 'north', percent: 3.2 },
            { banner_id: 'east', percent: 4.1 },
          ],
        },
      ],
    };
    const finding = findingFromTable(means, null, null);
    expect(finding.headline.startsWith('Mean')).toBe(true);
  });

  it('leads with the largest significant gap in plain English', () => {
    const finding = findingFromTable(table, null, null);
    expect(finding.headline).toBe('Price too high: 16% among East vs 7.5% among North.');
    expect(finding.support).toBe('That 8.5-point gap is significant at 95%.');
    expect(finding.citation).toBe('T1');
    expect(finding.significant).toBe(true);
    expect(finding.bars).toEqual([
      { label: 'North', percent: 7.5 },
      { label: 'East', percent: 16 },
    ]);
    expect(`${finding.headline} ${finding.support}`).not.toMatch(/\brow \d/i);
  });

  it('leads with Top 2 when nothing differs, and says so', () => {
    const finding = findingFromTable(flat, null, null);
    expect(finding.headline).toBe('Top 2 is highest in North at 85.5% and lowest in East at 84%.');
    expect(finding.support).toBe('None of the differences between columns is significant at 95%.');
    expect(finding.citation).toBe('T2');
    expect(finding.significant).toBe(false);
  });

  it('uses the selected rows when a filter cut is applied', () => {
    const finding = findingFromTable(table, null, [{ tableId: 'spec-1', number: 1 }]);
    expect(finding.lowBase).toBe(true);
    expect(finding.headline).toBe('Staff is highest in East at 4% and lowest in North at 2%.');
    expect(finding.citation).toBe('T1');
  });

  it('describes one segment without a comparison', () => {
    const finding = findingFromTable(flat, 'east', null);
    expect(finding.headline).toBe('Top 2 is 84% in East.');
    expect(finding.bars).toEqual([{ label: 'Agree', percent: 38 }]);
  });

  it('never shows a bare code for an unlabelled 0/1 table', () => {
    const book = {
      stubs: [{ column: 'aware_A' }],
      banner_columns: [
        { id: 'total', label: 'Total' },
        {
          id: 'owns_A=0.0',
          label: '0',
          letter_slot: 'A',
          codes: [{ column: 'owns_A', code: '0.0' }],
        },
        {
          id: 'owns_A=1.0',
          label: '1',
          letter_slot: 'B',
          codes: [{ column: 'owns_A', code: '1.0' }],
        },
      ],
      letters: [{ stub_row_id: 'aware_A:1.0', banner_id: 'owns_A=1.0', letter: 'A' }],
      rows: [
        { id: 'aware_A:0.0', label: '0', kind: 'value', cells: [] },
        {
          id: 'aware_A:1.0',
          label: '1',
          kind: 'value',
          cells: [
            { banner_id: 'owns_A=0.0', percent: 50 },
            { banner_id: 'owns_A=1.0', percent: 100 },
          ],
        },
      ],
    };
    const finding = findingFromTable(reportTableFromBook('t1', 'aware', 1, book), null, null);
    expect(finding.headline).toBe('aware_A: 100% among owns_A vs 50% among no owns_A.');
    const labelled = reportTableFromBook('t1', 'aware', 1, book, {
      aware_A: { '1': 'Aware', '0': 'Not aware' },
      owns_A: { '1': 'owners', '0': 'non-owners' },
    });
    expect(findingFromTable(labelled, null, null).headline).toBe(
      'Aware: 100% among owners vs 50% among non-owners.'
    );
  });

  it('leads a yes/no question with the yes row', () => {
    const book = {
      stubs: [{ column: 'aware' }],
      banner_columns: [
        { id: 'total', label: 'Total' },
        { id: 'midlands', label: 'Midlands', letter_slot: 'A' },
        { id: 'london', label: 'London', letter_slot: 'B' },
      ],
      letters: [
        { stub_row_id: 'aware:1', banner_id: 'london', letter: 'A' },
        { stub_row_id: 'aware:0', banner_id: 'midlands', letter: 'B' },
      ],
      rows: [
        {
          id: 'aware:1',
          label: 'Yes',
          kind: 'value',
          cells: [
            { banner_id: 'midlands', percent: 68 },
            { banner_id: 'london', percent: 88 },
          ],
        },
        {
          id: 'aware:0',
          label: 'No',
          kind: 'value',
          cells: [
            { banner_id: 'midlands', percent: 32 },
            { banner_id: 'london', percent: 12 },
          ],
        },
      ],
    };
    const finding = findingFromTable(
      reportTableFromBook('t1', 'Have you heard of Brew & Co?', 1, book),
      null,
      null
    );
    expect(finding.headline).toBe('Yes: 88% among London vs 68% among Midlands.');
  });

  it('keeps the number a table was given when it is the only one left', () => {
    const finding = findingFromTable({ ...table, index: 6 }, null, null);
    expect(finding.citation).toBe('T6');
    expect(finding.eyebrow.startsWith('T6')).toBe(true);
    const unnumbered = findingFromTable({ ...table, index: 0 }, null, null);
    expect(unnumbered.citation).toBe('');
  });

  it('names the saved version and the version in use', () => {
    expect(outOfDateLine('Wave 1', 'Wave 2')).toBe('Built on Wave 1. Wave 2 is in use now.');
    expect(outOfDateLine('Wave 1', 'Wave 1')).toBe(
      'Built on Wave 1. The data in that file has changed.'
    );
    expect(outOfDateLine('', '')).toBe('The data changed after this was saved.');
  });

  it('shows an out-of-date table once, below the live findings', () => {
    const live = findingFromTable({ ...table, index: 2 }, null, null);
    const stale = findingFromStale({ id: 'old', label: 'Satisfaction by region', number: 1 });
    const shown = findingsWithOutOfDate([live, { ...stale, headline: 'duplicate' }], [stale]);
    expect(shown.map(item => item.id)).toEqual([live.id, stale.id]);
    expect(stale.headline).toBe('Satisfaction by region');
  });

  it('replaces variable names with labels, including capitalised ones and Source file', () => {
    const titled = titledWithQuestions('region by gender', [
      { name: 'region', label: 'Which region do you live in?' },
      { name: 'gender', label: 'Gender' },
    ]);
    expect(titled).toBe('Which region do you live in? by Gender');
    expect(titledWithQuestions('aware × source_wave × Gender', [])).toBe(
      'aware × Source file × Gender'
    );
    expect(
      titledWithQuestions('Q7 by source_wave', [{ name: 'source_wave', label: 'Source file' }])
    ).toBe('Q7 by Source file');
  });

  it('keeps out-of-date tables out of the live list so the UI can collapse them', () => {
    const live = findingFromTable({ ...table, index: 2 }, null, null);
    const stale = findingFromStale({ id: 'old', label: 'Satisfaction by region', number: 1 });
    const parts = partitionLiveAndStale([live, { ...stale, headline: 'duplicate' }], [stale]);
    expect(parts.live.map(item => item.id)).toEqual([live.id]);
    expect(parts.outdated.map(item => item.id)).toEqual([stale.id]);
  });

  it('keeps one finding when saved tables repeat or overlap', () => {
    const make = (id: string, key: string) => ({ ...table, id, key });
    const kept = distinctTables([
      make('a', 'aware|owns'),
      make('b', 'aware|owns'),
      make('c', 'aware|owns,region'),
      make('d', 'likes|owns'),
    ]);
    expect(kept.map(item => item.id)).toEqual(['c', 'd']);
  });

  it('excludes Not answered at every nest level from findings', () => {
    expect(missingBanner({ id: 'miss', label: 'Not answered' })).toBe(true);
    expect(missingBanner({ id: 'nested', label: 'Not answered × Female' })).toBe(true);
    expect(missingBanner({ id: 'ok', label: 'North × Female' })).toBe(false);
    const book = {
      stubs: [{ column: 'q' }],
      banner_columns: [
        { id: 'total', label: 'Total' },
        { id: 'north', label: 'North', letter_slot: 'A' },
        { id: 'miss-f', label: 'Not answered × Female', letter_slot: 'B' },
        { id: 'south', label: 'South', letter_slot: 'C' },
      ],
      letters: [],
      rows: [
        {
          id: 'q:1',
          label: 'Yes',
          kind: 'value',
          cells: [
            { banner_id: 'north', percent: 40 },
            { banner_id: 'miss-f', percent: 0 },
            { banner_id: 'south', percent: 55 },
          ],
        },
      ],
      spec: { decimals: { column_proportion: 0 } },
    };
    const finding = findingFromTable(reportTableFromBook('t1', 'Yes', 1, book), null, null);
    expect(finding.headline).toBe('Yes is highest in South at 55% and lowest in North at 40%.');
    expect(finding.headline).not.toMatch(/Not answered/i);
    expect(finding.decimals).toBe(0);
  });

  it('uses the table percent decimals in the finding', () => {
    expect(shownPercent(56.3, 0)).toBe('56%');
    expect(shownPercent(56.3, 1)).toBe('56.3%');
    const book = {
      stubs: [{ column: 'q' }],
      banner_columns: [
        { id: 'total', label: 'Total' },
        { id: 'a', label: 'A', letter_slot: 'A' },
      ],
      letters: [],
      rows: [
        {
          id: 'q:1',
          label: 'Agree',
          kind: 'value',
          cells: [{ banner_id: 'a', percent: 56.3 }],
        },
      ],
      spec: { decimals: { column_proportion: 0 } },
    };
    expect(findingFromTable(reportTableFromBook('t1', 'Agree', 1, book), null, null).headline).toBe(
      'Agree is 56%.'
    );
  });

  it('names how many tables are live of every saved table', () => {
    expect(liveOfTotalLabel(8, 15)).toBe('8 live of 15');
    expect(liveOfTotalLabel(15, 15)).toBe('15 live tables');
    expect(liveOfTotalLabel(1, 1)).toBe('1 live table');
    expect(liveOfTotalLabel(0, 0)).toBe('0 saved tables');
  });
});
