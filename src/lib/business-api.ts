import { getStytchBearerForTensrApi } from '@/utils/auth';
import { tensrApiUrl } from '@/lib/tensr-api-url';
import { handleUnauthorizedResponse } from '@/lib/session-expired';
import { User } from '@/types/user';
import { Entitlements } from '@/types/entitlements';

export type MeProfile = {
  user: User;
  entitlements: Entitlements;
  subscription: Record<string, unknown> | null;
};

export class NeedsEmailError extends Error {
  firstName: string | null;
  lastName: string | null;
  stytchUserId: string | null;

  constructor(detail: {
    first_name?: string | null;
    last_name?: string | null;
    stytch_user_id?: string | null;
  }) {
    super('Add an email to finish signing in');
    this.name = 'NeedsEmailError';
    this.firstName = detail.first_name ?? null;
    this.lastName = detail.last_name ?? null;
    this.stytchUserId = detail.stytch_user_id ?? null;
  }
}

export function needsEmailFromResponse(status: number, text: string): NeedsEmailError | null {
  if (status !== 409) return null;
  try {
    const body = JSON.parse(text) as {
      detail?: {
        code?: string;
        first_name?: string | null;
        last_name?: string | null;
        stytch_user_id?: string | null;
      };
    };
    if (body.detail?.code === 'needs_email') return new NeedsEmailError(body.detail);
  } catch {
    return null;
  }
  return null;
}

function authHeaders(extra?: HeadersInit): HeadersInit {
  const token = getStytchBearerForTensrApi();
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
  // cache: 'no-store' — never reuse a cached /me after session refresh/expiry.
  const r = await fetch(tensrApiUrl('/api/me'), {
    headers: authHeaders(),
    cache: 'no-store',
  });
  if (handleUnauthorizedResponse(r)) throw new Error('Session expired');
  if (!r.ok) {
    const text = await r.text();
    const needsEmail = needsEmailFromResponse(r.status, text);
    if (needsEmail) throw needsEmail;
    throw new Error(formatApiError(text));
  }
  return (await r.json()) as MeProfile;
}

export async function sendSessionEmailCode(
  email: string
): Promise<{ method_id: string; attached_to_session: boolean }> {
  const r = await fetch(tensrApiUrl('/api/auth/email-code'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ email }),
  });
  if (handleUnauthorizedResponse(r)) throw new Error('Session expired');
  if (!r.ok) throw new Error(formatApiError(await r.text()));
  const body = (await r.json()) as { method_id?: string; attached_to_session?: boolean };
  if (!body.method_id) throw new Error('Could not send a code to that email');
  return { method_id: body.method_id, attached_to_session: Boolean(body.attached_to_session) };
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
      ...(updates.agentVersion ? { agentVersion: updates.agentVersion } : {}),
    }),
  });
  if (handleUnauthorizedResponse(r)) throw new Error('Session expired');
  if (!r.ok) throw new Error(formatApiError(await r.text()));
  const body = (await r.json()) as { user: User };
  return body.user;
}
