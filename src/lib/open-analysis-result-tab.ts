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
  if (dv && iv) return `${base} — ${dv} by ${iv}`;
  if (dv) return `${base} — ${dv}`;
  const vars = parameters.variables;
  if (Array.isArray(vars) && vars.length) {
    return `${base} — ${vars.slice(0, 3).join(', ')}`;
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
}) {
  const { tabs, addTab, setActiveTab } = useTabsStore.getState();
  const parameters = params.parameters ?? {};
  const fingerprint = analysisRunFingerprint(params.op, parameters);
  const existing = tabs.find(
    t => t.type === ViewType.ANALYSIS_RESULT && t.data?.analysisFingerprint === fingerprint
  );
  if (existing) {
    setActiveTab(existing.id);
    return existing.id;
  }

  const report = params.envelope?.report as AnalysisReport | undefined;
  const label = formatAnalysisRunTabLabel(params.op, parameters);

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
      filePath: params.sourceDatasetId,
    },
  });

  if (report) {
    appendAnalysisRunToDatasetTab({
      sourceDatasetId: params.sourceDatasetId,
      op: String(params.op),
      runId: params.envelope?.run_id,
      report,
    });
  }

  return useTabsStore.getState().activeTabId;
}
