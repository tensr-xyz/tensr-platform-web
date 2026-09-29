export const CHANGELOG_SEEN_STORAGE_KEY = 'tensr.whats-new.seen-version';
export const CHANGELOG_PAGE_URL = 'https://www.tensr.xyz/changelog';
export const LANDING_CHANGELOG_URL = 'https://www.tensr.xyz/api/changelog';

export type ChangelogTag = 'feature' | 'fix' | 'improvement';

export type ChangelogEntry = {
  title: string;
  date: string;
  version: string;
  tags: ChangelogTag[];
  url: string;
  summary: string;
};

type StorageGet = Pick<Storage, 'getItem'>;
type StorageSet = Pick<Storage, 'setItem'>;

const TAGS = new Set<ChangelogTag>(['feature', 'fix', 'improvement']);

export function parseChangelogPayload(payload: unknown): ChangelogEntry[] {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Changelog response was not an object.');
  }

  const body = payload as { success?: unknown; data?: unknown; error?: unknown };
  if (body.success !== true) {
    const message =
      typeof body.error === 'string' && body.error.trim()
        ? body.error
        : 'Changelog request failed.';
    throw new Error(message);
  }
  if (!Array.isArray(body.data)) {
    throw new Error('Changelog data was missing.');
  }

  return body.data.map(parseEntry);
}

function parseEntry(raw: unknown): ChangelogEntry {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Changelog entry was not an object.');
  }
  const entry = raw as Record<string, unknown>;
  const tags = Array.isArray(entry.tags)
    ? entry.tags.filter(
        (tag): tag is ChangelogTag => typeof tag === 'string' && TAGS.has(tag as ChangelogTag)
      )
    : [];

  if (
    typeof entry.title !== 'string' ||
    typeof entry.date !== 'string' ||
    typeof entry.version !== 'string' ||
    typeof entry.url !== 'string' ||
    typeof entry.summary !== 'string'
  ) {
    throw new Error('Changelog entry was missing fields.');
  }

  return {
    title: entry.title,
    date: entry.date,
    version: entry.version,
    tags,
    url: entry.url,
    summary: entry.summary,
  };
}

export function latestVersion(entries: ChangelogEntry[]): string | null {
  return entries[0]?.version ?? null;
}

export function hasUnread(latest: string | null, seen: string | null): boolean {
  if (!latest) return false;
  if (!seen) return true;
  return latest !== seen;
}

export function readSeenVersion(storage: StorageGet = localStorage): string | null {
  try {
    return storage.getItem(CHANGELOG_SEEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeSeenVersion(version: string, storage: StorageSet = localStorage): void {
  storage.setItem(CHANGELOG_SEEN_STORAGE_KEY, version);
}

export async function fetchChangelogFeed(
  fetchImpl: typeof fetch = fetch
): Promise<ChangelogEntry[]> {
  const response = await fetchImpl(LANDING_CHANGELOG_URL, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Changelog request failed (${response.status}).`);
  }
  return parseChangelogPayload(await response.json());
}
