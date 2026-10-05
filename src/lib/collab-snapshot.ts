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

/**
 * hyparquet reads INT64 columns as BigInt, which JSON.stringify cannot encode, so any op
 * carrying such a cell (e.g. `oldValue`) would never be sent.
 */
export function jsonSafeCell(value: unknown): unknown {
  if (typeof value !== 'bigint') return value;
  const asNumber = Number(value);
  return Number.isSafeInteger(asNumber) ? asNumber : value.toString();
}

export async function fetchSnapshotRows(snapshotUrl: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(snapshotUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch collaboration snapshot (${res.status})`);
  }
  const arrayBuffer = await res.arrayBuffer();
  const rows = (await parquetReadObjects({ file: arrayBuffer })) as Record<string, unknown>[];
  return rows.map(row =>
    Object.fromEntries(Object.entries(row).map(([key, value]) => [key, jsonSafeCell(value)]))
  );
}
