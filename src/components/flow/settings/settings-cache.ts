/**
 * A small session cache for the settings screens. Requests that several tabs share (/api/me,
 * the subscription, the plan catalogue) go out once, in flight requests are reused, and a tab you
 * have already opened draws straight from the last answer while it refreshes quietly.
 */

type Entry = { at: number; promise: Promise<unknown>; value?: unknown; settled: boolean };

export type RequestCache = {
  /** Reuses an in-flight request, or an answer younger than `maxAgeMs`. Failures are not kept. */
  get<T>(key: string, load: () => Promise<T>, maxAgeMs?: number): Promise<T>;
  /** The last answer for `key`, however old, or undefined. */
  peek<T>(key: string): T | undefined;
  /** Drops every key that `match` accepts (all keys when omitted). */
  forget(match?: (key: string) => boolean): void;
};

export const DEFAULT_MAX_AGE_MS = 60_000;

export function createRequestCache(now: () => number = Date.now): RequestCache {
  const store = new Map<string, Entry>();
  return {
    get<T>(key: string, load: () => Promise<T>, maxAgeMs = DEFAULT_MAX_AGE_MS): Promise<T> {
      const hit = store.get(key);
      if (hit && (!hit.settled || now() - hit.at < maxAgeMs)) return hit.promise as Promise<T>;
      const entry: Entry = { at: now(), promise: Promise.resolve(), settled: false };
      if (hit && 'value' in hit) entry.value = hit.value;
      entry.promise = load().then(
        value => {
          if (store.get(key) === entry) {
            entry.value = value;
            entry.settled = true;
            entry.at = now();
          }
          return value;
        },
        error => {
          if (store.get(key) === entry) {
            if (hit && 'value' in hit) store.set(key, hit);
            else store.delete(key);
          }
          throw error;
        }
      );
      store.set(key, entry);
      return entry.promise as Promise<T>;
    },
    peek<T>(key: string): T | undefined {
      return store.get(key)?.value as T | undefined;
    },
    forget(match) {
      for (const key of [...store.keys()]) if (!match || match(key)) store.delete(key);
    },
  };
}

export const settingsCache = createRequestCache();

/** Answers depend on the workspace the API sees (the X-Organization-Id header). */
export function workspaceKey(): string {
  if (typeof window === 'undefined') return 'server';
  try {
    return window.localStorage.getItem('activeOrganizationId') || 'personal';
  } catch {
    return 'personal';
  }
}

export function cacheKey(name: string): string {
  return `${workspaceKey()}:${name}`;
}
