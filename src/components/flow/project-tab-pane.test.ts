import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * TEN-248: project tab wrappers must stay in the flex height chain so chat
 * (and Details / Responses / Tables / Report) fill flow-body while short or
 * streaming. The plain wrapper used to be display:block/auto and broke it.
 */
describe('project-tab-pane height chain', () => {
  const css = readFileSync(join(process.cwd(), 'src/app/flow/flow.css'), 'utf8');

  it('gives the pane flex height and hides it without breaking display:flex', () => {
    expect(css).toMatch(/\.project-tab-pane\s*\{[^}]*flex:\s*1/);
    expect(css).toMatch(/\.project-tab-pane\s*\{[^}]*min-height:\s*0/);
    expect(css).toMatch(/\.project-tab-pane\s*\{[^}]*display:\s*flex/);
    expect(css).toMatch(/\.project-tab-pane\[hidden\]\s*\{[^}]*display:\s*none/);
    expect(css).toMatch(/\.project-tab-pane\s*>\s*\*\s*\{[^}]*flex:\s*1/);
    expect(css).toMatch(/\.project-tab-pane\s*>\s*\*\s*\{[^}]*min-height:\s*0/);
  });
});
