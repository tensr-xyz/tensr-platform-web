import { NextResponse } from 'next/server';
import { LANDING_CHANGELOG_URL, parseChangelogPayload } from '@/lib/changelog';

const FEED_REVALIDATE_SECONDS = 300;

/** Same-origin copy of the landing feed; its CORS allowlist excludes localhost and custom hosts. */
export async function GET() {
  try {
    const upstream = await fetch(LANDING_CHANGELOG_URL, {
      headers: { Accept: 'application/json' },
      next: { revalidate: FEED_REVALIDATE_SECONDS },
    });
    if (!upstream.ok) {
      return NextResponse.json(
        { success: false, data: null, error: `Changelog request failed (${upstream.status}).` },
        { status: 502 }
      );
    }
    const data = parseChangelogPayload(await upstream.json());
    return NextResponse.json(
      { success: true, data, error: null },
      {
        headers: {
          'Cache-Control': `public, s-maxage=${FEED_REVALIDATE_SECONDS}, stale-while-revalidate=3600`,
        },
      }
    );
  } catch (error) {
    console.error('[api/changelog] landing feed unavailable', error);
    return NextResponse.json(
      { success: false, data: null, error: 'Changelog is unavailable right now.' },
      { status: 502 }
    );
  }
}
