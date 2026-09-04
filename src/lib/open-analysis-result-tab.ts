import { ANALYSIS_LABELS, type AnalysisKey } from '@/lib/analysis-definitions';
import type { AnalysisReport, AnalyzeResponse } from '@/lib/analysis-report-types';
import { appendAnalysisRunToDatasetTab } from '@/lib/analysis-runs';
import { useTabsStore, ViewType } from '@/stores/tabs-store';

export function analysisRunFingerprint(op: string, parameters: Record<string, unknown>): string {
  const sorted = Object.keys(parameters)
    .sort()
    .reduce<Record<string, unknown>>((acc, k) => {
      acc[k] = parameters[k];
      return acc;
    }, {});
  return `${op}:${JSON.stringify(sorted)}`;
}

export function formatAnalysisRunTabLabel(op: string, parameters: Record<string, unknown>): string {
  const base = ANALYSIS_LABELS[op as AnalysisKey] || op.replace(/_/g, ' ');
  const dv =
    parameters.dependent_variable ??
    parameters.dependent ??
    parameters.dependent_var ??
    parameters.dv;
  const iv =
    parameters.independent_variable ??
    parameters.independent ??
    parameters.factor ??
    parameters.group;
  const stub = parameters.stub_column ?? parameters.column_a ?? parameters.stub;
  const banner = parameters.banner_column ?? parameters.column_b ?? parameters.banner;
  if (stub && banner) return `${base} — ${stub} by ${banner}`;
  if (dv && iv) return `${base} — ${dv} by ${iv}`;
  if (dv) return `${base} — ${dv}`;
  const vars = parameters.variables;
  if (Array.isArray(vars) && vars.length) {
    return `${base} — ${vars.slice(0, 3).join(', ')}`;
  }
  const cols = parameters.columns;
  if (Array.isArray(cols) && cols.length) {
    return `${base} — ${cols.slice(0, 3).join(', ')}${cols.length > 3 ? '…' : ''}`;
  }
  return base;
}

/**
 * Opens or focuses a workspace results tab; renders AnalysisReportLayout when report data is present.
 */
export function openAnalysisResultTab(params: {
  op: AnalysisKey | string;
  envelope?: AnalyzeResponse;
  parameters?: Record<string, unknown>;
  sourceDatasetId: string;
  sourceTabName?: string;
  /** When false, create/update the tab without stealing focus (enrichment). */
  activate?: boolean;
}) {
  const activate = params.activate !== false;
  const { tabs, addTab, setActiveTab } = useTabsStore.getState();
  const parameters = params.parameters ?? {};
  const fingerprint = analysisRunFingerprint(params.op, parameters);
  const existing = tabs.find(
    t => t.type === ViewType.ANALYSIS_RESULT && t.data?.analysisFingerprint === fingerprint
  );
  if (existing) {
    if (activate) setActiveTab(existing.id);
    return existing.id;
  }

  const report = params.envelope?.report as AnalysisReport | undefined;
  const label = formatAnalysisRunTabLabel(params.op, parameters);
  const previousActive = useTabsStore.getState().activeTabId;

  addTab({
    name: label,
    type: ViewType.ANALYSIS_RESULT,
    content: '',
    isDirty: false,
    path: params.sourceDatasetId,
    data: {
      analysisOp: params.op,
      sourceDatasetId: params.sourceDatasetId,
      analysisFingerprint: fingerprint,
      analysisParameters: parameters,
      analysisRunId: params.envelope?.run_id,
      analysisReport: report,
      analysisResult: params.envelope?.result,
      analysisProvenance: params.envelope?.provenance,
      filePath: params.sourceDatasetId,
    },
  });

  const created = useTabsStore
    .getState()
    .tabs.find(
      t => t.type === ViewType.ANALYSIS_RESULT && t.data?.analysisFingerprint === fingerprint
    );
  const createdId = created?.id ?? useTabsStore.getState().activeTabId;

  if (!activate && previousActive) {
    setActiveTab(previousActive);
  }

  if (report) {
    appendAnalysisRunToDatasetTab({
      sourceDatasetId: params.sourceDatasetId,
      op: String(params.op),
      runId: params.envelope?.run_id,
      report,
    });
  }

  return createdId;
}
