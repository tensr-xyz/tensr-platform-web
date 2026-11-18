import { publicShareEmbedSnippet, publicSharePath, publicShareUrl } from './public-share';

describe('publicSharePath', () => {
  it('builds the shared output URL path from the token', () => {
    expect(publicSharePath('abc123')).toBe('/s/abc123');
  });
});

describe('public share viewer helpers', () => {
  it('exports fetch helpers for view, unlock and saved views', async () => {
    const mod = await import('./public-share');
    expect(typeof mod.fetchPublicShareView).toBe('function');
    expect(typeof mod.savePublicShareView).toBe('function');
    expect(typeof mod.unlockPublicShare).toBe('function');
  });
});

describe('publicShareEmbedSnippet', () => {
  it('builds an iframe snippet with the share path and title label', () => {
    const snippet = publicShareEmbedSnippet('tok-9', 'Brand favourability');
    expect(snippet).toContain('/s/tok-9');
    expect(snippet).toContain('title="Brand favourability"');
    expect(snippet).toContain('<iframe');
    expect(snippet).toContain('loading="lazy"');
  });

  it('escapes quotes in the title attribute', () => {
    expect(publicShareEmbedSnippet('t1', 'Say "hi"')).toContain('title="Say &quot;hi&quot;"');
  });
});

describe('publicShareUrl', () => {
  it('falls back to the path when window is unavailable in this test env shape', () => {
    expect(publicShareUrl('x')).toMatch(/\/s\/x$/);
  });
});
