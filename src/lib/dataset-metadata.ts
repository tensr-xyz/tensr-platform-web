import type { ColumnMetadata } from '@/lib/analysis-report-types';
import { tensrApiUrl } from '@/lib/tensr-api-url';

export type ColumnMetadataMap = Record<string, ColumnMetadata>;

const METADATA_TTL_MS = 30_000;

export type DatasetMetadataDocument = {
  column_metadata?: ColumnMetadataMap;
  columns?: unknown;
  loop_proposals?: unknown;
  loops?: unknown;
  active_weight_column?: string | null;
};

const recentMetadata = new Map<string, { at: number; value: DatasetMetadataDocument }>();
const inflightMetadata = new Map<string, Promise<DatasetMetadataDocument>>();

export function resetDatasetMetadataCacheForTests(): void {
  recentMetadata.clear();
  inflightMetadata.clear();
}

/** One GET /metadata per dataset. Column metadata, loops, and the active weight share it. */
export async function fetchDatasetMetadataDocument(
  datasetId: string,
  token?: string | null
): Promise<DatasetMetadataDocument> {
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
      const json = (await res.json()) as DatasetMetadataDocument;
      const current = recentMetadata.get(datasetId);
      if (!current || current.at < started) {
        recentMetadata.set(datasetId, { at: Date.now(), value: json });
        return json;
      }
      return current.value;
    })
    .finally(() => {
      if (inflightMetadata.get(datasetId) === request) inflightMetadata.delete(datasetId);
    });
  inflightMetadata.set(datasetId, request);
  return request;
}

export async function fetchDatasetColumnMetadata(
  datasetId: string,
  token?: string | null
): Promise<ColumnMetadataMap> {
  const document = await fetchDatasetMetadataDocument(datasetId, token);
  return document.column_metadata ?? {};
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
  const json = (await res.json()) as DatasetMetadataDocument;
  recentMetadata.set(datasetId, { at: Date.now(), value: json });
  return json.column_metadata ?? {};
}
