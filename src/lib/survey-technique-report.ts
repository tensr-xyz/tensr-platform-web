import type { AnalysisReport, AnalyzeResponse } from '@/lib/analysis-report-types';
import { openAnalysisResultTab } from '@/lib/open-analysis-result-tab';

export const SURVEY_TECHNIQUE_OPS = [
  'nps',
  'turf',
  'drivers',
  'correspondence',
  'van_westendorp',
  'gabor_granger',
  'funnel',
  'maxdiff_count',
  'maxdiff_mnl',
  'maxdiff_hb',
  'conjoint_mnl',
  'conjoint_hb',
  'batch_tables',
  'fuse_waves',
  'verbatim',
  'code_open_text',
] as const;

export type TechniqueRunResult = {
  payload: Record<string, unknown>;
  reportRequest: { op: string; parameters: Record<string, unknown> };
};

/** Wrap a technique response so the dialog opens a report tab instead of printing JSON. */
export function techniqueRun(
  payload: unknown,
  reportRequest: { op: string; parameters: Record<string, unknown> }
): TechniqueRunResult {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('This technique did not return a report');
  }
  return { payload: payload as Record<string, unknown>, reportRequest };
}

export function isTechniqueRun(value: unknown): value is TechniqueRunResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as TechniqueRunResult;
  return Boolean(
    candidate.reportRequest?.op && candidate.payload && typeof candidate.payload === 'object'
  );
}

/**
 * Report tab envelope. The raw technique payload is omitted so the tab does not
 * render a JSON blob; provenance stays on the envelope for the banner.
 */
export function envelopeForSurveyTechnique(
  response: Record<string, unknown>
): AnalyzeResponse | null {
  const report = response.report;
  if (!report || typeof report !== 'object' || Array.isArray(report)) return null;
  const provenance = response.provenance;
  const convention = response.convention;
  return {
    result: {},
    report: report as AnalysisReport,
    run_id: typeof response.run_id === 'string' ? response.run_id : undefined,
    provenance:
      provenance && typeof provenance === 'object' && !Array.isArray(provenance)
        ? (provenance as Record<string, unknown>)
        : undefined,
    convention:
      convention && typeof convention === 'object' && !Array.isArray(convention)
        ? (convention as Record<string, unknown>)
        : undefined,
  };
}

export function openSurveyTechniqueReport(params: {
  datasetId: string;
  op: string;
  parameters: Record<string, unknown>;
  response: Record<string, unknown>;
  sourceTabName?: string;
}): string {
  const envelope = envelopeForSurveyTechnique(params.response);
  if (!envelope) {
    throw new Error('This technique did not return a report');
  }
  const tabId = openAnalysisResultTab({
    op: params.op,
    envelope,
    parameters: params.parameters,
    sourceDatasetId: params.datasetId,
    sourceTabName: params.sourceTabName,
  });
  if (!tabId) {
    throw new Error('This technique did not return a report');
  }
  return tabId;
}
