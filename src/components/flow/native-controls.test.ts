import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const roots = ['src/components/flow', 'src/app/flow'];

function filesIn(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return filesIn(path);
    if (path.endsWith('.test.ts') || path.endsWith('.test.tsx')) return [];
    return path.endsWith('.tsx') || path.endsWith('.ts') ? [path] : [];
  });
}

const forbidden = [
  { pattern: /<select\b/, label: '<select>' },
  { pattern: /<button\b/, label: '<button>' },
  { pattern: /<textarea\b/, label: '<textarea>' },
  { pattern: /<input\b/, label: '<input>' },
  { pattern: /type=["']checkbox["']/, label: 'checkbox' },
  { pattern: /type=["']radio["']/, label: 'radio' },
];

const heavy = /\bfont-semibold\b|\bfont-bold\b|\bfont-\[(?:600|700|800|900)\]/g;

/** A heavier class is allowed only when that screen's Paper export uses the same weight. */
const heavyAllowances: { file: string; screen: string; token: string }[] = [];

function paperUses(screen: string, token: string): boolean {
  const source = readFileSync(join('design/paper', screen, 'screen.tsx'), 'utf8');
  return source.includes(token);
}

describe('flow controls', () => {
  it('uses the shared components instead of native controls', () => {
    const hits: string[] = [];
    for (const path of roots.flatMap(filesIn)) {
      const source = readFileSync(path, 'utf8');
      for (const rule of forbidden) {
        if (rule.pattern.test(source)) hits.push(`${path} has a native ${rule.label}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('uses regular and medium unless that screen export uses another weight', () => {
    const hits: string[] = [];
    for (const path of roots.flatMap(filesIn)) {
      const source = readFileSync(path, 'utf8');
      for (const match of source.match(heavy) || []) {
        const allowance = heavyAllowances.find(
          item => path.endsWith(item.file) && match.includes(item.token.replace('font-', ''))
        );
        if (!allowance || !paperUses(allowance.screen, allowance.token)) {
          hits.push(`${path} uses ${match}`);
        }
      }
    }
    const css = readFileSync('src/app/flow/flow.css', 'utf8');
    if (/font-weight:\s*(600|700|bold|semibold)/.test(css)) {
      hits.push('flow.css sets a heavy weight outside the title token');
    }
    if (css.includes('--weight-title') && !paperUses('1a-projects-cards', 'font-[600]')) {
      hits.push('the title weight has no Paper export');
    }
    expect(hits).toEqual([]);
  });
});
