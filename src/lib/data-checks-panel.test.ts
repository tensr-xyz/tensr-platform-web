import {
  dataCheckCards,
  dataChecksFooterNote,
  dataChecksPassedLine,
  dataChecksTitle,
} from './data-checks-panel';
import type { DataChecksReport } from './dataset-data-ops';

const report: DataChecksReport = {
  respondents: 6,
  n_columns: 4,
  summary: {
    issues: 2,
    construction_issues: 1,
    out_of_range: 1,
    straightline_questions: 1,
    summary_table_candidates: 3,
  },
  construction: [
    {
      kind: 'out_of_range',
      kind_label: 'Value outside the labelled scale',
      column: 'age',
      label: 'Age',
      message: 'Age has 3 answer(s) outside the labelled scale 1–99.',
      codes: ['120'],
      count: 3,
    },
  ],
  straightlining: [
    {
      kind: 'straightlining',
      kind_label: 'Same answer down a grid',
      label: 'Satisfaction',
      columns: ['sat_1', 'sat_2', 'sat_3'],
      column_labels: ['Price', 'Service', 'Range'],
      straightline_count: 2,
      respondent_pct: 33.3,
      message: 'Satisfaction: 2 respondent(s) gave the same answer on every item (33.3%).',
    },
  ],
  summary_tables: [{ column: 'region', label: 'Region', n_categories: 4 }],
  issue_labels: {
    missing_label: 'Missing variable label',
    unlabeled_code: 'Value in data with no label',
    unused_label: 'Label never used in the data',
    duplicate_label: 'Duplicate variable label',
    out_of_range: 'Value outside the labelled scale',
    empty_column: 'No answers in this column',
    straightlining: 'Same answer down a grid',
  },
};

describe('data checks panel helpers', () => {
  it('builds look-at cards with labels and Show the N', () => {
    const cards = dataCheckCards(report);
    expect(cards).toHaveLength(2);
    expect(cards[0]?.title).toContain('Age');
    expect(cards[0]?.title).toContain('3');
    expect(cards[0]?.showLabel).toBe('Show the 3');
    expect(cards[0]?.column).toBe('age');
    expect(cards[1]?.title).toContain('Satisfaction');
    expect(cards[1]?.showLabel).toBe('Show the 2');
    expect(cards[1]?.columns).toEqual(['sat_1', 'sat_2', 'sat_3']);
  });

  it('titles the dialog from the look-at count', () => {
    expect(dataChecksTitle(0)).toBe('Data checks · all clear');
    expect(dataChecksTitle(1)).toBe('Data checks · 1 to look at');
    expect(dataChecksTitle(3)).toBe('Data checks · 3 to look at');
  });

  it('lists passed checks without naming codes', () => {
    const line = dataChecksPassedLine(report);
    expect(line).toMatch(/^✓ \d+ other checks passed · /);
    expect(line).toContain('labels');
    expect(line).not.toMatch(/\b(sat_1|age|region)\b/);
    expect(dataChecksFooterNote()).toContain('after each upload');
  });
});
