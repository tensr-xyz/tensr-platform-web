import { tensrApiUrl } from '@/lib/tensr-api-url';
import { readableApiError } from '@/lib/flow-api';
import type { PublicViewerControl, SavedViewerView } from '@/lib/share-viewer-controls';

export type PublicSharePayload = {
  share: {
    id: string;
    token: string;
    kind: 'project_link' | 'output';
    role?: string;
    run_id?: string | null;
    title?: string | null;
    viewer_controls?: unknown[];
    explore_mode?: boolean;
    explore_hidden_columns?: string[];
    saved_views?: unknown[];
  };
  project: { id?: string; name?: string };
  run?: Record<string, unknown>;
  viewer?: {
    explore_mode?: boolean;
    controls?: PublicViewerControl[];
    saved_views?: SavedViewerView[];
  };
};

/** Read a share without a session. Used by /s/[token]. */
export async function fetchPublicShare(token: string): Promise<PublicSharePayload> {
  const response = await fetch(tensrApiUrl(`/api/public/shares/${encodeURIComponent(token)}`), {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    const text = await response.text();
    const error = new Error(readableApiError(text, response.statusText));
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  return response.json() as Promise<PublicSharePayload>;
}

/** Re-filter a shared output under viewer control values. */
export async function fetchPublicShareView(
  token: string,
  values: Record<string, unknown>
): Promise<PublicSharePayload> {
  const response = await fetch(
    tensrApiUrl(`/api/public/shares/${encodeURIComponent(token)}/view`),
    {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ values }),
    }
  );
  if (!response.ok) {
    const text = await response.text();
    const error = new Error(readableApiError(text, response.statusText));
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  return response.json() as Promise<PublicSharePayload>;
}

/** Save a named set of control values on a shared output. */
export async function savePublicShareView(
  token: string,
  name: string,
  values: Record<string, unknown>
): Promise<PublicSharePayload> {
  const response = await fetch(
    tensrApiUrl(`/api/public/shares/${encodeURIComponent(token)}/views`),
    {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, values }),
    }
  );
  if (!response.ok) {
    const text = await response.text();
    const error = new Error(readableApiError(text, response.statusText));
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  return response.json() as Promise<PublicSharePayload>;
}

export function publicSharePath(token: string): string {
  return `/s/${token}`;
}
