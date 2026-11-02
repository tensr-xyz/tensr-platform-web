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
});
