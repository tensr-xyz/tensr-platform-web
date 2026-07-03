import type { Entitlements } from '@/types/entitlements';

export function hasActiveSubscription(entitlements: Entitlements | null | undefined): boolean {
  const code = entitlements?.plan_code;
  return !!code && code !== 'none';
}

export function subscriptionRedirectPath(returnTo?: string): string {
  if (!returnTo || !returnTo.startsWith('/')) {
    return '/subscription';
  }
  return `/subscription?returnTo=${encodeURIComponent(returnTo)}`;
}
