import type { AnalysisReport } from '@/lib/analysis-report-types';
import { adoptDerivedDataset, type DerivedDatasetPayload } from '@/lib/adopt-derived-dataset';
import { openAnalysisResultTab } from '@/lib/open-analysis-result-tab';

export type DerivedResultResponse = DerivedDatasetPayload & {
  report?: AnalysisReport;
  provenance?: Record<string, unknown>;
  run_id?: string;
};

/**
 * Switch the open sheet to a saved dataset and add its report (with the R badge) as a
 * background tab. Returns false when no sheet is open, so the caller can navigate instead.
 */
export function showDerivedResult(
  op: string,
  response: DerivedResultResponse,
  parameters: Record<string, unknown>
): boolean {
  const adopted = adoptDerivedDataset({
    dataset_id: response.dataset_id,
    original_filename: response.original_filename,
    n_rows: response.n_rows,
    n_cols: response.n_cols,
    preview: response.preview,
  });
  if (!adopted) return false;
  if (response.report) {
    openAnalysisResultTab({
      op,
      envelope: {
        result: {},
        report: response.report,
        run_id: response.run_id,
        provenance: response.provenance,
      },
      parameters: { ...parameters, derived_dataset_id: response.dataset_id },
      sourceDatasetId: response.dataset_id,
      activate: false,
    });
  }
  return true;
}
