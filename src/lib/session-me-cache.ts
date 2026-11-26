/**
 * One GET /me (or /api/me) per browser session per workspace.
 * Auth bootstrap, TanStack useMe/ensureMe, settings, and Strict Mode remounts
 * all share the same in-flight promise and cached body.
 */

type Slot = {
  promise: Promise<unknown>;
  value?: unknown;
  settled: boolean;
};

const slots = new Map<string, Slot>();

/** Workspace the API will see (matches settings-cache / X-Organization-Id). */
export function sessionMeWorkspaceKey(): string {
  if (typeof window === 'undefined') return 'server';
  try {
    return window.localStorage.getItem('activeOrganizationId') || 'personal';
  } catch {
    return 'personal';
  }
}

export function clearSessionMe(match?: (key: string) => boolean): void {
  if (!match) {
    slots.clear();
    return;
  }
  for (const key of [...slots.keys()]) {
    if (match(key)) slots.delete(key);
  }
}

/**
 * Reuse an in-flight or settled session profile for this workspace.
 * Pass `force: true` only when the caller must re-check (e.g. unpaid gate).
 */
export function getSessionMe<T>(
  load: () => Promise<T>,
  options?: { workspaceKey?: string; force?: boolean }
): Promise<T> {
  const key = options?.workspaceKey ?? sessionMeWorkspaceKey();
  const hit = slots.get(key);
  // Always join an in-flight load. `force` only bypasses a settled cache entry
  // (e.g. unpaid gate re-check), never a second concurrent network call.
  if (hit && (!options?.force || !hit.settled)) {
    return hit.promise as Promise<T>;
  }
  const slot: Slot = { promise: Promise.resolve(), settled: false };
  slot.promise = load().then(
    value => {
      if (slots.get(key) === slot) {
        slot.value = value;
        slot.settled = true;
      }
      return value;
    },
    error => {
      if (slots.get(key) === slot) slots.delete(key);
      throw error;
    }
  );
  slots.set(key, slot);
  return slot.promise as Promise<T>;
}

export function peekSessionMe<T>(workspaceKey = sessionMeWorkspaceKey()): T | undefined {
  const hit = slots.get(workspaceKey);
  if (!hit?.settled) return undefined;
  return hit.value as T | undefined;
}
