import { tensrApiUrl } from '@/lib/tensr-api-url';
import { formatApiErrorMessage } from '@/lib/api-error';
import type { TableRequestBody } from './spec';
import type { LineageVersion } from './weight';

async function authedJson<T>(path: string, init: RequestInit, token?: string | null): Promise<T> {
  const res = await fetch(tensrApiUrl(path), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(formatApiErrorMessage(new Error(text || `Request failed (${res.status})`)));
  }
  return res.json() as Promise<T>;
}

export function listDatasetVersions(datasetId: string, token?: string | null) {
  return authedJson<{ origin_dataset_id: string; versions: LineageVersion[] }>(
    `/datasets/${datasetId}/versions`,
    { method: 'GET' },
    token
  );
}

export function runCustomTable(datasetId: string, body: TableRequestBody, token?: string | null) {
  return authedJson<Record<string, unknown>>(
    `/datasets/${datasetId}/tables`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
    token
  );
}

export function previewCustomTable(
  datasetId: string,
  body: TableRequestBody,
  token?: string | null
) {
  return authedJson<{ n_banner_columns?: number; warnings?: Array<{ message?: string }> }>(
    `/datasets/${datasetId}/tables/preview`,
    { method: 'POST', body: JSON.stringify(body) },
    token
  );
}
