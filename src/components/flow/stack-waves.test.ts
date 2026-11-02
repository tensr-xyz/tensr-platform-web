import { compareWaves, stackMappings, waveCounts } from './stack-waves';

describe('stack waves', () => {
  it('matches shared names and flags columns that are only on one side', () => {
    const rows = compareWaves(
      [
        { name: 'region', value_labels: { '1': 'North', '2': 'South' } },
        { name: 'q3' },
        { name: 'score', value_labels: { '1': 'Low', '2': 'High' } },
      ],
      [
        { name: 'region', value_labels: { '1': 'North', '2': 'South', '3': 'East' } },
        { name: 'q3' },
        { name: 'comment' },
      ],
      'wave-a.csv',
      'wave-b.csv'
    );
    expect(rows.find(row => row.left === 'q3')?.kind).toBe('matched');
    expect(rows.find(row => row.left === 'region')?.kind).toBe('check');
    expect(rows.find(row => row.left === 'region')?.reason).toContain('3 only on the right');
    expect(rows.find(row => row.left === 'score')?.reason).toBe('Only in wave-a.csv');
    expect(rows.find(row => row.right === 'comment')?.kind).toBe('new');
    expect(waveCounts(rows)).toEqual({ matched: 1, check: 2, fresh: 1 });
  });

  it('turns a treat-as-same choice into a rename and leaves the rest accepted', () => {
    const rows = compareWaves([{ name: 'score' }], [{ name: 'q3' }], 'a.csv', 'b.csv');
    const score = rows[0];
    const mappings = stackMappings(rows, {
      [score.id]: { decision: 'override', target: 'q3' },
    });
    expect(mappings[0]).toMatchObject({
      source_column: 'score',
      target_column: 'q3',
      decision: 'override',
    });
    expect(mappings[1]).toMatchObject({ source_column: 'q3', decision: 'accept' });
  });
});
