/** Shared chat-session ordering for Chat, Responses and Tables rails. */

export type ChatSessionRow = {
  session_id: string;
  title?: string;
  updated_at?: string;
};

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
