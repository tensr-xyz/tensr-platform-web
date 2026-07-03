import { apiClient } from '@/lib/api-client';
import type { AnalysisReport, AnalyzeResponse } from '@/lib/analysis-report-types';
import { openAnalysisResultTab } from '@/lib/open-analysis-result-tab';
import { useTabsStore, ViewType, type AgentAnalysisHistoryEntry } from '@/stores/tabs-store';
export type StoredAnalysisRun = {
  id: string;
  dataset_id: string;
  op: string;
  created_at: string;
  report: AnalysisReport;
  result: Record<string, unknown>;
};

export async function listDatasetAnalysisRuns(datasetId: string): Promise<StoredAnalysisRun[]> {
  const res = await apiClient.datasets.analyze.listRuns(datasetId);
  const runs = Array.isArray(res) ? res : ((res as { runs?: StoredAnalysisRun[] })?.runs ?? []);
  return runs.map(normalizeRun).filter((r): r is StoredAnalysisRun => r !== null);
}

export async function fetchAnalysisRun(runId: string): Promise<StoredAnalysisRun | null> {
  try {
    const row = await apiClient.datasets.analyze.get(runId);
    return normalizeRun(row);
  } catch {
    return null;
  }
}

export async function openStoredAnalysisRun(run: StoredAnalysisRun): Promise<void> {
  const envelope: AnalyzeResponse = {
    result: run.result,
    report: run.report,
    run_id: run.id,
  };
  openAnalysisResultTab({
    op: run.op,
    envelope,
    parameters: { run_id: run.id },
    sourceDatasetId: run.dataset_id,
  });
}

export async function openAnalysisRunById(runId: string): Promise<boolean> {
  const run = await fetchAnalysisRun(runId);
  if (!run) return false;
  await openStoredAnalysisRun(run);
  return true;
}

/** Link a completed run to the source dataset spreadsheet tab (in-session list). */
export function appendAnalysisRunToDatasetTab(params: {
  sourceDatasetId: string;
  op: string;
  runId?: string;
  report: AnalysisReport;
}): void {
  const { tabs, updateTab } = useTabsStore.getState();
  const sheetTab = tabs.find(
    t =>
      t.type === ViewType.SPREADSHEET &&
      (t.data?.filePath === params.sourceDatasetId ||
        t.path === params.sourceDatasetId ||
        t.data?.filePath?.includes(params.sourceDatasetId))
  );
  if (!sheetTab?.data) return;

  const entry: AgentAnalysisHistoryEntry = {
    id: params.runId ?? `local-${Date.now()}`,
    createdAt: params.report.meta.generated_at || new Date().toISOString(),
    analysisType: params.op,
    content: params.report.summary || params.report.meta.title,
    subtitle: params.report.meta.subtitle,
    runId: params.runId,
  };

  const prev = sheetTab.data.analysisHistory ?? [];
  if (params.runId && prev.some(e => e.runId === params.runId)) return;

  updateTab(sheetTab.id, {
    data: {
      ...sheetTab.data,
      analysisHistory: [entry, ...prev].slice(0, 30),
    },
  });
}

function normalizeRun(row: unknown): StoredAnalysisRun | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const id = String(r.id ?? '');
  const dataset_id = String(r.dataset_id ?? '');
  const op = String(r.op ?? '');
  if (!id || !dataset_id || !op) return null;
  const report = r.report as AnalysisReport | undefined;
  if (!report?.meta) return null;
  return {
    id,
    dataset_id,
    op,
    created_at: String(r.created_at ?? ''),
    report,
    result: (r.result as Record<string, unknown>) ?? {},
  };
}

export function formatRunLabel(run: StoredAnalysisRun): string {
  const title = run.report.meta.title || run.op.replace(/_/g, ' ');
  const sub = run.report.meta.subtitle;
  return sub ? `${title} · ${sub}` : title;
}

export function formatRunTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
