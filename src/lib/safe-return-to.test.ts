import { safeReturnTo } from './safe-return-to';

describe('safeReturnTo', () => {
  it('falls back for missing, relative, or protocol-relative values', () => {
    expect(safeReturnTo(null)).toBe('/flow');
    expect(safeReturnTo(undefined)).toBe('/flow');
    expect(safeReturnTo('')).toBe('/flow');
    expect(safeReturnTo('https://evil.example')).toBe('/flow');
    expect(safeReturnTo('//evil.example')).toBe('/flow');
  });

  it('rejects auth and dead signup routes', () => {
    expect(safeReturnTo('/sign-up')).toBe('/flow');
    expect(safeReturnTo('/register')).toBe('/flow');
    expect(safeReturnTo('/login')).toBe('/flow');
    expect(safeReturnTo('/login?foo=1')).toBe('/flow');
  });

  it('allows known app destinations including query strings', () => {
    expect(safeReturnTo('/dashboard')).toBe('/dashboard');
    expect(safeReturnTo('/flow/p/abc/chat')).toBe('/flow/p/abc/chat');
    expect(safeReturnTo('/workspace/collaborate?session=abc')).toBe(
      '/workspace/collaborate?session=abc'
    );
    expect(safeReturnTo('/plugins/foo')).toBe('/plugins/foo');
    expect(safeReturnTo('/subscription')).toBe('/subscription');
    expect(safeReturnTo('/admin/plugins')).toBe('/admin/plugins');
  });

  it('rejects unknown paths', () => {
    expect(safeReturnTo('/unknown')).toBe('/flow');
    expect(safeReturnTo('/')).toBe('/flow');
  });

  it('supports a custom fallback', () => {
    expect(safeReturnTo('/sign-up', '/workspace')).toBe('/workspace');
  });
});
