import { apiClient } from '@/lib/api-client';
import type { AnalysisReport, AnalyzeResponse } from '@/lib/analysis-report-types';
import { ANALYSIS_LABELS, type AnalysisKey } from '@/lib/analysis-definitions';
import { isRetiredFromUi, retiredFromUiUserMessage } from '@/lib/retired-from-ui';
import { openAnalysisResultTab } from '@/lib/open-analysis-result-tab';
import { useTabsStore, ViewType, type AgentAnalysisHistoryEntry } from '@/stores/tabs-store';

export type ProvenanceTraceState =
  | { kind: 'unknown' }
  | { kind: 'complete' }
  | { kind: 'unavailable'; reason: string };

export const PLUGIN_UNVERIFIED_STATEMENT =
  'Plugin output is unverified. These numbers cannot be traced to the rows they came from.';

export function provenanceTraceState(provenance: unknown): ProvenanceTraceState {
  if (provenance === undefined || provenance === null || typeof provenance !== 'object') {
    return { kind: 'unknown' };
  }
  const p = provenance as Record<string, unknown>;
  const unavailable = p.provenance_unavailable;
  if (typeof unavailable === 'string' && unavailable.trim()) {
    return { kind: 'unavailable', reason: unavailable.trim() };
  }
  const miss = p.row_uid_bitset_miss_count;
  const bitset = p.row_uid_bitset;
  if (typeof miss === 'number' && miss > 0) {
    return { kind: 'unavailable', reason: 'unknown_row_uids' };
  }
  if (typeof bitset === 'string' && bitset && (miss == null || miss === 0)) {
    return { kind: 'complete' };
  }
  return { kind: 'unknown' };
}

export function provenanceBannerText(state: ProvenanceTraceState): string | null {
  if (state.kind === 'unknown') {
    return (
      'Traceability unknown. This run has no stored provenance. ' +
      'Numbers cannot be traced to the rows they came from.'
    );
  }
  if (state.kind === 'unavailable') {
    return (
      `Provenance unavailable: ${state.reason}. ` +
      'These numbers should not be trusted as a complete row set.'
    );
  }
  return null;
}

export function canRevealConsumedRows(provenance: unknown): boolean {
  return provenanceTraceState(provenance).kind === 'complete';
}

export type RSyntaxVerificationKind = 'verified' | 'verified_in_ci' | 'not_verified' | 'unknown';

export type RSyntaxVerification = {
  kind: RSyntaxVerificationKind;
  reason?: string;
  statement?: string;
  build_id?: string;
  delta?: { f?: number; df_between?: number; df_within?: number; n?: number };
};

export function rSyntaxVerificationState(value: unknown): RSyntaxVerification {
  if (!value || typeof value !== 'object') {
    return {
      kind: 'unknown',
      reason: 'missing',
      statement: 'R syntax reproduction unknown.',
    };
  }
  const v = value as Record<string, unknown>;
  if (
    v.kind === 'verified' ||
    v.kind === 'verified_in_ci' ||
    v.kind === 'not_verified' ||
    v.kind === 'unknown'
  ) {
    return {
      kind: v.kind,
      reason: typeof v.reason === 'string' ? v.reason : undefined,
      statement: typeof v.statement === 'string' ? v.statement : undefined,
      build_id: typeof v.build_id === 'string' ? v.build_id : undefined,
      delta: v.delta as RSyntaxVerification['delta'],
    };
  }
  return {
    kind: 'unknown',
    reason: 'missing',
    statement: 'R syntax reproduction unknown.',
  };
}

export function rSyntaxBadgeText(value: unknown): { kind: RSyntaxVerificationKind; text: string } {
  const state = rSyntaxVerificationState(value);
  if (state.kind === 'verified') {
    return { kind: 'verified', text: state.statement || 'R syntax reproduced F, df and n.' };
  }
  if (state.kind === 'verified_in_ci') {
    return {
      kind: 'verified_in_ci',
      text: state.statement || 'This syntax reproduced against a reference dataset on this build.',
    };
  }
  if (state.kind === 'not_verified') {
    return {
      kind: 'not_verified',
      text: state.statement || 'Generated R does not reproduce the engine result.',
    };
  }
  return {
    kind: 'unknown',
    text: state.statement || 'R syntax reproduction unknown.',
  };
}

export type StoredAnalysisRun = {
  id: string;
  dataset_id: string;
  op: string;
  created_at: string;
  report: AnalysisReport;
  result: Record<string, unknown>;
  provenance?: Record<string, unknown> | null;
};

export async function listDatasetAnalysisRuns(datasetId: string): Promise<StoredAnalysisRun[]> {
  const res = await apiClient.datasets.analyze.listRuns(datasetId);
  const runs = Array.isArray(res) ? res : ((res as { runs?: StoredAnalysisRun[] })?.runs ?? []);
  return runs.map(normalizeStoredAnalysisRun).filter((r): r is StoredAnalysisRun => r !== null);
}

export async function fetchAnalysisRun(runId: string): Promise<StoredAnalysisRun | null> {
  try {
    const row = await apiClient.datasets.analyze.get(runId);
    return normalizeStoredAnalysisRun(row);
  } catch {
    return null;
  }
}

export async function openStoredAnalysisRun(run: StoredAnalysisRun): Promise<void> {
  const envelope: AnalyzeResponse = {
    result: run.result,
    report: run.report,
    run_id: run.id,
    provenance: run.provenance ?? undefined,
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

function stubReportForOp(op: string, createdAt: string): AnalysisReport {
  const title = ANALYSIS_LABELS[op as AnalysisKey] || op.replace(/_/g, ' ');
  const summary = isRetiredFromUi(op)
    ? retiredFromUiUserMessage(op)
    : 'This saved run has no stored report. The original output cannot be reconstructed from the list entry.';
  return {
    meta: {
      analysis_key: op,
      title,
      subtitle: '',
      generated_at: createdAt || new Date().toISOString(),
      rows_dataset: 0,
    },
    summary,
    metrics: [],
    tables: [],
    trust: { notes: [], warnings: [] },
  };
}

export function normalizeStoredAnalysisRun(row: unknown): StoredAnalysisRun | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const id = String(r.id ?? '');
  const dataset_id = String(r.dataset_id ?? '');
  const op = String(r.op ?? '');
  if (!id || !dataset_id || !op) return null;
  const created_at = String(r.created_at ?? '');
  const report = r.report as AnalysisReport | undefined;
  return {
    id,
    dataset_id,
    op,
    created_at,
    report: report?.meta ? report : stubReportForOp(op, created_at),
    result: (r.result as Record<string, unknown>) ?? {},
    provenance:
      r.provenance && typeof r.provenance === 'object'
        ? (r.provenance as Record<string, unknown>)
        : null,
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
