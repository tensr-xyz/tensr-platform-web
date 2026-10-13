import { apiClient } from '@/lib/api-client';
import type { AnalysisReport, AnalyzeResponse } from '@/lib/analysis-report-types';

export type AnalysisEnvelope = AnalyzeResponse;

export async function runDatasetAnalysis(
  datasetId: string,
  op: string,
  body: Record<string, unknown>
): Promise<AnalysisEnvelope> {
  return apiClient.datasets.analyze.run(datasetId, op, body);
}

/** Map tensr-api correlation result to legacy dialog shape. */
export function adaptCorrelationResults(envelope: AnalysisEnvelope) {
  const raw = envelope.result;
  const cols = (raw.columns as string[]) || [];
  const matrixObj = (raw.matrix as Record<string, Record<string, number>>) || {};
  const correlation_matrix = cols.map(row =>
    cols.map(col => {
      const v = matrixObj[row]?.[col];
      return typeof v === 'number' ? v : Number(v) || 0;
    })
  );
  const report = envelope.report as { summary?: string } | undefined;
  return {
    variables: cols,
    correlation_matrix,
    p_values: cols.map(() => cols.map(() => 0)),
    sample_sizes: cols.map(() => cols.map(() => 0)),
    interpretation: report?.summary || '',
    report_content: JSON.stringify(envelope.report ?? raw, null, 2),
    report_timestamp: new Date().toISOString(),
  };
}

export function adaptLinearRegressionResults(envelope: AnalysisEnvelope) {
  const raw = envelope.result;
  const coeffs = (raw.coefficients as Record<string, number>) || {};
  const pvals = (raw.p_values as Record<string, number>) || {};
  const report = envelope.report as { summary?: string } | undefined;
  return {
    dependent_variable: raw.dependent,
    independent_variables: raw.independents,
    coefficients: coeffs,
    p_values: pvals,
    r_squared: raw.r_squared,
    adj_r_squared: raw.adj_r_squared,
    f_statistic: raw.f_statistic,
    f_pvalue: raw.f_pvalue,
    n_observations: raw.n_observations,
    interpretation: report?.summary || '',
    report_content: JSON.stringify(envelope.report ?? raw, null, 2),
    report_timestamp: new Date().toISOString(),
  };
}

export function adaptAnovaResults(envelope: AnalysisEnvelope) {
  const raw = envelope.result;
  const report = envelope.report as { summary?: string; narrative?: string } | undefined;
  return {
    ...raw,
    effect_size: raw.eta_squared ?? raw.effect_size,
    interpretation: report?.summary || report?.narrative || '',
    report_content: JSON.stringify(envelope.report ?? raw, null, 2),
    report_timestamp: new Date().toISOString(),
  };
}

export function adaptChiSquareResults(envelope: AnalysisEnvelope) {
  const raw = envelope.result;
  const report = envelope.report as { summary?: string } | undefined;
  return {
    ...raw,
    interpretation: report?.summary || '',
    report_content: JSON.stringify(envelope.report ?? raw, null, 2),
    report_timestamp: new Date().toISOString(),
  };
}

export function adaptDescriptivesResults(envelope: AnalysisEnvelope) {
  return envelope.result;
}

export function adaptGenericTestResults(envelope: AnalysisEnvelope) {
  const raw = envelope.result;
  const report = envelope.report as { summary?: string; narrative?: string } | undefined;
  return {
    ...raw,
    interpretation: report?.summary || report?.narrative || '',
    report_content: JSON.stringify(envelope.report ?? raw, null, 2),
    report_timestamp: new Date().toISOString(),
  };
}

export function adaptLogisticRegressionResults(envelope: AnalysisEnvelope) {
  const raw = envelope.result;
  const report = envelope.report as { summary?: string } | undefined;
  return {
    ...raw,
    interpretation: report?.summary || '',
    report_content: JSON.stringify(envelope.report ?? raw, null, 2),
    report_timestamp: new Date().toISOString(),
  };
}

/** Map tensr-api descriptives (`describe` JSON) to legacy means table shape. */
export function adaptDescriptivesToMeans(
  result: Record<string, unknown>
): Record<
  string,
  { n: number; mean: number; std_dev: number; min?: number; max?: number; median?: number }
> {
  const desc = (result.describe as Record<string, Record<string, number>>) || {};
  const cols = (result.columns as string[]) || Object.keys(desc.mean || {});
  const out: Record<
    string,
    { n: number; mean: number; std_dev: number; min?: number; max?: number; median?: number }
  > = {};
  for (const col of cols) {
    out[col] = {
      n: Number(desc.count?.[col] ?? 0),
      mean: Number(desc.mean?.[col] ?? 0),
      std_dev: Number(desc.std?.[col] ?? 0),
      min: desc.min?.[col] != null ? Number(desc.min[col]) : undefined,
      max: desc.max?.[col] != null ? Number(desc.max[col]) : undefined,
      median: desc['50%']?.[col] != null ? Number(desc['50%'][col]) : undefined,
    };
  }
  return out;
}
