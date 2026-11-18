/**
 * Recent ⌘K actions for this browser. Newest first; labels are menu display names.
 */

export type RecentPaletteAction = {
  name: string;
  at: number;
};

export const PALETTE_RECENT_STORAGE_KEY = 'tensr.palette.recent.v1';
export const PALETTE_RECENT_MAX = 8;

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function readRaw(storage: StorageLike | null | undefined): RecentPaletteAction[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(PALETTE_RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(row => {
        if (!row || typeof row !== 'object') return null;
        const name = String((row as { name?: unknown }).name || '').trim();
        const at = Number((row as { at?: unknown }).at);
        if (!name || !Number.isFinite(at)) return null;
        return { name, at } satisfies RecentPaletteAction;
      })
      .filter((row): row is RecentPaletteAction => Boolean(row));
  } catch {
    return [];
  }
}

function writeRaw(storage: StorageLike | null | undefined, rows: RecentPaletteAction[]): void {
  if (!storage) return;
  try {
    storage.setItem(PALETTE_RECENT_STORAGE_KEY, JSON.stringify(rows.slice(0, PALETTE_RECENT_MAX)));
  } catch {
    // Quota / private mode — ignore.
  }
}

export function readRecentPaletteActions(
  storage: StorageLike | null | undefined = typeof localStorage !== 'undefined'
    ? localStorage
    : null
): RecentPaletteAction[] {
  return readRaw(storage);
}

/** Prepend `name`, drop duplicates, cap length. Returns the new list. */
export function recordRecentPaletteAction(
  name: string,
  storage: StorageLike | null | undefined = typeof localStorage !== 'undefined'
    ? localStorage
    : null,
  now = Date.now()
): RecentPaletteAction[] {
  const trimmed = name.trim();
  if (!trimmed) return readRaw(storage);
  const next: RecentPaletteAction[] = [
    { name: trimmed, at: now },
    ...readRaw(storage).filter(row => row.name !== trimmed),
  ].slice(0, PALETTE_RECENT_MAX);
  writeRaw(storage, next);
  return next;
}

/** Resolve recent names against the live catalog (drop retired menu items). */
export function recentPaletteItemsFromCatalog<T extends { name: string }>(
  recent: readonly RecentPaletteAction[],
  catalog: readonly T[],
  limit = PALETTE_RECENT_MAX
): T[] {
  const byName = new Map(catalog.map(item => [item.name, item] as const));
  const out: T[] = [];
  for (const row of recent) {
    const hit = byName.get(row.name);
    if (!hit) continue;
    out.push(hit);
    if (out.length >= limit) break;
  }
  return out;
}
