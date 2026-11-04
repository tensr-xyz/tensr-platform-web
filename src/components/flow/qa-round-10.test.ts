import { tableBaseCopy } from './table-base';
import { isTableSourceChanged, loadTablesSettled, tableSourceChangedDetail } from './stale-table';
import { numberTables } from './project-tables';
import { codingVersionStatus, shouldAdoptCodingVersion } from './coding-versions';
import { overlapsAny } from './stack-waves';

describe('QA round 10: stale table does not take down the report', () => {
  const fingerprint =
    'This table was built against dataset ds-wave (fingerprint abcdef123456…). The current data no longer matches (fingerprint fedcba654321…). What changed: the dataset content fingerprint changed (rows, weights, or values). Options: rebuild a new spec against the current dataset version, or point this spec at the original DatasetVersion it was built against. The stored spec was not mutated.';

  test.each([
    [
      'JSON detail body',
      Object.assign(new Error(JSON.stringify({ detail: fingerprint })), { status: 409 }),
    ],
    ['plain paragraph', Object.assign(new Error(fingerprint), { status: 409 })],
    [
      'nested detail',
      Object.assign(new Error(`{"detail":${JSON.stringify(fingerprint)}}`), { status: 409 }),
    ],
  ])('%s is recognised as a source change', (_name, error) => {
    expect(isTableSourceChanged(error)).toBe(true);
    expect(tableSourceChangedDetail(error)).toMatch(/fingerprint|built against/i);
  });

  test('a 422 or network failure is not a fingerprint mismatch', () => {
    expect(isTableSourceChanged(Object.assign(new Error('column missing'), { status: 422 }))).toBe(
      false
    );
    expect(isTableSourceChanged(new TypeError('Failed to fetch'))).toBe(false);
  });

  test('one stale table keeps the fresh one and never fails the settle', async () => {
    const rows = [
      { id: 'fresh', datasetId: 'a', label: 'Fresh', number: 1, filename: 'wave-a' },
      { id: 'stale', datasetId: 'a', label: 'Stale', number: 2, filename: 'wave-a' },
      { id: 'also', datasetId: 'b', label: 'Also fresh', number: 3, filename: 'wave-b' },
    ];
    const settled = await loadTablesSettled(rows, async row => {
      if (row.id === 'stale') {
        throw Object.assign(new Error(JSON.stringify({ detail: fingerprint })), { status: 409 });
      }
      return { ok: true, rows: [{ id: row.id }], base_label: `base for ${row.id}` };
    });
    expect(settled.ready.map(item => item.row.id)).toEqual(['fresh', 'also']);
    expect(settled.stale).toHaveLength(1);
    expect(settled.stale[0].id).toBe('stale');
    expect(settled.stale[0].label).toBe('Stale');
    expect(settled.failed).toHaveLength(0);
  });
});

describe('QA round 10: table numbers are never reused', () => {
  test.each([
    [
      'gaps after a restack',
      [
        { id: 't1', number: 1 },
        { id: 't2', number: 2 },
        { id: 't3', number: 3 },
        { id: 't6', number: 6 },
        { id: 't7', number: 7 },
      ],
      { id: 'new', number: 0 },
      8,
    ],
    [
      'only early numbers left',
      [
        { id: 'a', number: 1 },
        { id: 'b', number: 4 },
      ],
      { id: 'c', number: 0 },
      5,
    ],
    [
      'empty project takes 1',
      [] as { id: string; number: number }[],
      { id: 'first', number: 0 },
      1,
    ],
  ])('%s', (_name, existing, incoming, expected) => {
    const listed = numberTables([...existing, incoming]);
    const assigned = listed.find(row => row.id === incoming.id)!;
    expect(assigned.number).toBe(expected);
    const taken = new Set(existing.map(row => row.number));
    expect(taken.has(assigned.number)).toBe(false);
  });
});

describe('QA round 10: footer matches the table base, not the file n', () => {
  test.each([
    [
      'question base on the label',
      {
        base_label: 'base 295.5 weighted (unweighted 293)',
        weight: { weight_aware: true, weighted_n: 900, unweighted_n: 900 },
        respondent_n: 900,
      },
      '295.5',
      '293',
    ],
    [
      'unweighted question base',
      {
        base_label: 'Unweighted, n = 44',
        weight: { weight_aware: false, weighted_n: 200, unweighted_n: 200 },
        respondent_n: 200,
      },
      '44',
      '44',
    ],
    [
      'weight fields when they are the table base',
      {
        weight: { weight_aware: true, weighted_n: 54.2, unweighted_n: 50 },
      },
      '54.2',
      '50',
    ],
  ])('%s', (_name, book, weighted, unweighted) => {
    const copy = tableBaseCopy(book);
    expect(copy.line.toLowerCase()).not.toMatch(/base:\s*base\b/);
    expect(copy.foot).toContain(weighted);
    if (book.weight?.weight_aware || /weighted/i.test(copy.foot)) {
      expect(copy.foot).toContain(unweighted);
    }
    expect(copy.foot).not.toMatch(/^900 /);
  });
});

describe('QA round 10: stack picker excludes non-overlapping uploads', () => {
  test.each([
    [
      'sku-only upload',
      [{ name: 'sku' }, { name: 'price' }, { name: 'qty' }],
      [[{ name: 'region' }, { name: 'age' }, { name: 'brand' }]],
      false,
    ],
    [
      'half shared',
      [{ name: 'region' }, { name: 'age' }, { name: 'extra' }, { name: 'other' }],
      [[{ name: 'region' }, { name: 'age' }, { name: 'brand' }, { name: 'wave' }]],
      true,
    ],
    [
      'no columns in common',
      [{ name: 'alpha' }, { name: 'beta' }],
      [[{ name: 'gamma' }, { name: 'delta' }, { name: 'epsilon' }]],
      false,
    ],
  ])('%s', (_name, columns, references, expected) => {
    expect(overlapsAny(columns, references)).toBe(expected);
  });
});

describe('QA round 10: coding version name, date, and Use newer', () => {
  const files = [
    {
      id: 'coded-old',
      name: 'comments coded 1 Nov',
      lineageLabel: 'Coded comments · 1 Nov',
      producingOperation: 'open_end_coding',
      originId: 'raw',
      updatedAt: '2026-11-01T10:00:00Z',
    },
    {
      id: 'coded-new',
      name: 'comments coded 3 Nov',
      lineageLabel: 'Coded comments · 3 Nov',
      producingOperation: 'open_end_coding',
      originId: 'raw',
      parentId: 'coded-old',
      updatedAt: '2026-11-03T10:00:00Z',
    },
    {
      id: 'raw',
      name: 'raw comments',
      originId: 'raw',
      updatedAt: '2026-10-30T10:00:00Z',
    },
  ];

  test.each([
    ['in-use is older', 'coded-old', true, /Coded comments/],
    ['in-use is newest', 'coded-new', false, /Coded comments/],
    ['another phrasing of the in-use label', 'coded-old', true, /1 Nov|Nov/],
  ])('%s', (_name, inUse, newer, label) => {
    const status = codingVersionStatus(files, inUse);
    expect(status.inUseLabel).toMatch(label);
    expect(status.newerAvailable).toBe(newer);
    if (newer) expect(status.newerId).toBe('coded-new');
    expect(shouldAdoptCodingVersion(inUse, 'coded-new', files)).toBe(true);
  });
});
