import { apiClient } from '@/lib/api-client';
import { canRevealConsumedRows } from '@/lib/analysis-runs';
import { useTabsStore, ViewType } from '@/stores/tabs-store';

export function applyProvenanceRowFilter(params: {
  sourceDatasetId: string;
  rowUids: string[];
  rows?: Record<string, unknown>[];
}): number {
  const { tabs, updateTab, setActiveTab } = useTabsStore.getState();
  const sheetTab = tabs.find(
    t =>
      t.type === ViewType.SPREADSHEET &&
      (t.data?.datasetId === params.sourceDatasetId ||
        t.data?.filePath === params.sourceDatasetId ||
        t.path === params.sourceDatasetId)
  );
  if (!sheetTab?.data) return params.rowUids.length;
  updateTab(sheetTab.id, {
    data: {
      ...sheetTab.data,
      rowUidFilter: params.rowUids,
      provenanceOverlayRows: params.rows,
    },
  });
  setActiveTab(sheetTab.id);
  return params.rowUids.length;
}

export async function revealConsumedRowsFromRun(params: {
  runId: string;
  sourceDatasetId: string;
  provenance?: unknown;
  group?: string;
}): Promise<number | null> {
  if (!canRevealConsumedRows(params.provenance)) {
    return null;
  }
  const resolved = await apiClient.datasets.analyze.resolve(params.runId, params.group);
  applyProvenanceRowFilter({
    sourceDatasetId: params.sourceDatasetId,
    rowUids: resolved.row_uids,
    rows: resolved.rows,
  });
  return resolved.row_uids.length;
}
