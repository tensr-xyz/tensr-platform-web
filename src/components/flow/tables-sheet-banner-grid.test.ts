import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * TEN-250: a long stub / question header must not push Total off screen.
 * Paper 5 · Project · Tables keeps the label lane at ~140px and figure
 * columns at ~82px; the sheet scrolls for extra banners instead of
 * switching the grid to table-layout: auto / width: max-content alone.
 */
describe('tables-sheet banner-grid label lane', () => {
  const css = readFileSync(join(process.cwd(), 'src/app/flow/flow.css'), 'utf8');

  it('caps the stub lane and keeps fixed layout so Total stays in view', () => {
    const block = css.match(/\.tables-sheet \.banner-grid \{[\s\S]*?\n\}/)?.[0] || '';
    expect(block).toMatch(/table-layout:\s*fixed/);
    expect(block).not.toMatch(/table-layout:\s*auto/);

    expect(css).toMatch(
      /\.tables-sheet \.banner-grid thead th:first-child,\s*\n\s*\.tables-sheet \.banner-grid tbody th:not\(\[colspan\]\)\s*\{[^}]*width:\s*140px/
    );
    expect(css).toMatch(
      /\.tables-sheet \.banner-grid thead th:not\(:first-child\),\s*\n\s*\.tables-sheet \.banner-grid td\s*\{[^}]*min-width:\s*82px/
    );
  });
});
