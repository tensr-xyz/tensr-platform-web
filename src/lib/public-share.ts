import { tensrApiUrl } from '@/lib/tensr-api-url';
import { readableApiError } from '@/lib/flow-api';

export type PublicSharePayload = {
  share: {
    id: string;
    token: string;
    kind: 'project_link' | 'output';
    role?: string;
    run_id?: string | null;
    title?: string | null;
  };
  project: { id?: string; name?: string };
  run?: Record<string, unknown>;
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

export function publicSharePath(token: string): string {
  return `/s/${token}`;
}
