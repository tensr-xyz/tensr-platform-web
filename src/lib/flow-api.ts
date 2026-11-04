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

/** A sentence from a FastAPI error body. Raw JSON is never shown in the product. */
export function readableApiError(text: string, statusText = ''): string {
  const raw = text.trim();
  if (!raw) return statusText || 'The request failed.';
  try {
    const body = JSON.parse(raw) as { detail?: unknown; message?: unknown };
    const detail = body.detail ?? body.message;
    if (typeof detail === 'string' && detail.trim()) return detail.trim();
    if (Array.isArray(detail)) {
      const parts = detail
        .map(item => {
          if (typeof item === 'string') return item;
          if (item && typeof item === 'object' && 'msg' in item)
            return String((item as { msg: unknown }).msg || '');
          return '';
        })
        .filter(Boolean);
      if (parts.length) return parts.join(' ');
    }
  } catch {
    // The body is plain text.
  }
  if (raw.startsWith('{') || raw.startsWith('[')) return statusText || 'The request failed.';
  return raw.length < 240 ? raw : statusText || 'The request failed.';
}

export async function flowJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await flowFetch(path, init);
  if (!response.ok) {
    const text = await response.text();
    const error = new Error(readableApiError(text, response.statusText));
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  return response.json() as Promise<T>;
}
