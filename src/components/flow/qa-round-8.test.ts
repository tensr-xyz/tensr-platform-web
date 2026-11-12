import { applyScaleFlags, compareManyWaves, reversedCodes, waveCounts } from './stack-waves';
import { isAnswer, isNonAnswerTheme } from './coding-review-data';
import { themeRows } from './survey-screens';
import {
  loadProjectTables,
  numberTables,
  projectTableRows,
  projectTablesPath,
  savedTableTotal,
} from './project-tables';
import { shareRequest } from './report-pins';

describe('QA round 8', () => {
  test('6: a new agent table takes the next number and every other table keeps its number', () => {
    const listed = projectTableRows([
      { spec_id: 'second', dataset_id: 'a', table_number: 2 },
      { spec_id: 'first', dataset_id: 'a', table_number: 1 },
    ]);
    // The list is newest first, so the agent's new table sits on top without a saved number yet.
    const withAgent = numberTables([
      { id: 'agent', label: 'Q7', datasetId: 'a', filename: '', number: 0 },
      ...listed,
    ]);
    expect(withAgent.map(table => [table.id, table.number])).toEqual([
      ['agent', 3],
      ['second', 2],
      ['first', 1],
    ]);
  });

  test('6: numbers stay put when T1 is removed', () => {
    const listed = numberTables(
      projectTableRows([
        { spec_id: 'agent', dataset_id: 'a', table_number: 3 },
        { spec_id: 'second', dataset_id: 'a', table_number: 2 },
      ])
    );
    expect(listed.map(table => table.number)).toEqual([3, 2]);
  });

  test('6: tables listed before numbers were saved count up from the oldest', () => {
    const listed = numberTables(
      projectTableRows([{ spec_id: 'newest' }, { spec_id: 'middle' }, { spec_id: 'oldest' }], 'a')
    );
    expect(listed.map(table => [table.id, table.number])).toEqual([
      ['newest', 3],
      ['middle', 2],
      ['oldest', 1],
    ]);
  });
});

describe('QA round 8: tables load', () => {
  const calls: string[] = [];
  beforeEach(() => {
    calls.length = 0;
    global.fetch = jest.fn(async (url: RequestInfo | URL) => {
      calls.push(String(url));
      return new Response(JSON.stringify({ specs: [] }), { status: 200 });
    }) as typeof fetch;
  });

  test('7: the project list names its files and the open file list is not fetched twice', async () => {
    const filePage = Promise.resolve({ specs: [{ spec_id: 's1', dataset_id: 'a' }] });
    const rows = await loadProjectTables('p', 'a', { fileIds: ['a', 'b', 'a'], filePage });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain('/api/projects/p/tables?dataset_ids=a%2Cb');
    expect(rows.map(row => row.id)).toEqual(['s1']);
  });

  test('7: a pending stamp does not fetch the project list again', async () => {
    global.fetch = jest.fn(async (url: RequestInfo | URL) => {
      calls.push(String(url));
      return new Response(JSON.stringify({ specs: [], stamps_pending: true }), { status: 200 });
    }) as typeof fetch;
    await loadProjectTables('p', 'a', { fileIds: ['a'], filePage: Promise.resolve({ specs: [] }) });
    expect(calls).toHaveLength(1);
  });

  test('one overview load is shared by both callers', async () => {
    let calls = 0;
    const load = () => {
      calls += 1;
      return Promise.resolve({ ok: true });
    };
    const [first, second] = await Promise.all([
      shareRequest('overview?dataset_ids=a', load),
      shareRequest('overview?dataset_ids=a', load),
    ]);
    expect(calls).toBe(1);
    expect(first).toEqual(second);
  });

  test('7: without file ids it falls back to the plain project list', () => {
    expect(projectTablesPath('p')).toBe('/api/projects/p/tables');
  });

  test('a saved table counts once across the live list and the rebuild list', () => {
    expect(
      savedTableTotal([
        [{ id: 'live' }, { id: 'shared' }],
        [{ id: 'shared' }, { id: 'rebuild' }],
      ])
    ).toBe(3);
  });
});

describe('QA round 8: non-answers', () => {
  test.each([
    'Nothing to add',
    'nothing to add.',
    'n/a',
    'N/A',
    'none',
    'None.',
    'no comment',
    'No comments',
  ])('8: "%s" is not an answer', text => expect(isAnswer(text)).toBe(false));

  test.each(['No, the price was too high', 'Nothing beats the service'])(
    '8: "%s" is an answer',
    text => expect(isAnswer(text)).toBe(true)
  );

  test('8: the No comment theme is not in the frame', () => {
    const cell = { banner_id: 'total', unweighted_n: 9, column_unweighted_n: 348 };
    const rows = themeRows(
      [
        { id: 'no_comment', label: 'No comment', cells: [cell] },
        { id: 'price', label: 'Price', cells: [cell] },
      ] as never,
      0
    );
    expect(rows.map(row => row.label)).toEqual(['Price', 'Not yet coded']);
    expect(isNonAnswerTheme('Nothing to add')).toBe(true);
    expect(isNonAnswerTheme('Price')).toBe(false);
  });
});

describe('QA round 8: stack scale check', () => {
  const names: Record<string, string> = { en: 'cars_EN', de: 'cars_DE', fr: 'cars_FR' };
  test('9: a column whose means sit at opposite ends goes under to check with Reverse scale', () => {
    const labels = { '1': 'Strongly disagree', '5': 'Strongly agree' };
    const files = ['en', 'de', 'fr'].map(id => ({
      name: names[id],
      columns: [{ name: 'Q7', value_labels: labels }, { name: 'region' }],
    }));
    const rows = applyScaleFlags(
      compareManyWaves(files),
      [{ column: 'Q7', low: 1, high: 5, means: { en: 4.4, de: 4.3, fr: 1.5 }, flip_ids: ['fr'] }],
      id => names[id]
    );
    const q7 = rows.find(row => row.left === 'Q7')!;
    expect(q7.kind).toBe('check');
    expect(q7.labelsDiffer).toBe(true);
    expect(q7.scaleFlip).toEqual(['fr']);
    expect(q7.reason).toContain(
      'Means at opposite ends of the 1–5 scale (cars_EN 4.4, cars_DE 4.3, cars_FR 1.5)'
    );
    expect(q7.reason).toContain('cars_FR');
    expect(rows.find(row => row.left === 'region')!.kind).toBe('matched');
    expect(waveCounts(rows).check).toBe(1);
    expect(reversedCodes(q7.scaleCodes!)).toEqual({
      '1': '5',
      '2': '4',
      '3': '3',
      '4': '2',
      '5': '1',
    });
  });
});
