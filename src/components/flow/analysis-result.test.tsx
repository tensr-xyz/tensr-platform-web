import { readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import { AnalysisResult, quoteColumnFit } from './analysis-result';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

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

  it('wraps a wide banner crosstab so the side panel can scroll every header', () => {
    render(
      <AnalysisResult
        tables={[
          {
            title: 'Region by brand',
            columns: ['Brand', 'North', 'Midlands', 'South', 'London', 'Scotland & Wales'],
            rows: [['Octavia', '12', '18', '21', '30', '9']],
          },
        ]}
      />
    );

    const table = screen.getByRole('table');
    const section = table.closest('section');
    expect(section?.className).toBe('analysis-table');
    expect(table.className).toContain('output-grid');
    expect(screen.getByRole('columnheader', { name: 'Scotland & Wales' })).toBeTruthy();

    const css = readFileSync('src/app/flow/flow.css', 'utf8');
    const block = css.match(/\.analysis-table \.output-grid \{[\s\S]*?\n\}/)?.[0];
    expect(block).toMatch(/width:\s*max-content/);
    expect(block).toMatch(/table-layout:\s*auto/);
    expect(block).not.toMatch(/table-layout:\s*fixed/);
    expect(css).toMatch(/\.analysis-table \{[\s\S]*?overflow-x:\s*auto/);
  });
});
