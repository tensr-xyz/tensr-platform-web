import { shouldAcceptColumnValuesPage } from '@/lib/file-wide-column-shares';
import { rowsFromFileCounts } from './code-frame-rail';

describe('code-frame rail file-wide counts', () => {
  it('builds theme rows from whole-file counts and labels', () => {
    const { codes, blank } = rowsFromFileCounts(
      { price: 240, quality: 80, '—': 3 },
      { price: 'Price', quality: 'Quality' },
      12
    );
    expect(blank).toBe(12);
    expect(codes.map(row => row.label)).toEqual(['Price', 'Quality']);
    expect(codes[0].count).toBe(240);
  });

  it('merges duplicate labels from code and label keys', () => {
    const { codes } = rowsFromFileCounts({ Price: 10, price: 5 }, { price: 'Price' });
    expect(codes).toEqual([{ id: 'Price', label: 'Price', count: 15 }]);
  });

  it('accepts empty-code whole-file pages so base N is still file-wide', () => {
    expect(shouldAcceptColumnValuesPage({ n: 800, counts: {} })).toBe(true);
    expect(shouldAcceptColumnValuesPage({ n: 12, counts: { Taste: 4 } })).toBe(true);
    expect(shouldAcceptColumnValuesPage({ n: 50 })).toBe(false);
  });
});
