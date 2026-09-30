import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

// Routes from the pre-tensr-api backend. tensr-api does not serve them, so any call 404s.
const REMOVED_ROUTES = ['/api/files/fetch-page', '/create-sheet'];

const SRC = join(__dirname, '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe('removed backend routes', () => {
  it.each(REMOVED_ROUTES)('no source file calls %s', route => {
    const callers = sourceFiles(SRC)
      .filter(path => readFileSync(path, 'utf8').includes(route))
      .map(path => relative(SRC, path));
    expect(callers).toEqual([]);
  });
});
