import type { Entitlements } from '@/types/entitlements';

/** True when entitlements have been loaded from /api/me (including unpaid `plan_code: none`). */
export function entitlementsResolved(entitlements: Entitlements | null | undefined): boolean {
  return entitlements != null && typeof entitlements.plan_code === 'string';
}

export function hasActiveSubscription(entitlements: Entitlements | null | undefined): boolean {
  if (!entitlementsResolved(entitlements)) return false;
  const code = entitlements!.plan_code;
  return code !== 'none' && code.length > 0;
}

export function subscriptionRedirectPath(returnTo?: string): string {
  if (!returnTo || !returnTo.startsWith('/')) {
    return '/subscription';
  }
  return `/subscription?returnTo=${encodeURIComponent(returnTo)}`;
}
