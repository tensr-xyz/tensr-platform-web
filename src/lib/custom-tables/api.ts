import { tensrApiUrl } from '@/lib/tensr-api-url';
import { formatApiErrorMessage } from '@/lib/api-error';
import type { TableRequestBody, SavedTableSpecRow } from './spec';
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

export function listSavedTables(datasetId: string, token?: string | null) {
  return authedJson<{ ok?: boolean; specs: SavedTableSpecRow[] }>(
    `/datasets/${datasetId}/tables`,
    { method: 'GET' },
    token
  );
}

export function getSavedTable(datasetId: string, specId: string, token?: string | null) {
  return authedJson<Record<string, unknown>>(
    `/datasets/${datasetId}/tables/${specId}`,
    { method: 'GET' },
    token
  );
}

export function downloadTableExport(
  datasetId: string,
  specId: string,
  kind: 'xlsx' | 'pptx',
  token?: string | null
) {
  return fetch(tensrApiUrl(`/datasets/${datasetId}/tables/${specId}/export.${kind}`), {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  }).then(async res => {
    if (!res.ok) {
      const text = await res.text();
      throw new Error(formatApiErrorMessage(new Error(text || `Request failed (${res.status})`)));
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = kind === 'xlsx' ? 'banner.xlsx' : 'banner.pptx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  });
}

export function parseWincrossJob(
  job: string,
  token?: string | null,
  convention?: Record<string, unknown>
) {
  return authedJson<import('./wincross-report').WincrossParseResult>(
    '/datasets/wincross/parse',
    {
      method: 'POST',
      body: JSON.stringify({ job, ...(convention ? { convention } : {}) }),
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
