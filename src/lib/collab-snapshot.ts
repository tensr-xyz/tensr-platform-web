/**
 * Fetch + parse a collaboration fork's Parquet snapshot for joiners.
 *
 * Server `initial_state` for a `session:{id}` sheet prefers a presigned S3 URL to
 * `collab/{sessionId}/snapshot.parquet` plus the ops applied since it (see
 * `app/realtime/sheet_live_dynamo.py::get_initial_state_payload`) over sending full
 * rows inline. This hydrates that snapshot client-side so `useSheetState` can apply the
 * accompanying ops on top of it, same as any other op-log replay.
 */
import { parquetReadObjects } from 'hyparquet';

export async function fetchSnapshotRows(snapshotUrl: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(snapshotUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch collaboration snapshot (${res.status})`);
  }
  const arrayBuffer = await res.arrayBuffer();
  const rows = await parquetReadObjects({ file: arrayBuffer });
  return rows as Record<string, unknown>[];
}
