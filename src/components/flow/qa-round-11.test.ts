import { readableApiError } from '@/lib/flow-api';
import { codeLabel, findingFromTable, type ReportTable } from '@/lib/flow-report';
import { columnOverlap, LOW_COLUMN_OVERLAP } from '@/components/flow/stack-waves';
import { tableBaseCopy } from '@/components/flow/table-base';

describe('QA round 11', () => {
  test.each([
    [
      'json detail',
      '{"detail":"That column is not on this file."}',
      'That column is not on this file.',
    ],
    ['validation list', '{"detail":[{"msg":"Field required"}]}', 'Field required'],
    ['plain sentence', 'The deck could not be built.', 'The deck could not be built.'],
  ])('api errors stay readable: %s', (_name, body, expected) => {
    expect(readableApiError(body, 'Bad Request')).toBe(expected);
    expect(readableApiError(body, 'Bad Request')).not.toMatch(/^\s*\{/);
  });

  test('low overlap is the share of the wider file', () => {
    const wide = Array.from({ length: 19 }, (_, index) => ({ name: `q${index}` }));
    const narrow = [{ name: 'q0' }, { name: 'q1' }, { name: 'q2' }, { name: 'q3' }];
    const summary = columnOverlap([wide, narrow]);
    expect(summary.matched).toBe(4);
    expect(summary.widest).toBe(19);
    expect(summary.share).toBeLessThan(LOW_COLUMN_OVERLAP);
  });

  test('a value with no label is the value, and findings use the table number', () => {
    expect(codeLabel('source_wave', 'north.csv', {}, 'banner', ['north.csv', 'south.csv'])).toBe(
      'north.csv'
    );
    const table: ReportTable = {
      id: 't',
      label: 'Satisfaction by source',
      index: 9,
      rows: [],
      columns: [],
      letters: [],
      tested: false,
    };
    expect(findingFromTable(table, null, null).eyebrow).toBe('T9 · Satisfaction by source');
    expect(findingFromTable(table, null, null).citation).toBe('T9');
  });

  test.each([
    ['a whole weighted base', 900, 846],
    ['a float that is a whole number', 1200, 1100],
    ['another whole base', 50, 48],
  ])('whole bases have no decimal: %s', (_name, weighted, unweighted) => {
    const copy = tableBaseCopy({
      weight: { weight_aware: true, weighted_n: weighted + 1e-9, unweighted_n: unweighted },
    });
    expect(copy.line).toContain(weighted.toLocaleString('en-GB'));
    expect(copy.line).not.toMatch(/\d+\.\d/);
    expect(copy.foot).toContain(unweighted.toLocaleString('en-GB'));
  });
});
