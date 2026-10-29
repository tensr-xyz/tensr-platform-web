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

const studyJsonInflight = new Map<string, Promise<unknown>>();

/** One in-flight GET per path. A second mount shares the response instead of calling again. */
export function fetchStudyJson<T>(path: string): Promise<T> {
  const existing = studyJsonInflight.get(path) as Promise<T> | undefined;
  if (existing) return existing;
  const pending = fetchStudy(path)
    .then(async response => {
      if (!response.ok) throw new Error(await response.text());
      return (await response.json()) as T;
    })
    .finally(() => {
      if (studyJsonInflight.get(path) === pending) studyJsonInflight.delete(path);
    });
  studyJsonInflight.set(path, pending);
  return pending;
}

export function studiesWithDatasets<T extends { dataset_count?: number | null }>(
  projects: T[]
): T[] {
  return projects.filter(project => (project.dataset_count ?? 0) > 0);
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
