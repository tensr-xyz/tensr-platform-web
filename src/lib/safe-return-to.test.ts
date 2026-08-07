import { safeReturnTo } from './safe-return-to';

describe('safeReturnTo', () => {
  it('falls back for missing, relative, or protocol-relative values', () => {
    expect(safeReturnTo(null)).toBe('/dashboard');
    expect(safeReturnTo(undefined)).toBe('/dashboard');
    expect(safeReturnTo('')).toBe('/dashboard');
    expect(safeReturnTo('https://evil.example')).toBe('/dashboard');
    expect(safeReturnTo('//evil.example')).toBe('/dashboard');
  });

  it('rejects auth and dead signup routes', () => {
    expect(safeReturnTo('/sign-up')).toBe('/dashboard');
    expect(safeReturnTo('/register')).toBe('/dashboard');
    expect(safeReturnTo('/login')).toBe('/dashboard');
    expect(safeReturnTo('/login?foo=1')).toBe('/dashboard');
  });

  it('allows known app destinations including query strings', () => {
    expect(safeReturnTo('/dashboard')).toBe('/dashboard');
    expect(safeReturnTo('/workspace/collaborate?session=abc')).toBe(
      '/workspace/collaborate?session=abc'
    );
    expect(safeReturnTo('/plugins/foo')).toBe('/plugins/foo');
    expect(safeReturnTo('/subscription')).toBe('/subscription');
    expect(safeReturnTo('/admin/plugins')).toBe('/admin/plugins');
  });

  it('rejects unknown paths', () => {
    expect(safeReturnTo('/unknown')).toBe('/dashboard');
    expect(safeReturnTo('/')).toBe('/dashboard');
  });

  it('supports a custom fallback', () => {
    expect(safeReturnTo('/sign-up', '/workspace')).toBe('/workspace');
  });
});
