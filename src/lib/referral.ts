import { getStytchBearerForTensrApi } from '@/utils/auth';
import { tensrApiUrl } from '@/lib/tensr-api-url';
import { handleUnauthorizedResponse } from '@/lib/session-expired';

export const PENDING_REFERRAL_KEY = 'tensr_pending_referral';

const REFERRAL_CODE_PATTERN = /^[A-Za-z0-9-]{6,40}$/;

export type ReferralRowStatus =
  | 'signed_up'
  | 'trialling'
  | 'paid'
  | 'reward_granted'
  | 'reversed'
  | 'not_eligible';

export type ReferralRow = {
  id: string;
  referee: string;
  status: ReferralRowStatus;
  signed_up_at: string | null;
  paid_at: string | null;
  reward_status: string | null;
  reward_months: number;
  reward_granted_at: string | null;
};

export type ReferralPanelData = {
  enabled: boolean;
  code: string;
  link_path: string;
  reward: {
    referrer_months: number;
    referee_months: number;
    cap_months: number;
    cap_window_days: number;
    reversal_window_days: number;
    attribution_window_days: number;
    excluded_plans: string[];
  };
  referrals: ReferralRow[];
  months_earned: number;
  referred_by: {
    status: ReferralRowStatus;
    reward_status: string | null;
    reward_months: number;
    reward_granted_at: string | null;
  } | null;
};

type StoredReferral = { code: string; captured_at: string };
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function authHeaders(): HeadersInit {
  const token = getStytchBearerForTensrApi();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function browserStorage(): StorageLike | null {
  return typeof window === 'undefined' ? null : window.localStorage;
}

/** Most recent referral link wins; localStorage survives OAuth redirects and a later return visit. */
export function storeReferralCode(
  code: string,
  storage: StorageLike | null = browserStorage()
): void {
  const trimmed = code.trim();
  if (!storage || !REFERRAL_CODE_PATTERN.test(trimmed)) return;
  const entry: StoredReferral = {
    code: trimmed.toUpperCase(),
    captured_at: new Date().toISOString(),
  };
  storage.setItem(PENDING_REFERRAL_KEY, JSON.stringify(entry));
}

export function readStoredReferral(
  storage: StorageLike | null = browserStorage()
): StoredReferral | null {
  const raw = storage?.getItem(PENDING_REFERRAL_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredReferral>;
    if (typeof parsed.code !== 'string' || !REFERRAL_CODE_PATTERN.test(parsed.code)) return null;
    return { code: parsed.code, captured_at: String(parsed.captured_at || '') };
  } catch {
    return null;
  }
}

/**
 * Attribute the signed-in account to the stored referral link. The server decides eligibility;
 * any definitive answer clears the stored code, network/5xx failures keep it for the next sign-in.
 */
export async function redeemStoredReferral(
  storage: StorageLike | null = browserStorage()
): Promise<{ attributed: boolean; reason?: string } | null> {
  const stored = readStoredReferral(storage);
  if (!stored) return null;
  try {
    const r = await fetch(tensrApiUrl('/api/billing/referral/attribute'), {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ code: stored.code, captured_at: stored.captured_at || null }),
    });
    if (r.status === 401 || r.status >= 500) return null;
    storage?.removeItem(PENDING_REFERRAL_KEY);
    if (r.ok) return { attributed: true };
    const body = (await r.json().catch(() => ({}))) as { detail?: string };
    return { attributed: false, reason: body.detail };
  } catch (error) {
    console.warn('Referral attribution failed; will retry on next sign-in', error);
    return null;
  }
}

export async function fetchReferralPanel(): Promise<ReferralPanelData> {
  const r = await fetch(tensrApiUrl('/api/billing/referral'), {
    headers: authHeaders(),
    cache: 'no-store',
  });
  if (handleUnauthorizedResponse(r)) throw new Error('Session expired');
  if (!r.ok) throw new Error('Referral details are unavailable right now.');
  return r.json() as Promise<ReferralPanelData>;
}

export function referralLink(data: Pick<ReferralPanelData, 'link_path'>, origin: string): string {
  return `${origin.replace(/\/$/, '')}${data.link_path}`;
}

export function monthsLabel(months: number): string {
  return `${months} month${months === 1 ? '' : 's'}`;
}

export const REFERRAL_STATUS_LABEL: Record<ReferralRowStatus, string> = {
  signed_up: 'Signed up',
  trialling: 'Trialling',
  paid: 'Paid',
  reward_granted: 'Reward granted',
  reversed: 'Reversed (refunded)',
  not_eligible: 'Not eligible',
};
