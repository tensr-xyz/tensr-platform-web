import { flowJson } from '@/lib/flow-api';
import type { ApiPlan, LegacySubscription, MePage } from './settings-data';

export type PlanCatalog = { currency: string; plans: ApiPlan[] };

export async function loadPlans(): Promise<PlanCatalog> {
  const page = await flowJson<{ currency?: string; plans?: ApiPlan[] } | ApiPlan[]>(
    '/api/billing/plans'
  );
  if (Array.isArray(page)) return { currency: 'GBP', plans: page };
  return { currency: (page.currency || 'gbp').toUpperCase(), plans: page.plans || [] };
}

export async function loadSubscription(): Promise<LegacySubscription | null> {
  const page = await flowJson<{ subscription?: LegacySubscription | null }>(
    '/api/billing/subscription'
  );
  return page.subscription || null;
}

export function loadMe(): Promise<MePage> {
  return flowJson<MePage>('/api/me');
}

/** Stripe's customer portal. Returns false when there is no Stripe customer yet. */
export async function openBillingPortal(returnPath: string): Promise<boolean> {
  const page = await flowJson<{ url?: string; mode?: string }>('/api/billing/portal', {
    method: 'POST',
    body: JSON.stringify({ returnUrl: `${window.location.origin}${returnPath}` }),
  });
  if (page.mode === 'local_dev' || !page.url) return false;
  window.location.assign(page.url);
  return true;
}
