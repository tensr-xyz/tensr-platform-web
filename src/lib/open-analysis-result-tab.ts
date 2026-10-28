import { ANALYSIS_LABELS, type AnalysisKey } from '@/lib/analysis-definitions';
import type { AnalysisReport, AnalyzeResponse } from '@/lib/analysis-report-types';
import { appendAnalysisRunToDatasetTab } from '@/lib/analysis-runs';
import { captureProductEvent } from '@/lib/product-analytics';
import { useTabsStore, ViewType } from '@/stores/tabs-store';

function noteReportOpened(params: {
  op: string;
  sourceDatasetId: string;
  envelope?: AnalyzeResponse;
  parameters?: Record<string, unknown>;
}): void {
  const report = params.envelope?.report;
  const runId = params.envelope?.run_id || params.parameters?.run_id;
  if (!report && !runId) return;
  captureProductEvent('report_opened', {
    dataset_id: params.sourceDatasetId,
    analysis_type: params.op,
    source: 'saved_report',
  });
}

export function analysisRunFingerprint(op: string, parameters: Record<string, unknown>): string {
  const sorted = Object.keys(parameters)
    .sort()
    .reduce<Record<string, unknown>>((acc, k) => {
      acc[k] = parameters[k];
      return acc;
    }, {});
  return `${op}:${JSON.stringify(sorted)}`;
}

export function formatAnalysisRunTabLabel(
  op: string,
  parameters: Record<string, unknown>,
  subtitle?: string | null
): string {
  const base = ANALYSIS_LABELS[op as AnalysisKey] || op.replace(/_/g, ' ');
  const heading = subtitle?.trim();
  if (heading) return `${base} — ${heading}`;
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

function specificReportTitle(op: string, report?: AnalysisReport): string | null {
  const title = report?.meta?.title?.trim();
  if (!title) return null;
  const catalog = ANALYSIS_LABELS[op as AnalysisKey];
  if (!catalog) return title;
  if (title === catalog || title.startsWith(`${catalog} (`) || title.startsWith(`${catalog} —`)) {
    return null;
  }
  return title;
}

function bannerCrossFromParameters(parameters: Record<string, unknown>): string | null {
  const names: string[] = [];
  const stubs = parameters.stubs;
  if (Array.isArray(stubs)) {
    for (const item of stubs) {
      if (typeof item === 'string' && item.trim()) names.push(item.trim());
      else if (item && typeof item === 'object' && 'column' in item) {
        const column = String((item as { column?: unknown }).column || '').trim();
        if (column) names.push(column);
      }
    }
  }
  const banner = parameters.banner_column ?? parameters.column_b ?? parameters.banner;
  const bannerText = Array.isArray(banner)
    ? banner
        .map(item => String(item).trim())
        .filter(Boolean)
        .join(', ')
    : String(banner || '').trim();
  if (!names.length || !bannerText) return null;
  return `${names.join(', ')} × ${bannerText}`;
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
  const runId = String(params.envelope?.run_id || '');
  const fingerprint = `${analysisRunFingerprint(params.op, parameters)}:${params.sourceDatasetId}:${runId}`;
  const report = params.envelope?.report as AnalysisReport | undefined;
  const label =
    specificReportTitle(params.op, report) ||
    bannerCrossFromParameters(parameters) ||
    formatAnalysisRunTabLabel(params.op, parameters, report?.meta?.subtitle);
  const existing = tabs.find(
    t => t.type === ViewType.ANALYSIS_RESULT && t.data?.analysisFingerprint === fingerprint
  );
  if (existing) {
    const incoming = report;
    if (incoming && !existing.data?.analysisReport && existing.data) {
      useTabsStore.getState().updateTab(existing.id, {
        name: label,
        data: {
          ...existing.data,
          analysisReport: incoming,
          analysisResult: params.envelope?.result ?? existing.data.analysisResult,
          analysisRunId: params.envelope?.run_id ?? existing.data.analysisRunId,
          analysisProvenance: params.envelope?.provenance ?? existing.data.analysisProvenance,
        },
      });
    }
    if (activate && useTabsStore.getState().activeTabId !== existing.id) {
      setActiveTab(existing.id);
    }
    if (existing.data?.analysisReport || incoming) noteReportOpened(params);
    if (report && runId) {
      appendAnalysisRunToDatasetTab({
        sourceDatasetId: params.sourceDatasetId,
        op: String(params.op),
        runId,
        report,
      });
    }
    return existing.id;
  }
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
    noteReportOpened(params);
    appendAnalysisRunToDatasetTab({
      sourceDatasetId: params.sourceDatasetId,
      op: String(params.op),
      runId: params.envelope?.run_id,
      report,
    });
  }

  return createdId;
}
