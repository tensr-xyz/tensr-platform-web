import { publicSharePath } from './public-share';

describe('publicSharePath', () => {
  it('builds the shared output URL path from the token', () => {
    expect(publicSharePath('abc123')).toBe('/s/abc123');
  });
});

describe('public share viewer helpers', () => {
  it('exports fetch helpers for view and saved views', async () => {
    const mod = await import('./public-share');
    expect(typeof mod.fetchPublicShareView).toBe('function');
    expect(typeof mod.savePublicShareView).toBe('function');
  });
});
