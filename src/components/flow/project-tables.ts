import { flowJson } from '@/lib/flow-api';

/** A saved table, with the file it was built on. */
export type ProjectTable = {
  id: string;
  label: string;
  datasetId: string;
  filename: string;
};

type RawRow = {
  spec_id?: string;
  id?: string;
  label?: string;
  name?: string;
  dataset_id?: string;
  filename?: string;
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
  datasetId: string | undefined
): Promise<ProjectTable[]> {
  if (projectId) {
    const page = await flowJson<{ specs?: RawRow[] }>(`/api/projects/${projectId}/tables`).catch(
      () => null
    );
    if (page) return projectTableRows(page.specs);
  }
  if (!datasetId) return [];
  const page = await flowJson<{ specs?: RawRow[] }>(`/datasets/${datasetId}/tables`).catch(() => ({
    specs: [] as RawRow[],
  }));
  return projectTableRows(page.specs, datasetId);
}

/** "on cars_EN - weighted 3 Nov" for a table built on another file than the one open. */
export function tableFileNote(table: ProjectTable, openDatasetId: string | undefined): string {
  if (!table.datasetId || table.datasetId === openDatasetId) return '';
  return table.filename ? `on ${table.filename}` : 'on another file';
}
