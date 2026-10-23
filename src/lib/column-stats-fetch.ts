import { tensrApiUrl } from '@/lib/tensr-api-url';

const cached = new Map<string, Record<string, unknown>>();
const inflight = new Map<string, Promise<Record<string, unknown>>>();

export function resetColumnStatsCacheForTests(): void {
  cached.clear();
  inflight.clear();
}

export function columnStatsCacheKey(datasetId: string, version?: string | null): string {
  return version ? `${datasetId}@${version}` : datasetId;
}

/** One analyze-file result per dataset version. A new version fetches again. */
export function fetchColumnStats(
  datasetId: string,
  version: string | null | undefined,
  token: string
): Promise<Record<string, unknown>> {
  const key = columnStatsCacheKey(datasetId, version);
  const versioned = cached.get(key);
  const unversioned = version ? cached.get(datasetId) : undefined;
  const hit = versioned ?? unversioned;
  if (hit) {
    if (version && unversioned && !versioned) {
      cached.set(key, unversioned);
      cached.delete(datasetId);
    }
    return Promise.resolve(hit);
  }
  const pending = inflight.get(key) ?? (version ? inflight.get(datasetId) : undefined);
  if (pending) return pending;
  const request = fetch(tensrApiUrl('/api/analysis/analyze-file'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ path: datasetId }),
  })
    .then(async response => {
      if (!response.ok) {
        throw new Error(`Error analyzing file: ${response.statusText}`);
      }
      const stats = (await response.json()) as Record<string, unknown>;
      if (!stats || typeof stats !== 'object') {
        throw new Error('Invalid statistics data received');
      }
      cached.set(key, stats);
      return stats;
    })
    .finally(() => {
      if (inflight.get(key) === request) inflight.delete(key);
    });
  inflight.set(key, request);
  return request;
}
