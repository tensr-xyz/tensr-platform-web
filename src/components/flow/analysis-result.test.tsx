import { render, screen } from '@testing-library/react';
import { AnalysisResult, quoteColumnFit } from './analysis-result';

describe('theme table columns', () => {
  it('gives the count, the share, and the quote their own columns', () => {
    expect(quoteColumnFit('Count')).toBe('count');
    expect(quoteColumnFit('% of people who answered')).toBe('share');
    expect(quoteColumnFit('Quote')).toBe('quote');
    expect(quoteColumnFit('Theme')).toBe('label');

    render(
      <AnalysisResult
        tables={[
          {
            title: 'Themes',
            columns: ['Theme', 'Count', '% of people who answered', 'Quote'],
            rows: [['Waiting', '12', '40', 'Stood there until the order was ready']],
          },
        ]}
      />
    );

    const table = screen.getByRole('table');
    expect(table.closest('section')?.className).toContain('analysis-table-quote');
    expect(table.querySelector('col[data-fit="count"]')).not.toBeNull();
    expect(table.querySelector('col[data-fit="share"]')).not.toBeNull();
    expect(table.querySelector('col[data-fit="quote"]')).not.toBeNull();
    expect(screen.getByRole('columnheader', { name: 'Count' })).toHaveAttribute(
      'data-fit',
      'count'
    );
    expect(
      screen.getByRole('cell', { name: 'Stood there until the order was ready' })
    ).toHaveAttribute('data-fit', 'quote');
  });
});
