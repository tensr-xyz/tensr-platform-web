import { getSessionJwt, getSessionToken } from '@/utils/auth';
import { tensrApiUrl } from '@/lib/tensr-api-url';
import { handleUnauthorizedResponse } from '@/lib/session-expired';
import { User } from '@/types/user';
import { Entitlements } from '@/types/entitlements';

export type MeProfile = {
  user: User;
  entitlements: Entitlements;
  subscription: Record<string, unknown> | null;
};

function authHeaders(extra?: HeadersInit): HeadersInit {
  const token = getSessionJwt() || getSessionToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

function formatApiError(text: string): string {
  try {
    const j = JSON.parse(text) as { detail?: unknown; message?: string };
    if (typeof j.message === 'string') return j.message;
    if (typeof j.detail === 'string') return j.detail;
  } catch {
    /* keep raw */
  }
  return text;
}

export const PENDING_INVITE_TOKEN_KEY = 'tensr_pending_invite_token';

export type InvitationAcceptResult = {
  organization_id: string;
  invitation: { status: string; email?: string };
  already_member?: boolean;
};

export async function acceptInvitation(token: string): Promise<InvitationAcceptResult> {
  const r = await fetch(tensrApiUrl(`/api/invitations/${encodeURIComponent(token)}/accept`), {
    method: 'POST',
    headers: authHeaders(),
  });
  if (handleUnauthorizedResponse(r)) throw new Error('Session expired');
  if (!r.ok) throw new Error(formatApiError(await r.text()));
  return r.json() as Promise<InvitationAcceptResult>;
}

/** Accept invite link token stored during login (email match is also auto-redeemed on /api/me). */
export async function redeemStoredInvitation(): Promise<InvitationAcceptResult | null> {
  if (typeof window === 'undefined') return null;
  const token = sessionStorage.getItem(PENDING_INVITE_TOKEN_KEY);
  if (!token) return null;
  try {
    const result = await acceptInvitation(token);
    sessionStorage.removeItem(PENDING_INVITE_TOKEN_KEY);
    return result;
  } catch (error) {
    console.warn('Failed to accept stored invitation:', error);
    return null;
  }
}

export function storePendingInviteToken(token: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(PENDING_INVITE_TOKEN_KEY, token);
}

export async function fetchMeProfile(): Promise<MeProfile> {
  // Use tensrApiUrl so browser calls go through the same-origin /api/tensr proxy
  // (avoids CORS failures that leave entitlements null and trap users on /subscription).
  const r = await fetch(tensrApiUrl('/api/me'), { headers: authHeaders() });
  if (handleUnauthorizedResponse(r)) throw new Error('Session expired');
  if (!r.ok) throw new Error(formatApiError(await r.text()));
  return (await r.json()) as MeProfile;
}

export async function fetchCurrentUser(): Promise<User> {
  const profile = await fetchMeProfile();
  return profile.user;
}

export async function updateProfile(updates: Partial<User>): Promise<User> {
  const r = await fetch(tensrApiUrl('/api/me'), {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({
      firstName: updates.firstName,
      lastName: updates.lastName,
      username: updates.username,
      preferences: updates.preferences,
    }),
  });
  if (handleUnauthorizedResponse(r)) throw new Error('Session expired');
  if (!r.ok) throw new Error(formatApiError(await r.text()));
  const body = (await r.json()) as { user: User };
  return body.user;
}
