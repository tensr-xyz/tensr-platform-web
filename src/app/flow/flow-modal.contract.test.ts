import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * TEN-268: `.flow-modal` is a DialogContent shell (max-height, scroll body),
 * not a full-viewport overlay. An `inset: 0` rule pins dialogs to the top-left.
 */
describe('flow-modal long dialog shell', () => {
  const css = readFileSync(join(__dirname, 'flow.css'), 'utf8');

  function ruleBody(selector: string): string {
    const re = new RegExp(
      `${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`,
      'g'
    );
    const bodies: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = re.exec(css))) {
      bodies.push(match[1]);
    }
    expect(bodies.length).toBeGreaterThan(0);
    return bodies.join('\n');
  }

  it('centers on DialogContent and never uses inset:0 overlay', () => {
    const body = ruleBody('.flow-modal');
    expect(body).toMatch(/max-height:\s*85vh/);
    expect(body).toMatch(/left:\s*50%/);
    expect(body).toMatch(/top:\s*50%/);
    expect(body).not.toMatch(/inset:\s*0/);
    expect(body).not.toMatch(/padding-top:\s*12vh/);
  });

  it('keeps head and foot pinned while the body scrolls', () => {
    expect(css).toMatch(/\.flow-modal-head\s*,\s*\.flow-modal-foot\s*\{[^}]*flex-shrink:\s*0/);
    expect(ruleBody('.flow-modal-body')).toMatch(/overflow:\s*auto/);
  });
});
