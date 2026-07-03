import type { ColumnMetadata } from '@/lib/analysis-report-types';
import { tensrApiUrl } from '@/lib/tensr-api-url';

export type ColumnMetadataMap = Record<string, ColumnMetadata>;

export async function fetchDatasetColumnMetadata(
  datasetId: string,
  token?: string | null
): Promise<ColumnMetadataMap> {
  const res = await fetch(tensrApiUrl(`/datasets/${datasetId}/metadata`), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error((await res.text()) || `Could not load metadata (${res.status})`);
  }
  const json = (await res.json()) as { column_metadata?: ColumnMetadataMap };
  return json.column_metadata ?? {};
}

export async function patchColumnMetadata(
  datasetId: string,
  columnName: string,
  patch: Partial<ColumnMetadata>,
  token?: string | null
): Promise<ColumnMetadataMap> {
  const res = await fetch(tensrApiUrl(`/datasets/${datasetId}/metadata`), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      columns: {
        [columnName]: patch,
      },
    }),
  });
  if (!res.ok) {
    throw new Error((await res.text()) || `Could not save metadata (${res.status})`);
  }
  const json = (await res.json()) as { column_metadata?: ColumnMetadataMap };
  return json.column_metadata ?? {};
}
