import { getStytchBearerForTensrApi, getTensrApiHeaders } from '@/utils/auth';
import { tensrApiUrl } from '@/lib/tensr-api-url';

export type FlowProject = {
  id: string;
  name: string;
  folder?: string | null;
  status?: string;
  created_by?: string;
  updated_at?: string;
  active_dataset_id?: string | null;
};

export async function flowFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = getStytchBearerForTensrApi();
  const headers = {
    ...getTensrApiHeaders(),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init?.body && !(init.body instanceof FormData)
      ? { 'Content-Type': 'application/json' }
      : {}),
    ...(init?.headers || {}),
  };
  return fetch(tensrApiUrl(path), { ...init, headers });
}

export async function flowJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await flowFetch(path, init);
  if (!response.ok) {
    const text = await response.text();
    const error = new Error(text || response.statusText);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  return response.json() as Promise<T>;
}
