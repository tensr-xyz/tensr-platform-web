/** sessionStorage helpers for the active collaboration session id.

Kept outside `use-session` so client components can import them without hitting
Turbopack/HMR partial-export issues on the large websocket module.
*/

const ACTIVE_SESSION_STORAGE_KEY = 'tensr.activeCollaborationSessionId';

export function persistActiveSessionId(sessionId: string | null) {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    if (sessionId) {
      sessionStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, sessionId);
    } else {
      sessionStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
    }
  } catch {
    /* private mode / blocked storage */
  }
}

export function readPersistedActiveSessionId(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return sessionStorage.getItem(ACTIVE_SESSION_STORAGE_KEY)?.trim() || null;
  } catch {
    return null;
  }
}
