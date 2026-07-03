import type { Tab } from '@/stores/tabs-store';
import { ViewType } from '@/stores/tabs-store';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isDatasetId(value: string | undefined | null): value is string {
  return !!value && UUID_RE.test(value);
}

type TabDatasetFields = {
  datasetId?: string;
  fileId?: string;
  filePath?: string;
};

/** Resolve tensr-api dataset id from a workspace tab or path string. */
export function getDatasetIdFromTab(tab: Tab | undefined): string | null {
  if (!tab) return null;
  const data = tab.data as TabDatasetFields | undefined;
  if (data?.datasetId && isDatasetId(data.datasetId)) return data.datasetId;
  if (data?.fileId && isDatasetId(data.fileId)) return data.fileId;
  return getDatasetIdFromPath(data?.filePath) ?? getDatasetIdFromPath(tab.path) ?? null;
}

/**
 * When filePath is a project id (not the dataset), pick fileId from the project file list.
 */
export function resolveWorkspaceDatasetId(options: {
  tab?: Tab;
  projectId?: string | null;
  fileSystem?: Array<{ fileId?: string }>;
}): string | null {
  const fromTab = getDatasetIdFromTab(options.tab);
  if (fromTab) return fromTab;

  const projectId = options.projectId?.trim();
  if (!projectId || !isDatasetId(projectId)) return null;

  const fileEntry = options.fileSystem?.find(f => f.fileId && isDatasetId(f.fileId));
  if (fileEntry?.fileId) return fileEntry.fileId;

  // Single-dataset projects often use the same UUID for project and dataset.
  return projectId;
}

export function getDatasetIdFromPath(filePath: string | undefined): string | null {
  if (!filePath) return null;
  const trimmed: string = String(filePath).trim();
  if (isDatasetId(trimmed)) return trimmed;
  const match = (trimmed as any).match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i
  );
  return match ? match[0] : null;
}

export const WORKSPACE_DATASET_REQUIRED =
  'Open a dataset in the workspace (from Home → open dataset) before running this action.';

/** Spreadsheet tab whose columns/filters power side panels (including when an analysis result tab is active). */
export function resolveSpreadsheetContextTab(
  tabs: Tab[],
  activeTab: Tab | undefined
): Tab | undefined {
  if (!activeTab) return undefined;

  if (activeTab.type === ViewType.SPREADSHEET && activeTab.data) {
    return activeTab;
  }

  if (activeTab.type === ViewType.ANALYSIS_RESULT) {
    const sourceId = activeTab.data?.sourceDatasetId ?? getDatasetIdFromTab(activeTab);
    if (!sourceId) return undefined;

    return tabs.find(
      t => t.type === ViewType.SPREADSHEET && getDatasetIdFromTab(t) === sourceId && t.data
    );
  }

  return undefined;
}
