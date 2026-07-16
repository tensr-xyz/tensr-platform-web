/** How long analysis suggestion cards stay clickable before expiring. */
export const SUGGESTION_CARD_TTL_MS = 60_000;

export function isSuggestionCardExpired(createdAt: string | undefined, now = Date.now()): boolean {
  if (!createdAt) return false;
  const created = Date.parse(createdAt);
  if (Number.isNaN(created)) return false;
  return now - created >= SUGGESTION_CARD_TTL_MS;
}
