/** Build the share/join URL for a collaboration session (Phase 1). */
export function buildCollaborateUrl(params: {
  sessionId: string;
  datasetId?: string;
  datasetName?: string;
}): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const url = new URL('/workspace/collaborate', origin || 'http://localhost:3000');
  url.searchParams.set('session', params.sessionId);
  if (params.datasetId) {
    url.searchParams.set('datasetId', params.datasetId);
  }
  if (params.datasetName) {
    url.searchParams.set('name', params.datasetName);
  }
  return url.pathname + url.search;
}

/** Resolve workspace dataset id from join link params or session metadata. */
export function resolveCollaborationDatasetId(
  explicitDatasetId: string | null | undefined,
  session: { datasetId?: string; filePath?: string }
): string | null {
  const explicit = explicitDatasetId?.trim();
  if (explicit) {
    return explicit;
  }
  const fromSession = session.datasetId?.trim();
  if (fromSession) {
    return fromSession;
  }
  const filePath = session.filePath?.replace(/^\//, '').trim();
  return filePath || null;
}
