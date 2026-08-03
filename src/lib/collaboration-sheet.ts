import type { Session } from '@/hooks/ui/use-session';

/**
 * Derives the `sheet_live` document id used for real-time collaborative editing.
 *
 * While a collaboration session is active every participant joins the same
 * session id, so keying the live sheet doc off it guarantees all participants'
 * `useSheetState` instances subscribe to (and persist edits into) the exact same
 * DynamoDB-backed document — see `app/realtime/sheet_live_dynamo.py` (prod/staging)
 * and `app/sheet_live.py` (local dev). This is what ties live sheet sync to the
 * collaboration session rather than to an independent, session-unaware id.
 *
 * Falls back to an explicit `tabSheetId` (e.g. set by a future dedicated
 * "create sheet" flow) so solo editing outside a session can still opt into
 * op-log persistence.
 */
export function deriveLiveSheetId(
  currentSession: Pick<Session, 'id'> | null | undefined,
  tabSheetId?: string | null
): string | undefined {
  if (currentSession?.id) {
    return `session:${currentSession.id}`;
  }
  return tabSheetId || undefined;
}
