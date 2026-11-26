/** Shared chat-session ordering for Chat, Responses and Tables rails. */

export type ChatSessionRow = {
  session_id: string;
  title?: string;
  updated_at?: string;
};

const UNTITLED_CHAT = 'Untitled chat';

/**
 * Chat list title stays the first question. A follow-up must not rename the session.
 */
export function keepFirstSessionTitle(existing: string | undefined, next: string): string {
  const prior = (existing || '').trim();
  if (prior && prior !== UNTITLED_CHAT) return prior;
  const trimmed = (next || '').trim();
  return trimmed || prior || UNTITLED_CHAT;
}

/** Newest `updated_at` first. Missing stamps sink to the end. */
export function sortSessionsByRecency<T extends { updated_at?: string }>(sessions: T[]): T[] {
  return [...sessions].sort((left, right) =>
    String(right.updated_at || '').localeCompare(String(left.updated_at || ''))
  );
}

/** Responses rail preview: the same order as Chat, capped for the sidebar. */
export function recentChatSessions<T extends { updated_at?: string }>(
  sessions: T[],
  limit = 6
): T[] {
  return sortSessionsByRecency(sessions).slice(0, limit);
}
