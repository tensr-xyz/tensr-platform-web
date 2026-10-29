import { getStytchBearerForTensrApi, getTensrApiHeaders } from '@/utils/auth';
import { tensrApiUrl } from '@/lib/tensr-api-url';

/** The studies pages mount before Stytch writes the session token. Wait, then fetch once. */
export async function bearerWhenReady(
  read: () => string | null = getStytchBearerForTensrApi,
  attempts = 20
): Promise<string | null> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const token = read();
    if (token) return token;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return null;
}

export async function fetchStudy(path: string, init?: RequestInit): Promise<Response> {
  const token = await bearerWhenReady();
  if (!token) {
    return new Response('Sign in to open studies.', { status: 401 });
  }
  const headers = {
    ...getTensrApiHeaders(),
    Authorization: `Bearer ${token}`,
    ...(init?.headers || {}),
  };
  const response = await fetch(tensrApiUrl(path), { ...init, headers });
  if (response.status !== 401) return response;
  const retry = await bearerWhenReady();
  if (!retry) return response;
  return fetch(tensrApiUrl(path), {
    ...init,
    headers: { ...headers, Authorization: `Bearer ${retry}` },
  });
}

export function studyRowText(project: {
  name: string;
  updated_at?: string | null;
  dataset_count?: number | null;
}): string {
  const when = project.updated_at ? new Date(project.updated_at) : null;
  const updated = when && !Number.isNaN(when.getTime()) ? when.toLocaleString() : '';
  const count =
    project.dataset_count == null
      ? ''
      : `${project.dataset_count} dataset${project.dataset_count === 1 ? '' : 's'}`;
  return [project.name, count, updated].filter(Boolean).join(' · ');
}
