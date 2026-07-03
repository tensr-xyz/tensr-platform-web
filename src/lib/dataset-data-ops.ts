import { tensrApiUrl } from '@/lib/tensr-api-url';

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
    throw new Error(text || `Request failed (${res.status})`);
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

export type DerivedDatasetResult = {
  dataset_id: string;
  original_filename: string;
  n_rows: number;
  n_cols: number;
  replaced_values_count?: number;
  preview?: {
    headers: string[];
    variable_names: string[];
    rows: unknown[][];
    columns: { name: string; type: string }[];
  };
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
  },
  token?: string | null
) {
  return authedJson<DerivedDatasetResult>(`/datasets/${datasetId}/impute-missing`, payload, token);
}

export function mergeDatasets(
  datasetId: string,
  payload: { secondary_dataset_id: string; merge_type: 'add_cases' | 'add_variables' },
  token?: string | null
) {
  return authedJson<DerivedDatasetResult>(`/datasets/${datasetId}/merge`, payload, token);
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

export function recodeDatasetColumn(
  datasetId: string,
  payload: {
    source_column: string;
    mappings: { from_value: string; to_value: string }[];
    replace_existing: boolean;
    target_column?: string;
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
  }>;
};

export async function fetchDataQualityReport(datasetId: string, token?: string | null) {
  const res = await fetch(tensrApiUrl(`/datasets/${datasetId}/data-quality`), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<DataQualityReport>;
}
