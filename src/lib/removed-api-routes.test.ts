import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

// Routes from the pre-tensr-api backend. tensr-api does not serve them, so any call 404s.
const REMOVED_ROUTES: Array<[string, RegExp]> = [
  ['/api/files/fetch-page', /\/api\/files\/fetch-page/],
  ['/create-sheet', /\/create-sheet/],
  ['/projects/*', /['"`]\/projects\//],
  [
    '/auth/* (legacy Cognito)',
    /['"`]\/auth\/(refresh-tokens|initiate-auth|verify-auth|resend-code)/,
  ],
  ['/statistics/*', /['"`]\/statistics\//],
  ['/transform/*', /['"`]\/transform\//],
  ['/workers/*', /['"`]\/workers\//],
];

const SRC = join(__dirname, '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe('removed backend routes', () => {
  it.each(REMOVED_ROUTES)('no source file calls %s', (_label, pattern) => {
    const callers = sourceFiles(SRC)
      .filter(path => pattern.test(readFileSync(path, 'utf8')))
      .map(path => relative(SRC, path));
    expect(callers).toEqual([]);
  });
});
