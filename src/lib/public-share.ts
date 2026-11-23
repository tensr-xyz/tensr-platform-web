import { tensrApiUrl } from '@/lib/tensr-api-url';
import { readableApiError } from '@/lib/flow-api';
import type { PublicViewerControl, SavedViewerView } from '@/lib/share-viewer-controls';

export type PublicShareTextRun = {
  text?: string;
  href?: string | null;
};

export type PublicSharePageObject = {
  id?: string;
  kind?: string;
  text?: string;
  href?: string | null;
  runs?: PublicShareTextRun[];
  run_id?: string | null;
  frame?: { x?: number; y?: number; w?: number; h?: number };
};

export type PublicShareReportPage = {
  id?: string;
  title?: string;
  objects?: PublicSharePageObject[];
};

export type PublicSharePayload = {
  password_required?: boolean;
  sign_in_required?: boolean;
  viewer_mode?: 'signed_in' | 'anonymous';
  share: {
    id: string;
    token: string;
    kind: 'project_link' | 'output' | 'app';
    role?: string;
    access?: 'signed_in' | 'anonymous';
    run_id?: string | null;
    title?: string | null;
    password_required?: boolean;
    viewer_controls?: unknown[];
    explore_mode?: boolean;
    explore_hidden_columns?: string[];
    saved_views?: unknown[];
  };
  project: { id?: string; name?: string; updated_at?: string };
  workspace?: { name?: string };
  report?: {
    pages?: PublicShareReportPage[];
    shared_count?: number;
    total_count?: number;
    runs?: Record<string, Record<string, unknown>>;
    updated_at?: string;
  };
  run?: Record<string, unknown>;
  viewer?: {
    explore_mode?: boolean;
    controls?: PublicViewerControl[];
    saved_views?: SavedViewerView[];
  };
};

const PASSWORD_HEADER = 'X-Share-Password';

function passwordHeaders(password?: string): HeadersInit {
  const cleaned = (password || '').trim();
  return cleaned ? { [PASSWORD_HEADER]: cleaned } : {};
}

async function readShareResponse(response: Response): Promise<PublicSharePayload> {
  if (!response.ok) {
    const text = await response.text();
    const error = new Error(readableApiError(text, response.statusText));
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  return response.json() as Promise<PublicSharePayload>;
}

/** Read a share without a session. Used by /s/[token]. */
export async function fetchPublicShare(
  token: string,
  password?: string
): Promise<PublicSharePayload> {
  const response = await fetch(tensrApiUrl(`/api/public/shares/${encodeURIComponent(token)}`), {
    method: 'GET',
    headers: { Accept: 'application/json', ...passwordHeaders(password) },
  });
  return readShareResponse(response);
}

/** Unlock a password-protected published link. */
export async function unlockPublicShare(
  token: string,
  password: string
): Promise<PublicSharePayload> {
  const response = await fetch(
    tensrApiUrl(`/api/public/shares/${encodeURIComponent(token)}/unlock`),
    {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    }
  );
  return readShareResponse(response);
}

/** Re-filter a shared output under viewer control values. */
export async function fetchPublicShareView(
  token: string,
  values: Record<string, unknown>,
  password?: string
): Promise<PublicSharePayload> {
  const response = await fetch(
    tensrApiUrl(`/api/public/shares/${encodeURIComponent(token)}/view`),
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...passwordHeaders(password),
      },
      body: JSON.stringify({ values }),
    }
  );
  return readShareResponse(response);
}

/** Save a named set of control values on a shared output. */
export async function savePublicShareView(
  token: string,
  name: string,
  values: Record<string, unknown>,
  password?: string
): Promise<PublicSharePayload> {
  const response = await fetch(
    tensrApiUrl(`/api/public/shares/${encodeURIComponent(token)}/views`),
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...passwordHeaders(password),
      },
      body: JSON.stringify({ name, values }),
    }
  );
  return readShareResponse(response);
}

export function publicSharePath(token: string): string {
  return `/s/${token}`;
}

/** Absolute URL for a published share (browser only). */
export function publicShareUrl(token: string): string {
  if (typeof window === 'undefined') return publicSharePath(token);
  return `${window.location.origin}${publicSharePath(token)}`;
}

/** iframe snippet for embedding a published report in another page. */
export function publicShareEmbedSnippet(token: string, title?: string): string {
  const src = typeof window === 'undefined' ? publicSharePath(token) : publicShareUrl(token);
  const label = (title || 'Published report').replace(/"/g, '&quot;');
  return `<iframe src="${src}" title="${label}" width="100%" height="800" style="border:0;border-radius:8px;" loading="lazy" allowfullscreen></iframe>`;
}

const PASSWORD_STORAGE_PREFIX = 'tensr.share.password.';

export function rememberSharePassword(token: string, password: string): void {
  if (typeof window === 'undefined') return;
  const cleaned = password.trim();
  if (!cleaned) {
    window.sessionStorage.removeItem(`${PASSWORD_STORAGE_PREFIX}${token}`);
    return;
  }
  window.sessionStorage.setItem(`${PASSWORD_STORAGE_PREFIX}${token}`, cleaned);
}

export function recalledSharePassword(token: string): string {
  if (typeof window === 'undefined') return '';
  return window.sessionStorage.getItem(`${PASSWORD_STORAGE_PREFIX}${token}`) || '';
}

/** Short date for the public viewer subtitle, e.g. "21 Nov". */
export function formatShareUpdated(iso?: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
