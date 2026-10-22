import { fetchWithColdStartRetry } from '@/lib/cold-start-fetch';
import { noteServerTiming } from '@/lib/dataset-open';
import { tensrApiUrl } from '@/lib/tensr-api-url';

const TTL_MS = 15_000;

type CachedSchema = {
  status: number;
  body: string;
  headers: [string, string][];
};

const recent = new Map<string, { at: number; cached: CachedSchema }>();
const inflight = new Map<string, Promise<CachedSchema>>();

function asResponse(cached: CachedSchema): Response {
  return new Response(cached.body, {
    status: cached.status,
    headers: cached.headers,
  });
}

/** One in-flight GET /datasets/{id}/schema, reused by the page-load callers. */
export function fetchDatasetSchema(datasetId: string, init?: RequestInit): Promise<Response> {
  const hit = recent.get(datasetId);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return Promise.resolve(asResponse(hit.cached));
  }
  const pending = inflight.get(datasetId);
  if (pending) return pending.then(asResponse);
  const request = fetchWithColdStartRetry(tensrApiUrl(`/datasets/${datasetId}/schema`), init)
    .then(async response => {
      const readHeader = response.headers?.get;
      noteServerTiming(
        'schema',
        typeof readHeader === 'function' ? readHeader.call(response.headers, 'Server-Timing') : null
      );
      const cached: CachedSchema = {
        status: response.status,
        body: await response.text(),
        headers: [...response.headers.entries()],
      };
      if (response.status < 500) {
        recent.set(datasetId, { at: Date.now(), cached });
      }
      return cached;
    })
    .finally(() => {
      inflight.delete(datasetId);
    });
  inflight.set(datasetId, request);
  return request.then(asResponse);
}

export function datasetIdFromSchemaPath(endpoint: string): string | null {
  const match = endpoint.split('?')[0]?.match(/^\/datasets\/([^/]+)\/schema$/);
  return match?.[1] ?? null;
}
