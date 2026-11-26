/** Spec ids the wave refresh Build may send — live or stale saved tables. */

export function waveRefreshSpecIds(
  live: { id?: string }[],
  stale: { id?: string }[] = []
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const row of [...live, ...stale]) {
    const id = String(row?.id || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

/** Build is allowed when a deck recipe or any saved table exists. */
export function waveRefreshCanBuild(args: { deckId?: string; specIds: string[] }): boolean {
  return Boolean(String(args.deckId || '').trim() || args.specIds.length > 0);
}
