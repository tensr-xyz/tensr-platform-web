import {
  loadProjectTables,
  numberTables,
  projectTableRows,
  projectTablesPath,
} from './project-tables';

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

  test('7: without file ids it falls back to the plain project list', () => {
    expect(projectTablesPath('p')).toBe('/api/projects/p/tables');
  });
});
