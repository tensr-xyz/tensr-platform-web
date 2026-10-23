import type { ColumnMetadata } from '@/lib/analysis-report-types';
import { tensrApiUrl } from '@/lib/tensr-api-url';

export type ColumnMetadataMap = Record<string, ColumnMetadata>;

const METADATA_TTL_MS = 30_000;
const recentMetadata = new Map<string, { at: number; value: ColumnMetadataMap }>();
const inflightMetadata = new Map<string, Promise<ColumnMetadataMap>>();

export function resetDatasetMetadataCacheForTests(): void {
  recentMetadata.clear();
  inflightMetadata.clear();
}

export async function fetchDatasetColumnMetadata(
  datasetId: string,
  token?: string | null
): Promise<ColumnMetadataMap> {
  const hit = recentMetadata.get(datasetId);
  if (hit && Date.now() - hit.at < METADATA_TTL_MS) return hit.value;
  const pending = inflightMetadata.get(datasetId);
  if (pending) return pending;
  const started = Date.now();
  const request = fetch(tensrApiUrl(`/datasets/${datasetId}/metadata`), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
    .then(async res => {
      if (!res.ok) {
        throw new Error((await res.text()) || `Could not load metadata (${res.status})`);
      }
      const json = (await res.json()) as { column_metadata?: ColumnMetadataMap };
      const value = json.column_metadata ?? {};
      const current = recentMetadata.get(datasetId);
      if (!current || current.at < started) {
        recentMetadata.set(datasetId, { at: Date.now(), value });
        return value;
      }
      return current.value;
    })
    .finally(() => {
      if (inflightMetadata.get(datasetId) === request) inflightMetadata.delete(datasetId);
    });
  inflightMetadata.set(datasetId, request);
  return request;
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
  const value = json.column_metadata ?? {};
  recentMetadata.set(datasetId, { at: Date.now(), value });
  return value;
}
