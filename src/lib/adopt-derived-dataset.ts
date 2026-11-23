import { carryChatToDataset } from '@/stores/chat-store';
import { ViewType, type TabData } from '@/stores/tabs-store';
import { useTabsStore } from '@/stores/tabs-store';
import { useProjectStore } from '@/stores/project-store';

/** Lineage internals — never show these as spreadsheet columns after a transform. */
export const LINEAGE_HIDDEN_COLUMNS = new Set(['_row_uid', '_weight', '_source_row_uids']);

export function userFacingSchemaColumns<T extends { name: string }>(columns: T[]): T[] {
  return columns.filter(c => Boolean(c.name) && !LINEAGE_HIDDEN_COLUMNS.has(c.name));
}

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

/** True when a tool turn saved a working version Sources should list (rake, edit, stack). */
export function toolResultsSavedWorkingVersion(
  toolResults:
    | Array<{
        name?: string;
        result?: Record<string, unknown> | null;
        derived_dataset_id?: string;
        created_dataset?: boolean;
        dataset_id?: string;
      }>
    | undefined
): boolean {
  for (const entry of toolResults ?? []) {
    if (entry.created_dataset === true && String(entry.dataset_id || '').trim()) return true;
    if (String(entry.derived_dataset_id || '').trim()) return true;
    const result = entry.result;
    if (!result || typeof result !== 'object') continue;
    if (String(result.derived_dataset_id || '').trim()) return true;
    const derived = result.derived;
    if (
      derived &&
      typeof derived === 'object' &&
      String((derived as { dataset_id?: string }).dataset_id || '').trim()
    ) {
      return true;
    }
  }
  return false;
}

function entryLooksLikeCoding(
  entry: {
    name?: string;
    procedure?: string;
    producing_operation?: string;
    args?: Record<string, unknown> | null;
    result?: Record<string, unknown> | null;
  } & Record<string, unknown>
): boolean {
  const tokens = [
    entry.name,
    entry.procedure,
    entry.producing_operation,
    entry.args && typeof entry.args === 'object' ? entry.args.analysis_type : '',
    entry.args && typeof entry.args === 'object' ? entry.args.operation : '',
    entry.result && typeof entry.result === 'object' ? entry.result.test : '',
    entry.result && typeof entry.result === 'object' ? entry.result.analysis_type : '',
    entry.result && typeof entry.result === 'object' ? entry.result.method : '',
  ]
    .map(value => String(value || '').toLowerCase())
    .join(' ');
  return (
    tokens.includes('code_open') ||
    tokens.includes('open_end') ||
    tokens.includes('keyword_lexicon') ||
    tokens.includes('coded themes') ||
    Boolean(
      entry.result &&
      typeof entry.result === 'object' &&
      (entry.result.out_column || entry.result.saved_label || entry.result.code_frequency)
    )
  );
}

/** Coded themes file from this turn — put it in use so Tables can find the themes variable. */
export function codingDerivedDatasetIdFromToolResults(
  toolResults:
    | Array<{
        name?: string;
        procedure?: string;
        producing_operation?: string;
        args?: Record<string, unknown> | null;
        result?: Record<string, unknown> | null;
        derived_dataset_id?: string;
        saved_dataset_id?: string;
        dataset_id?: string;
      }>
    | undefined
): string | null {
  let latest: string | null = null;
  for (const entry of toolResults ?? []) {
    const record = entry as typeof entry & Record<string, unknown>;
    if (!entryLooksLikeCoding(record)) continue;
    const result = entry.result && typeof entry.result === 'object' ? entry.result : null;
    const nested =
      result?.derived && typeof result.derived === 'object'
        ? (result.derived as Record<string, unknown>)
        : null;
    const id = String(
      result?.derived_dataset_id ||
        result?.saved_dataset_id ||
        nested?.dataset_id ||
        entry.derived_dataset_id ||
        entry.saved_dataset_id ||
        ''
    ).trim();
    if (id) latest = id;
  }
  return latest;
}

export function derivedDatasetFromToolResults(
  toolResults: Array<{ name?: string; result?: Record<string, unknown> | null }> | undefined
): DerivedDatasetPayload | null {
  let latest: DerivedDatasetPayload | null = null;
  for (const entry of toolResults ?? []) {
    if (entry.name !== 'data_edit' && entry.name !== 'run_analysis') continue;
    const result = entry.result;
    if (!result || result.ok === false || result.executed !== true) continue;
    if (result.apply_to_ui === false) continue;
    const nested =
      result.derived && typeof result.derived === 'object'
        ? (result.derived as Record<string, unknown>)
        : null;
    // Analyses only replace the sheet when they return a new dataset preview (e.g. merge).
    if (entry.name === 'run_analysis' && !nested?.preview) continue;
    const id = String(result.derived_dataset_id || nested?.dataset_id || '').trim();
    if (!id) continue;
    latest = {
      dataset_id: id,
      original_filename:
        typeof nested?.original_filename === 'string' ? nested.original_filename : undefined,
      n_rows:
        typeof result.n_rows === 'number' ? result.n_rows : (nested?.n_rows as number | undefined),
      n_cols: typeof nested?.n_cols === 'number' ? nested.n_cols : undefined,
      preview: nested?.preview as DerivedDatasetPayload['preview'],
    };
  }
  return latest;
}

/** A chat stack returns the new dataset on the tool result. Open it the way Merge does. */
export function createdDatasetFromToolResults(
  toolResults: Array<Record<string, unknown>> | undefined
): DerivedDatasetPayload | null {
  let latest: DerivedDatasetPayload | null = null;
  for (const entry of toolResults ?? []) {
    if (entry.created_dataset !== true) continue;
    const id = String(entry.dataset_id || '').trim();
    if (!id) continue;
    latest = {
      dataset_id: id,
      original_filename:
        typeof entry.original_filename === 'string' ? entry.original_filename : undefined,
      n_rows: typeof entry.n_rows === 'number' ? entry.n_rows : undefined,
    };
  }
  return latest;
}

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
  let sheet =
    active?.type === ViewType.SPREADSHEET
      ? active
      : tabsState.tabs.find(t => t.type === ViewType.SPREADSHEET);
  if (!sheet) {
    // A full navigation to the new dataset remounts the workspace and the login
    // gate treats a missing Stytch cookie as signed out. Stay on this page.
    tabsState.addTab({
      name: result.original_filename || 'Dataset',
      type: ViewType.SPREADSHEET,
      content: '',
      isDirty: false,
      data: {},
    });
    const opened = useTabsStore.getState();
    sheet = opened.tabs.find(t => t.id === opened.activeTabId && t.type === ViewType.SPREADSHEET);
  }
  if (!sheet) return false;

  const data = spreadsheetPatchFromDerivedDataset(sheet.data, result);
  tabsState.updateTab(sheet.id, {
    name: result.original_filename || sheet.name,
    data,
  });
  tabsState.setActiveTab(sheet.id);

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
    const previousId = String(sheet.data?.datasetId || sheet.data?.filePath || '');
    project.setFileSystem(
      project.fileSystem.map(f => (f.fileId && f.fileId === previousId ? { ...f, fileId: id } : f))
    );
  }

  const projectId = useProjectStore.getState().currentProject?.id;
  if (projectId) carryChatToDataset(String(projectId), id);

  if (typeof window !== 'undefined') {
    // Next.js patches history.replaceState and treats it as a navigation.
    // That remounts Workspace on the new dataset id and opens an empty chat.
    // The prototype call updates the address bar and leaves this chat mounted.
    History.prototype.replaceState.call(
      window.history,
      window.history.state,
      '',
      derivedWorkspacePath(id, result.original_filename)
    );
  }
  return true;
}
