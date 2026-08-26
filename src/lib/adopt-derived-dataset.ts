import { ViewType, type TabData } from '@/stores/tabs-store';
import { useTabsStore } from '@/stores/tabs-store';
import { useProjectStore } from '@/stores/project-store';

/** Lineage internals — never show these as spreadsheet columns after a transform. */
export const LINEAGE_HIDDEN_COLUMNS = new Set(['_row_uid', '_weight']);

export type DerivedDatasetPayload = {
  dataset_id: string;
  original_filename?: string;
  n_rows?: number;
  n_cols?: number;
  preview?: {
    headers?: string[];
    variable_names?: string[];
    rows?: unknown[][];
    columns?: Array<{ name: string; type?: string; label?: string | null }>;
  };
};

export function derivedWorkspacePath(datasetId: string, filename?: string): string {
  const name = filename?.trim();
  const q = name ? `?name=${encodeURIComponent(name)}` : '';
  return `/workspace/dataset/${datasetId}${q}`;
}

export function spreadsheetPatchFromDerivedDataset(
  current: TabData | undefined,
  result: DerivedDatasetPayload
): TabData {
  const rawNames = (result.preview?.variable_names || result.preview?.headers || []).map(String);
  const rawLabels = (result.preview?.headers || rawNames).map(String);
  const typeByName = Object.fromEntries(
    (result.preview?.columns || []).map(c => [c.name, c.type || 'string'])
  );
  const existingById = Object.fromEntries((current?.initialColumns || []).map(c => [c.id, c]));
  const visibleIdx = rawNames
    .map((_, i) => i)
    .filter(i => rawNames[i] && !LINEAGE_HIDDEN_COLUMNS.has(rawNames[i]));

  const next: TabData = {
    ...(current || {}),
    datasetId: result.dataset_id,
    filePath: result.dataset_id,
    totalRows: result.n_rows ?? current?.totalRows,
    totalColumns: visibleIdx.length || result.n_cols || current?.totalColumns,
  };

  if (visibleIdx.length) {
    next.initialColumns = visibleIdx.map(i => {
      const name = rawNames[i];
      const prev = existingById[name];
      return {
        id: name,
        accessor: name,
        header: rawLabels[i] || prev?.header || name,
        width: prev?.width ?? 150,
        type: typeByName[name] || prev?.type || 'string',
      };
    });
    if (result.preview?.rows) {
      next.initialData = result.preview.rows.map(row => {
        const obj: Record<string, unknown> = {};
        for (const i of visibleIdx) {
          obj[rawNames[i]] = Array.isArray(row) ? row[i] : undefined;
        }
        return obj;
      }) as TabData['initialData'];
    }
  }

  return next;
}

/** Update the open spreadsheet + address bar without router.push (Workspace remounts on datasetId). */
export function adoptDerivedDataset(result: DerivedDatasetPayload): boolean {
  const id = String(result.dataset_id || '').trim();
  if (!id) return false;

  const tabsState = useTabsStore.getState();
  const active = tabsState.tabs.find(t => t.id === tabsState.activeTabId);
  const sheet =
    active?.type === ViewType.SPREADSHEET
      ? active
      : tabsState.tabs.find(t => t.type === ViewType.SPREADSHEET);
  if (!sheet) return false;

  const data = spreadsheetPatchFromDerivedDataset(sheet.data, result);
  tabsState.updateTab(sheet.id, {
    name: result.original_filename || sheet.name,
    data,
  });

  const project = useProjectStore.getState();
  if (project.importData) {
    project.setImportData({
      ...project.importData,
      fileId: id,
      filePath: id,
      fileName: result.original_filename || project.importData.fileName,
      totalRows: result.n_rows ?? project.importData.totalRows,
      totalColumns: data.totalColumns ?? project.importData.totalColumns,
    });
  }
  if (project.fileSystem.length) {
    project.setFileSystem(project.fileSystem.map(f => (f.fileId ? { ...f, fileId: id } : f)));
  }

  if (typeof window !== 'undefined') {
    window.history.replaceState(
      window.history.state,
      '',
      derivedWorkspacePath(id, result.original_filename)
    );
  }
  return true;
}
