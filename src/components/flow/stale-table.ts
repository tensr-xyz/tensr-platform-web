/** Tables whose stored fingerprint no longer matches the live file. */

export type StaleTable = {
  id: string;
  label: string;
  number: number;
  datasetId: string;
  filename: string;
  detail: string;
};

export function isTableSourceChanged(error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status;
  if (status != null && status !== 409) return false;
  return /fingerprint|built against|stored spec was not mutated/i.test(errorText(error));
}

export function tableSourceChangedDetail(error: unknown): string {
  const text = errorText(error).trim();
  if (!text) {
    return 'This table was built on an older version of the data.';
  }
  try {
    const parsed = JSON.parse(text) as { detail?: unknown };
    if (typeof parsed.detail === 'string' && parsed.detail.trim()) return parsed.detail.trim();
  } catch {
    /* plain text */
  }
  return text;
}

/** Default in-flight GETs when opening many saved tables on the Report tab. */
export const REPORT_TABLE_LOAD_CONCURRENCY = 4;

/** Load every project table; a fingerprint mismatch becomes a stale card, not a page failure. */
export async function loadTablesSettled<
  T extends { id: string; datasetId: string; label: string; number: number; filename?: string },
>(
  rows: T[],
  fetchTable: (row: T) => Promise<Record<string, unknown>>,
  opts?: { concurrency?: number }
): Promise<{
  ready: { row: T; detail: Record<string, unknown> }[];
  stale: StaleTable[];
  failed: { row: T; error: unknown }[];
}> {
  const ready: { row: T; detail: Record<string, unknown> }[] = [];
  const stale: StaleTable[] = [];
  const failed: { row: T; error: unknown }[] = [];
  const limit = Math.max(1, Math.floor(opts?.concurrency ?? REPORT_TABLE_LOAD_CONCURRENCY));
  let cursor = 0;

  async function worker() {
    while (cursor < rows.length) {
      const index = cursor;
      cursor += 1;
      const row = rows[index];
      if (!row) continue;
      try {
        const detail = await fetchTable(row);
        ready.push({ row, detail });
      } catch (error) {
        if (isTableSourceChanged(error)) {
          stale.push({
            id: row.id,
            label: row.label,
            number: row.number,
            datasetId: row.datasetId,
            filename: row.filename || '',
            detail: tableSourceChangedDetail(error),
          });
          continue;
        }
        failed.push({ row, error });
      }
    }
  }

  const workers = Array.from({ length: Math.min(limit, Math.max(rows.length, 1)) }, () => worker());
  await Promise.all(workers);
  return { ready, stale, failed };
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message || '';
  return String(error || '');
}
