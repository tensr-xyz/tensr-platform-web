import { tensrApiUrl } from '@/lib/tensr-api-url';
import { ApiRequestError, formatApiErrorMessage } from '@/lib/api-error';
import type { AnalysisReport } from '@/lib/analysis-report-types';

async function authedJson<T>(
  path: string,
  body: Record<string, unknown>,
  token?: string | null
): Promise<T> {
  const res = await fetch(tensrApiUrl(path), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      formatApiErrorMessage(
        new ApiRequestError(res.status, text || `Request failed (${res.status})`)
      )
    );
  }
  return res.json() as Promise<T>;
}

export type DuplicateDetectionResult = {
  duplicates: Array<{
    row_index: number;
    values: Record<string, string>;
    duplicate_group: number;
  }>;
  total_duplicates: number;
  duplicate_groups: number;
  affected_rows: number[];
};

export type MergeReport = {
  how?: string;
  row_count?: number;
  rows_already_in_file?: boolean;
  unmatched_left_count?: number;
  unmatched_right_count?: number;
  unmatched_left_keys?: string[];
  unmatched_right_keys?: string[];
  duplicate_key_count_left?: number;
  duplicate_key_count_right?: number;
  warnings?: string[];
  columns_only_left?: string[];
  columns_only_right?: string[];
  column_suffixes?: string[];
  source_wave_column?: string;
  duplicate_ids?: Array<{ column: string; count: number; ids: string[] }>;
  type_coercions?: Array<{ column: string; action: string; detail: string }>;
  key_map?: Array<{ left: string; right: string }>;
  label_conflicts?: Array<{
    column: string;
    kind: string;
    code?: string;
    label?: string;
    left_label?: string;
    right_label?: string;
    left_code?: string;
    right_code?: string;
  }>;
};

export type MergeDatasetsPayload = {
  secondary_dataset_id?: string;
  sources?: Array<{ dataset_id: string; label?: string }>;
  merge_type: 'add_cases' | 'add_variables' | 'stack' | 'inner' | 'left' | 'right' | 'outer';
  keys?: string[];
  key_map?: Record<string, string>;
  allow_many?: boolean;
  preview?: boolean;
};

export type DerivedDatasetResult = {
  dataset_id: string;
  derived_dataset_id?: string;
  original_filename: string;
  n_rows: number;
  n_cols: number;
  replaced_values_count?: number;
  merge_report?: MergeReport;
  preview?: {
    headers: string[];
    variable_names: string[];
    rows: unknown[][];
    columns: { name: string; type: string }[];
  };
  report?: AnalysisReport;
  provenance?: Record<string, unknown>;
};

export function findDatasetDuplicates(
  datasetId: string,
  payload: { columns: string[]; match_case: boolean; first_case_only: boolean },
  token?: string | null
) {
  return authedJson<DuplicateDetectionResult>(
    `/datasets/${datasetId}/find-duplicates`,
    payload,
    token
  );
}

export function imputeDatasetMissing(
  datasetId: string,
  payload: {
    columns: string[];
    method: string;
    custom_value?: string | null;
    sort_column?: string | null;
    group_column?: string | null;
  },
  token?: string | null
) {
  return authedJson<DerivedDatasetResult>(`/datasets/${datasetId}/impute-missing`, payload, token);
}

export type MergePreviewResult = {
  preview: true;
  row_count: number;
  columns: string[];
  merge_report: MergeReport;
};

export function replayOperations(
  datasetId: string,
  payload: { operation_list: Record<string, unknown>; inputs?: Record<string, string> },
  token?: string | null
) {
  return authedJson<DerivedDatasetResult & { replay_report?: Record<string, unknown> }>(
    `/datasets/${datasetId}/operations/replay`,
    payload,
    token
  );
}

export function setActiveWeight(datasetId: string, column: string | null, token?: string | null) {
  return authedJson<{ ok: boolean; active_weight_column: string | null; warnings: string[] }>(
    `/datasets/${datasetId}/weights/active`,
    { column },
    token
  );
}

export function mergeDatasets(
  datasetId: string,
  payload: MergeDatasetsPayload,
  token?: string | null
) {
  return authedJson<DerivedDatasetResult | MergePreviewResult>(
    `/datasets/${datasetId}/merge`,
    payload,
    token
  );
}

export function standardizeDataset(
  datasetId: string,
  payload: { columns: string[]; suffix?: string },
  token?: string | null
) {
  return authedJson<DerivedDatasetResult>(`/datasets/${datasetId}/standardize`, payload, token);
}

export function binDatasetColumn(
  datasetId: string,
  payload: {
    source_column: string;
    n_bins: number;
    strategy: 'equal_width' | 'equal_frequency';
    target_column?: string;
  },
  token?: string | null
) {
  return authedJson<DerivedDatasetResult>(`/datasets/${datasetId}/bin`, payload, token);
}

export function computeDataset(
  datasetId: string,
  payload: { transforms: Array<Record<string, unknown>> },
  token?: string | null
) {
  return authedJson<DerivedDatasetResult>(`/datasets/${datasetId}/compute`, payload, token);
}

export function recodeDatasetColumn(
  datasetId: string,
  payload: {
    source_column: string;
    mappings: { from_value: string; to_value: string }[];
    replace_existing: boolean;
    target_column?: string;
    unmapped_policy?: 'missing' | 'copy' | 'other';
    unmapped_other?: string;
  },
  token?: string | null
) {
  return authedJson<DerivedDatasetResult>(`/datasets/${datasetId}/recode`, payload, token);
}

export function shiftDatasetColumns(
  datasetId: string,
  payload: { columns: string[]; direction: 'lag' | 'lead'; periods: number },
  token?: string | null
) {
  return authedJson<DerivedDatasetResult>(`/datasets/${datasetId}/shift`, payload, token);
}

export function rankDatasetCases(
  datasetId: string,
  payload: {
    columns: string[];
    method?: 'ordinal' | 'fractional' | 'average' | 'dense' | 'min' | 'max' | 'savage';
    suffix?: string;
  },
  token?: string | null
) {
  return authedJson<DerivedDatasetResult>(`/datasets/${datasetId}/rank-cases`, payload, token);
}

export function standardizeDatasetValues(
  datasetId: string,
  payload: {
    columns: string[];
    method?: 'zscore' | 'minmax' | 'robust';
    suffix?: string;
  },
  token?: string | null
) {
  return authedJson<DerivedDatasetResult>(
    `/datasets/${datasetId}/standardize-values`,
    payload,
    token
  );
}

export type CreateVariablesOperation =
  | 'log'
  | 'sqrt'
  | 'center'
  | 'standardize'
  | 'rank'
  | 'unit_interval'
  | 'case_shares';

export type CreateVariablesScope = 'variable' | 'case';

export type CreateVariablesResult = DerivedDatasetResult & {
  created_columns?: string[];
};

/** Log/sqrt copies, within-case or within-variable scaling, and case-level shares. */
export function createDatasetVariables(
  datasetId: string,
  payload: {
    columns: string[];
    operation: CreateVariablesOperation;
    scope?: CreateVariablesScope;
    suffix?: string | null;
  },
  token?: string | null
) {
  return authedJson<CreateVariablesResult>(
    `/datasets/${datasetId}/create-variables`,
    payload as Record<string, unknown>,
    token
  );
}

export type RakeWeightsResult = DerivedDatasetResult & {
  derived_dataset_id: string;
  parent_dataset_id?: string;
  weight_vector?: { identity?: string; method?: string };
  diagnostics?: {
    missing_category_warning?: string;
    kish_ess?: number;
    deff?: number;
    weighting_efficiency?: number;
    min_weight?: number;
    max_weight?: number;
  };
};

export function poststratifyDatasetWeights(
  datasetId: string,
  payload: {
    variables: string[];
    cells: Record<string, number>;
    missing_handling?: 'exclude' | 'impute' | 'missing_target';
    weight_label?: string;
  },
  token?: string | null
) {
  return authedJson<RakeWeightsResult>(
    `/datasets/${datasetId}/weights/poststratify`,
    payload,
    token
  );
}

export function exportPipelineScript(datasetId: string, token?: string | null) {
  return authedJson<{
    ok: boolean;
    r_script: string;
    python_script?: string;
    spss_syntax?: string;
  }>(`/datasets/${datasetId}/script`, {}, token);
}

export function rakeDatasetWeights(
  datasetId: string,
  payload: {
    categorical_targets: Record<string, Record<string, number>>;
    missing_handling?: 'exclude' | 'impute' | 'missing_target';
    targets_filename?: string;
    weight_label?: string;
    lower?: number;
    upper?: number;
    design_weight_column?: string;
    use_existing_weight?: boolean;
    weighted_total?: number;
  },
  token?: string | null
) {
  return authedJson<RakeWeightsResult>(`/datasets/${datasetId}/weights/rake`, payload, token);
}

export function combineDatasetWeights(
  datasetId: string,
  payload: { columns: string[]; total?: number; weight_label?: string },
  token?: string | null
) {
  return authedJson<RakeWeightsResult>(`/datasets/${datasetId}/weights/combine`, payload, token);
}

export function scaleDatasetWeightTotal(
  datasetId: string,
  payload: { total: number; weight_column?: string; weight_label?: string },
  token?: string | null
) {
  return authedJson<RakeWeightsResult>(
    `/datasets/${datasetId}/weights/scale-total`,
    payload,
    token
  );
}

export type DataQualityReport = {
  n_rows: number;
  n_columns: number;
  overall_score: number;
  summary: string;
  columns: Array<{
    name: string;
    inferred_type: string;
    missing_count: number;
    pct_complete: number;
    unique_count: number;
    issues: string[];
    /** Present when inferred_type is one of "date" | "likert" | "id" — the target_type to
     *  pass to `fix-data-types` for this column. */
    suggested_cast?: string | null;
    /** Human-readable explanation of `suggested_cast`, for display only. */
    type_suggestion?: string | null;
  }>;
  script_findings?: Array<{
    market?: string;
    variable?: string;
    count?: number;
    kind?: string;
    message: string;
  }>;
};

export async function fetchDataQualityReport(datasetId: string, token?: string | null) {
  const res = await fetch(tensrApiUrl(`/datasets/${datasetId}/data-quality`), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<DataQualityReport>;
}

export type ResponseQualityDecision = 'keep' | 'review' | 'remove';

export type ResponseQualityReport = {
  id_column: string | null;
  respondents: number;
  summary: {
    flagged?: number;
    speeder_rows?: number;
    straightline_rows?: number;
    trap_rows?: number;
    bot_rows?: number;
    duplicate_rows?: number;
    outlier_rows?: number;
    poor_text_rows?: number;
    non_substantive_rows?: number;
    keep?: number;
    review?: number;
    remove?: number;
    would_remove?: number;
    would_review?: number;
    respondents?: number;
  };
  rows: Array<{
    row_index: number;
    respondent_id: string;
    flags: string[];
    reasons: string[];
    score: number;
    decision: ResponseQualityDecision;
  }>;
  removal_list: Array<{
    respondent_id: string;
    row_index: number;
    reasons: string[];
  }>;
  flag_labels: Record<string, string>;
};

export async function fetchResponseQualityReport(datasetId: string, token?: string | null) {
  const res = await fetch(tensrApiUrl(`/datasets/${datasetId}/response-quality`), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<ResponseQualityReport>;
}

export function applyResponseQualityRemovals(
  datasetId: string,
  payload: { row_indices?: number[]; respondent_ids?: string[]; filename?: string },
  token?: string | null
) {
  return authedJson<{
    dataset_id: string;
    rows_before: number;
    rows_after: number;
    removed: number;
    original_filename?: string;
  }>(`/datasets/${datasetId}/response-quality/apply`, payload, token);
}

export type TableCheckCellStatus = 'matched' | 'differs' | 'cant_tell' | 'rounding';

export type TableCheckReport = {
  filename?: string;
  n_tables: number;
  ok: boolean;
  summary: {
    matched: number;
    differs: number;
    cant_tell: number;
    rounding: number;
  };
  cause_labels: Record<string, string>;
  tables: Array<{
    title: string;
    sheet_name?: string;
    stub_column?: string | null;
    banner_column?: string | null;
    stub_label?: string | null;
    banner_label?: string | null;
    weight?: string | null;
    base_text?: string;
    weight_text?: string;
    statistic?: string;
    ok: boolean;
    reason?: string;
    summary: {
      matched: number;
      differs: number;
      cant_tell: number;
      rounding: number;
    };
    cells: Array<{
      stub_label: string;
      banner_label: string;
      uploaded: {
        raw?: string;
        percent?: number | null;
        mean?: number | null;
        count?: number | null;
        letters?: string | null;
      } | null;
      expected: {
        percent?: number | null;
        mean?: number | null;
        count?: number | null;
        unweighted_n?: number | null;
      } | null;
      status: TableCheckCellStatus;
      cause: string;
      cause_label: string;
    }>;
    corrected?: {
      title?: string;
      base_label?: string;
      banner_columns?: Array<{ id?: string; label?: string }>;
      rows?: Array<{
        label?: string;
        cells?: Array<Record<string, unknown>>;
      }>;
    } | null;
  }>;
};

export function checkDatasetTables(
  datasetId: string,
  payload: {
    filename?: string;
    content_base64?: string;
    tables?: Array<Record<string, unknown>>;
    weight_column?: string;
    stub_column?: string;
    banner_column?: string;
  },
  token?: string | null
) {
  return authedJson<TableCheckReport>(`/datasets/${datasetId}/table-check`, payload, token);
}

export type DataChecksReport = {
  respondents: number;
  n_columns: number;
  summary: {
    issues: number;
    construction_issues?: number;
    missing_labels?: number;
    unlabeled_codes?: number;
    unused_labels?: number;
    duplicate_labels?: number;
    out_of_range?: number;
    empty_columns?: number;
    straightline_questions?: number;
    summary_table_candidates?: number;
  };
  construction: Array<{
    kind: string;
    kind_label: string;
    column: string;
    columns?: string[];
    label: string;
    message: string;
    codes: string[];
    count: number;
  }>;
  straightlining: Array<{
    kind: string;
    kind_label: string;
    set_id?: string | null;
    label: string;
    columns: string[];
    column_labels: string[];
    straightline_count: number;
    respondent_pct: number;
    message: string;
  }>;
  summary_tables: Array<{
    column: string;
    label: string;
    n_categories: number;
  }>;
  issue_labels: Record<string, string>;
};

export type SummaryTablesResult = {
  ok: boolean;
  n_tables: number;
  truncated: boolean;
  limit: number;
  tables: Array<{
    stub: string;
    stub_column: string;
    stub_label: string;
    book: Record<string, unknown>;
  }>;
  candidates?: Array<{
    column: string;
    label: string;
    n_categories: number;
  }>;
  analysis_type?: string;
  provenance?: Record<string, unknown>;
};

export async function fetchDataChecksReport(datasetId: string, token?: string | null) {
  const res = await fetch(tensrApiUrl(`/datasets/${datasetId}/data-checks`), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<DataChecksReport>;
}

export function buildDatasetSummaryTables(
  datasetId: string,
  payload: { columns?: string[]; weight_column?: string; limit?: number } = {},
  token?: string | null
) {
  return authedJson<SummaryTablesResult>(
    `/datasets/${datasetId}/data-checks/summary-tables`,
    payload,
    token
  );
}

export type FindOutliersResult = {
  n_rows: number;
  total_flagged_rows: number;
  affected_row_indices: number[];
  columns: Array<{
    column: string;
    method?: string;
    lower_bound: number;
    upper_bound: number;
    outlier_count: number;
    pct_of_rows: number;
    sample_row_indices?: number[];
  }>;
};

export function findDatasetOutliers(
  datasetId: string,
  payload: { columns: string[]; method?: string },
  token?: string | null
) {
  return authedJson<FindOutliersResult>(`/datasets/${datasetId}/find-outliers`, payload, token);
}

export type CategoryMerge = {
  from: string[];
  to: string;
  reason?: string;
};

export type CategoryMergePreview = {
  column: string;
  summary: string;
  mappings: CategoryMerge[];
  suggestions?: CategoryMerge[];
  labels_for_model?: string[];
  model?: {
    used: boolean;
    sent: 'distinct_labels_only';
    label_count: number;
    notice: string;
    warning?: string;
  };
};

export function previewCategoryMerges(datasetId: string, column: string, token?: string | null) {
  return authedJson<CategoryMergePreview>(
    `/datasets/${datasetId}/clean-categories/preview`,
    { column },
    token
  );
}

export function suggestCategoryMerges(datasetId: string, column: string, token?: string | null) {
  return authedJson<CategoryMergePreview>(
    `/datasets/${datasetId}/clean-categories/suggest`,
    { column },
    token
  );
}

export function applyCategoryMerges(
  datasetId: string,
  column: string,
  mappings: CategoryMerge[],
  token?: string | null
) {
  return authedJson<DerivedDatasetResult>(
    `/datasets/${datasetId}/clean-categories`,
    { column, mappings },
    token
  );
}

export function handleDatasetOutliers(
  datasetId: string,
  payload: {
    columns: string[];
    method?: 'cap' | 'remove' | 'flag';
  },
  token?: string | null
) {
  return authedJson<DerivedDatasetResult>(`/datasets/${datasetId}/handle-outliers`, payload, token);
}

export function fixDatasetDataTypes(
  datasetId: string,
  payload: { casts: Array<{ name: string; target_type: string }> },
  token?: string | null
) {
  return authedJson<DerivedDatasetResult>(`/datasets/${datasetId}/fix-data-types`, payload, token);
}

export function fuseWaveDatasets(
  payload: { dataset_ids: string[]; wave_column?: string },
  token?: string | null
) {
  return authedJson<DerivedDatasetResult>(
    `/datasets/intake/fuse-datasets`,
    {
      dataset_ids: payload.dataset_ids,
      key: payload.wave_column,
    },
    token
  );
}

export async function datasetRequest<T>(
  path: string,
  token?: string | null,
  init: { method?: string; body?: unknown } = {}
): Promise<T> {
  const method = init.method || 'GET';
  const res = await fetch(tensrApiUrl(path), {
    method,
    headers: {
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      formatApiErrorMessage(
        new ApiRequestError(res.status, text || `Request failed (${res.status})`)
      )
    );
  }
  return res.json() as Promise<T>;
}

export function fuseSurveyDatasets(
  payload: { dataset_ids: string[]; key_columns?: string[] },
  token?: string | null
) {
  return authedJson<DerivedDatasetResult>(
    `/datasets/intake/fuse-datasets`,
    {
      dataset_ids: payload.dataset_ids,
      key: payload.key_columns?.[0],
    },
    token
  );
}

export type SentimentShare = {
  id: string;
  label: string;
  n: number;
  percent: number;
};

export type SentimentApplyResult = DerivedDatasetResult & {
  job_id?: string;
  processed?: number;
  total?: number;
  done?: boolean;
  status?: string;
  review_count?: number;
  not_answered?: number;
  labels?: string[];
  shares?: SentimentShare[];
  sentiment_column?: string;
  derived_dataset_id?: string;
};

/** Model-based Positive / Neutral / Negative scores for one open-end column. */
export function applyOpenEndSentiment(
  datasetId: string,
  payload: {
    text_column: string;
    use_model?: boolean;
    confirm_verbatims_sent?: boolean;
    overrides?: Record<string, string>;
    job_id?: string | null;
  },
  token?: string | null
) {
  return authedJson<SentimentApplyResult>(
    `/datasets/${datasetId}/open-end/sentiment`,
    {
      text_column: payload.text_column,
      ...(payload.use_model ? { use_model: true } : {}),
      ...(payload.confirm_verbatims_sent ? { confirm_verbatims_sent: true } : {}),
      ...(payload.overrides ? { overrides: payload.overrides } : {}),
      ...(payload.job_id ? { job_id: payload.job_id } : {}),
    },
    token
  );
}
