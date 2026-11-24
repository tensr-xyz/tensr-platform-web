import { resolveTextHref } from '@/lib/report-document';
import type { PublicSharePageObject, PublicShareReportPage } from '@/lib/public-share';

export type PublicPageLinkTarget = { kind: 'page'; pageId: string } | { kind: 'url'; url: string };

/** Resolve a stored href to an in-report page (when shared) or an external URL. */
export function resolvePublicPageHref(
  href: unknown,
  sharedPageIds: ReadonlySet<string>
): PublicPageLinkTarget | null {
  const resolved = resolveTextHref(href);
  if (!resolved) return null;
  if (resolved.kind === 'url') return { kind: 'url', url: resolved.url };
  if (!sharedPageIds.has(resolved.pageId)) return null;
  return { kind: 'page', pageId: resolved.pageId };
}

export type PublicTextSegment = {
  text: string;
  target: PublicPageLinkTarget | null;
};

/** Split a text object into plain and linked segments for the public viewer. */
export function publicTextSegments(
  object: PublicSharePageObject | undefined,
  sharedPageIds: ReadonlySet<string>
): PublicTextSegment[] {
  if (!object) return [];
  const runs = Array.isArray(object.runs) ? object.runs : [];
  if (runs.length) {
    const segments: PublicTextSegment[] = [];
    for (const run of runs) {
      const text = String(run?.text || '');
      if (!text) continue;
      segments.push({
        text,
        target: resolvePublicPageHref(run?.href, sharedPageIds),
      });
    }
    if (segments.length) return segments;
  }
  const text = String(object.text || '').trim();
  if (!text) return [];
  return [{ text, target: resolvePublicPageHref(object.href, sharedPageIds) }];
}

/** Evidence page ids linked from text objects on this page. */
export function evidencePageIdsFromPage(
  page: PublicShareReportPage | undefined,
  sharedPageIds: ReadonlySet<string>
): string[] {
  if (!page?.objects?.length) return [];
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const obj of page.objects) {
    if (obj.kind !== 'text') continue;
    for (const segment of publicTextSegments(obj, sharedPageIds)) {
      if (segment.target?.kind !== 'page') continue;
      const pageId = segment.target.pageId;
      if (seen.has(pageId)) continue;
      seen.add(pageId);
      ids.push(pageId);
    }
  }
  return ids;
}
