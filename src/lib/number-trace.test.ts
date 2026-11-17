import { formatTraceP, numberTraceFromCell, significanceTrace } from './number-trace';

const book = {
  weight: { column: 'design_weight', label: 'Design weight', weight_aware: true },
  resolved_weight: 'design_weight',
  significance_display: 'column_letters',
  filter_ref: { filters: [] },
  banner_columns: [
    { id: 'total', label: 'Total' },
    { id: 'age=18-34', label: '18–34', letter_slot: 'A' },
    { id: 'age=55+', label: '55+', letter_slot: 'C' },
  ],
  letters: [{ stub_row_id: 'aware', banner_id: 'age=18-34', letter: 'C' }],
  tests: [
    {
      stub_row_id: 'aware',
      left: 'age=18-34',
      right: 'age=55+',
      significant: true,
      p_adjusted: 0.004,
      p_value: 0.003,
    },
  ],
};

const row = { id: 'aware', label: 'Aware', column: 'prompted' };
const column = { id: 'age=18-34', label: '18–34', letter_slot: 'A' };
const cell = {
  banner_id: 'age=18-34',
  percent: 71.2,
  unweighted_n: 286,
  weighted_n: 291.4,
  column_unweighted_n: 402,
  column_weighted_n: 410.2,
  count: 291.4,
};

describe('numberTraceFromCell', () => {
  it('builds the Paper 9f rows from a banner cell', () => {
    const trace = numberTraceFromCell(book, row, column, cell, 'C', { digits: 0 });
    expect(trace).toMatchObject({
      value: '71%',
      context: 'Aware · 18–34',
      respondentCount: 286,
      showRespondentsLabel: 'Show the 286 respondents',
    });
    expect(trace?.rows).toEqual([
      { label: 'Respondents', value: '286 of 402 · 18–34' },
      { label: 'Weighted', value: '291.4 of 410.2 · Design weight' },
      { label: 'Filter', value: 'None' },
      { label: 'Significance', value: 'Higher than 55+ (p < 0.01)' },
    ]);
  });

  it('names a filter with the column label, not the variable name', () => {
    const filtered = {
      ...book,
      filter_ref: { filters: [{ column: 'region', value: 'London' }] },
    };
    const trace = numberTraceFromCell(filtered, row, column, cell, '', {
      columnLabels: [{ name: 'region', label: 'Region' }],
    });
    expect(trace?.rows.find(item => item.label === 'Filter')?.value).toBe('Region = London');
  });

  it('hides R check until the book carries one', () => {
    const withR = { ...book, r_check: 'verified', r_statement: 'Matches · 0.00 difference' };
    const trace = numberTraceFromCell(withR, row, column, cell, '');
    expect(trace?.rows.find(item => item.label === 'R check')).toEqual({
      label: 'R check',
      value: 'Matches · 0.00 difference',
      accent: true,
    });
  });

  it('says Unweighted when the table has no weight', () => {
    const plain = {
      ...book,
      weight: { weight_aware: false },
      resolved_weight: 'none',
    };
    const trace = numberTraceFromCell(plain, row, column, cell, '');
    expect(trace?.rows.find(item => item.label === 'Weighted')?.value).toBe('Unweighted');
  });
});

describe('significanceTrace', () => {
  it('formats a letter as Higher than with the adjusted p', () => {
    expect(significanceTrace(book, 'aware', 'age=18-34', 'C')).toBe('Higher than 55+ (p < 0.01)');
  });

  it('returns None when the cell has no letters', () => {
    expect(significanceTrace(book, 'aware', 'age=18-34', '')).toBe('None');
  });
});

describe('formatTraceP', () => {
  it('uses Displayr-style thresholds', () => {
    expect(formatTraceP(0.0004)).toBe('p < 0.001');
    expect(formatTraceP(0.004)).toBe('p < 0.01');
    expect(formatTraceP(0.03)).toBe('p < 0.05');
    expect(formatTraceP(0.12)).toBe('p = 0.12');
    expect(formatTraceP(null)).toBe('');
  });
});
