import { flowJson } from '@/lib/flow-api';

/** A saved table, with the file it was built on. */
export type ProjectTable = {
  id: string;
  label: string;
  datasetId: string;
  filename: string;
  /** The table's T number. It stays once given; a new table takes the next one. */
  number: number;
  stale?: boolean;
  detail?: string;
};

type RawRow = {
  spec_id?: string;
  id?: string;
  label?: string;
  name?: string;
  dataset_id?: string;
  filename?: string;
  table_number?: number | null;
  stale?: boolean;
  detail?: string;
};

export function projectTableRows(rows: RawRow[] | undefined, fallbackDataset = ''): ProjectTable[] {
  const seen = new Set<string>();
  const out: ProjectTable[] = [];
  for (const row of rows || []) {
    const id = String(row.spec_id || row.id || '');
    const datasetId = String(row.dataset_id || fallbackDataset);
    const key = `${datasetId}:${id}`;
    if (!id || seen.has(key)) continue;
    seen.add(key);
    out.push({
      id,
      label: row.label || row.name || id,
      datasetId,
      filename: row.filename || '',
      number: Number(row.table_number) > 0 ? Number(row.table_number) : 0,
      stale: Boolean(row.stale),
      detail: row.detail || '',
    });
  }
  return out;
}

/**
 * Every table saved in the project, so the list stays put when the file in use changes.
 * Falls back to the one file's tables when the project list is unavailable.
 */
export async function loadProjectTables(
  projectId: string | undefined,
  datasetId: string | undefined,
  options: {
    /** The project's files the screen already holds, so the API reads those and skips its file scan. */
    fileIds?: string[];
    /** The open file's table list when the screen already asked for it, so it is not fetched twice. */
    filePage?: Promise<{ specs?: RawRow[] } | null>;
  } = {}
): Promise<ProjectTable[]> {
  // Both lists, merged: the project's (every file) and the open file's own, so a gap in one never empties the rail.
  const fileIds = options.fileIds || [];
  const projectPage = projectId
    ? await flowJson<{ specs?: RawRow[]; stamps_pending?: boolean }>(
        projectTablesPath(projectId, fileIds)
      ).catch(() => null)
    : null;
  const [filePage] = await Promise.all([
    options.filePage ||
      (datasetId
        ? flowJson<{ specs?: RawRow[] }>(`/datasets/${datasetId}/tables`).catch(() => null)
        : Promise.resolve(null)),
  ]);
  return numberTables(
    mergeTableLists(
      projectTableRows(projectPage?.specs),
      projectTableRows(filePage?.specs, datasetId)
    )
  );
}

/**
 * Keeps every saved T number. A table without one (just saved, not yet listed by the project)
 * takes the next number after the highest, oldest first. The list itself is newest first.
 */
export function numberTables<T extends { number?: number }>(tables: T[]): T[] {
  let next = Math.max(0, ...tables.map(table => table.number || 0)) + 1;
  const numbers = new Map<number, number>();
  for (let index = tables.length - 1; index >= 0; index -= 1) {
    if (!tables[index].number) numbers.set(index, next++);
  }
  return tables.map((table, index) =>
    numbers.has(index) ? { ...table, number: numbers.get(index) } : table
  );
}

export function projectTablesPath(projectId: string, fileIds: string[] = []): string {
  const ids = [...new Set(fileIds.filter(Boolean))];
  return ids.length
    ? `/api/projects/${projectId}/tables?dataset_ids=${encodeURIComponent(ids.join(','))}`
    : `/api/projects/${projectId}/tables`;
}

/** Project tables first (newest first); the open file's tables the project list missed go on top. */
export function mergeTableLists(project: ProjectTable[], file: ProjectTable[]): ProjectTable[] {
  const known = new Set(project.map(table => `${table.datasetId}:${table.id}`));
  return [...file.filter(table => !known.has(`${table.datasetId}:${table.id}`)), ...project];
}

/** "on cars_EN - weighted 3 Nov" for a table built on another file than the one open. */
export function tableFileNote(table: ProjectTable, openDatasetId: string | undefined): string {
  if (table.filename) return `on ${table.filename}`;
  if (!table.datasetId || table.datasetId === openDatasetId) return '';
  return 'on another file';
}

/** Report cards key by spec id and T number, so a repeated spec id does not collide. */
export function staleCardKey(table: { id: string; number: number }): string {
  return `${table.id}:${table.number}`;
}

export function uniqueStale<T extends { id: string; number: number }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    const key = staleCardKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}
