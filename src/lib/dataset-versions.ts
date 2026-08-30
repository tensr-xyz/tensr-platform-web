import { tensrApiUrl } from '@/lib/tensr-api-url';
import { formatApiErrorMessage } from '@/lib/api-error';

export type DatasetVersionRow = {
  dataset_id: string;
  original_filename: string;
  producing_operation: string;
  parent_dataset_id?: string | null;
  origin_dataset_id: string;
  updated_at: string;
  is_latest: boolean;
  n_rows?: number;
  n_cols?: number;
};

export type FileVersion = {
  versionId: string;
  lastModified: string;
  size: number;
  isLatest: boolean;
  label?: string;
  fileName?: string;
};

export function mapDatasetVersionToFileVersion(row: DatasetVersionRow): FileVersion {
  return {
    versionId: row.dataset_id,
    lastModified: row.updated_at,
    size: 0,
    isLatest: row.is_latest,
    label: row.producing_operation,
    fileName: row.original_filename,
  };
}

export function datasetVersionsPath(datasetId: string): string {
  return `/datasets/${datasetId}/versions`;
}

export function datasetRestorePath(datasetId: string, versionId: string): string {
  return `/datasets/${datasetId}/versions/${versionId}/restore`;
}

export function datasetExportPath(datasetId: string): string {
  return `/datasets/${datasetId}/export`;
}

async function authedFetch(path: string, token: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(tensrApiUrl(path), {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(formatApiErrorMessage(new Error(text || `Request failed (${res.status})`)));
  }
  return res;
}

export async function fetchDatasetVersions(
  datasetId: string,
  token: string
): Promise<DatasetVersionRow[]> {
  const res = await authedFetch(datasetVersionsPath(datasetId), token);
  const data = (await res.json()) as { versions?: DatasetVersionRow[] };
  return Array.isArray(data.versions) ? data.versions : [];
}

export async function restoreDatasetVersion(
  datasetId: string,
  versionId: string,
  token: string
): Promise<DatasetVersionRow> {
  const res = await authedFetch(datasetRestorePath(datasetId, versionId), token, {
    method: 'POST',
  });
  return (await res.json()) as DatasetVersionRow;
}

export async function downloadDatasetVersion(
  versionId: string,
  token: string,
  fileName?: string
): Promise<{ downloadUrl: string; fileName: string; expiresAt: string }> {
  const res = await authedFetch(datasetExportPath(versionId), token);
  const blob = await res.blob();
  const downloadUrl = URL.createObjectURL(blob);
  return {
    downloadUrl,
    fileName: fileName || 'dataset.csv',
    expiresAt: '',
  };
}
