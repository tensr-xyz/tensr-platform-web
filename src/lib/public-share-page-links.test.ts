import {
  evidencePageIdsFromPage,
  publicTextSegments,
  resolvePublicPageHref,
} from './public-share-page-links';

describe('resolvePublicPageHref', () => {
  const shared = new Set(['page-evidence', 'page-summary']);

  it('resolves in-report page links that are shared', () => {
    expect(resolvePublicPageHref('page:page-evidence', shared)).toEqual({
      kind: 'page',
      pageId: 'page-evidence',
    });
  });

  it('drops page links that are not in the shared set', () => {
    expect(resolvePublicPageHref('page:appendix', shared)).toBeNull();
  });

  it('keeps external URLs', () => {
    expect(resolvePublicPageHref('https://example.com/r', shared)).toEqual({
      kind: 'url',
      url: 'https://example.com/r',
    });
  });
});

describe('publicTextSegments', () => {
  const shared = new Set(['page-evidence']);

  it('splits runs into plain and linked segments', () => {
    expect(
      publicTextSegments(
        {
          kind: 'text',
          text: 'Scotland drove awareness. See evidence',
          runs: [
            { text: 'Scotland drove awareness. ' },
            { text: 'See evidence', href: 'page:page-evidence' },
          ],
        },
        shared
      )
    ).toEqual([
      { text: 'Scotland drove awareness. ', target: null },
      {
        text: 'See evidence',
        target: { kind: 'page', pageId: 'page-evidence' },
      },
    ]);
  });

  it('uses the object href when there are no runs', () => {
    expect(
      publicTextSegments(
        { kind: 'text', text: 'Open evidence', href: 'page:page-evidence' },
        shared
      )
    ).toEqual([
      {
        text: 'Open evidence',
        target: { kind: 'page', pageId: 'page-evidence' },
      },
    ]);
  });
});

describe('evidencePageIdsFromPage', () => {
  it('lists unique evidence page ids from text objects', () => {
    const shared = new Set(['e1', 'e2']);
    expect(
      evidencePageIdsFromPage(
        {
          id: 'findings',
          objects: [
            {
              kind: 'text',
              text: 'A',
              runs: [{ text: 'See A', href: 'page:e1' }],
            },
            {
              kind: 'text',
              text: 'B',
              href: 'page:e2',
            },
            {
              kind: 'text',
              text: 'Again',
              href: 'page:e1',
            },
          ],
        },
        shared
      )
    ).toEqual(['e1', 'e2']);
  });
});
