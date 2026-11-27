import {
  fileWideBaseN,
  fileWideMissingCount,
  isFileWideColumnPage,
  missingRowsCaption,
  percentOfBase,
  rowsFromFileWideCounts,
  shouldAcceptColumnValuesPage,
  variableShareCaption,
} from './file-wide-column-shares';

describe('file-wide column shares (TEN-148)', () => {
  it('accepts whole-file pages for closed, multi, and all-missing columns', () => {
    // Closed single-code question
    expect(
      shouldAcceptColumnValuesPage({
        n: 500,
        counts: { '1': 101, '2': 399 },
      })
    ).toBe(true);
    // Pipe-split multi themes
    expect(
      shouldAcceptColumnValuesPage({
        n: 800,
        counts: { Taste: 160, Price: 90 },
      })
    ).toBe(true);
    // Every cell blank — still a real file base
    expect(shouldAcceptColumnValuesPage({ n: 120, counts: {} })).toBe(true);
  });

  it('rejects preview fallbacks and malformed payloads', () => {
    expect(shouldAcceptColumnValuesPage({ n: 50, counts: null })).toBe(false);
    expect(shouldAcceptColumnValuesPage({ counts: { a: 1 } })).toBe(false);
    expect(isFileWideColumnPage({ n: 50, counts: { a: 1 }, fallback: true })).toBe(false);
    expect(isFileWideColumnPage({ n: 0, counts: {} })).toBe(true);
  });

  it('captions and percents use file n, never a settled "loaded rows" base', () => {
    const file = { n: 800, counts: { Good: 161 }, missing: 320 };
    expect(variableShareCaption(file, true)).toBe('% of all 800 rows');
    expect(variableShareCaption(undefined, false)).toBe('% of all rows');
    expect(variableShareCaption({ n: 0, fallback: true }, true)).toBe('% of all rows');
    expect(fileWideBaseN(file, 50)).toBe(800);
    expect(fileWideBaseN({ fallback: true, n: 0 }, 50)).toBe(50);
    expect(percentOfBase(161, 800)).toBe(20);
    expect(percentOfBase(7, 50)).toBe(14);
    expect(fileWideMissingCount(file, 20)).toBe(320);
    expect(missingRowsCaption(320, 800)).toBe('40% · 320 rows');
    expect(missingRowsCaption(20, 50)).toBe('40% · 20 rows');
    expect(missingRowsCaption(0, 800)).toBe('None');
  });

  it('builds labelled share rows for weighted-looking and code-keyed counts', () => {
    expect(
      rowsFromFileWideCounts({
        counts: { '1': 101, '2': 399 },
        value_labels: { '1': 'Consistent quality', '2': 'Other' },
      })
    ).toEqual([
      { label: 'Other', count: 399 },
      { label: 'Consistent quality', count: 101 },
    ]);
    expect(
      rowsFromFileWideCounts({
        counts: { price: 40, Price: 10, quality: 5 },
        value_labels: { price: 'Price', quality: 'Quality' },
      })
    ).toEqual([
      { label: 'Price', count: 50 },
      { label: 'Quality', count: 5 },
    ]);
    expect(rowsFromFileWideCounts({ counts: { '—': 9, Taste: 3 } })).toEqual([
      { label: 'Taste', count: 3 },
    ]);
  });
});
