import { flowJson } from '@/lib/flow-api';
import { cacheKey, settingsCache } from './settings-cache';
import type { ApiPlan, Invoice, LegacySubscription, MePage } from './settings-data';

export type PlanCatalog = { currency: string; plans: ApiPlan[] };

/** The plan list is the same for everyone, so it is cached for the whole session. */
export function loadPlans(): Promise<PlanCatalog> {
  return settingsCache.get(
    'plans',
    async () => {
      const page = await flowJson<{ currency?: string; plans?: ApiPlan[] } | ApiPlan[]>(
        '/api/billing/plans'
      );
      if (Array.isArray(page)) return { currency: 'GBP', plans: page };
      return { currency: (page.currency || 'gbp').toUpperCase(), plans: page.plans || [] };
    },
    Number.POSITIVE_INFINITY
  );
}

export function loadSubscription(): Promise<LegacySubscription | null> {
  return settingsCache.get(cacheKey('subscription'), async () => {
    const page = await flowJson<{ subscription?: LegacySubscription | null }>(
      '/api/billing/subscription'
    );
    return page.subscription || null;
  });
}

export function loadMe(): Promise<MePage> {
  return settingsCache.get(cacheKey('me'), () => flowJson<MePage>('/api/me'));
}

export type UsagePage = {
  summary?: { analyses?: number; reports?: number };
  usage?: { reports?: number; aiRequests?: number };
  limits?: { assistant_requests?: number; reports?: number };
  currentUsage?: number;
};

export type DatasetRow = { n_rows?: number };

export type BillingData = {
  me: MePage;
  subscription: LegacySubscription | null;
  catalog: PlanCatalog;
  /** Present only after loadInvoices(); omitted on the first Billing paint. */
  invoices?: Invoice[] | null;
};

export type UsageData = {
  me: MePage;
  usage: UsagePage;
  datasets: DatasetRow[];
  subscription: LegacySubscription | null;
  catalog: PlanCatalog;
};

/** Plan card first: Stripe invoices wait until the Invoices section asks for them. */
export function loadBilling(): Promise<BillingData> {
  return settingsCache.get(cacheKey('billing'), async () => {
    const [me, subscription, catalog] = await Promise.all([
      loadMe(),
      loadSubscription(),
      loadPlans(),
    ]);
    return { me, subscription, catalog };
  });
}

/** Stripe's invoice list — only when Billing opens the invoices block. */
export function loadInvoices(): Promise<Invoice[] | null> {
  return settingsCache.get(cacheKey('invoices'), () =>
    flowJson<{ invoices?: Invoice[] }>('/api/billing/invoices')
      .then(page => page.invoices || [])
      .catch(() => null)
  );
}

/** Usage tab: datasets list stays here so opening Settings does not wait on it. */
export function loadUsage(): Promise<UsageData> {
  return settingsCache.get(cacheKey('usage'), async () => {
    const [me, usage, datasets, subscription, catalog] = await Promise.all([
      loadMe(),
      flowJson<UsagePage>('/api/billing/usage'),
      flowJson<DatasetRow[] | { datasets?: DatasetRow[] }>('/datasets/?scope=all').then(page =>
        Array.isArray(page) ? page : page.datasets || []
      ),
      loadSubscription().catch(() => null),
      loadPlans(),
    ]);
    return { me, usage, datasets, subscription, catalog };
  });
}

export const peekBilling = () => settingsCache.peek<BillingData>(cacheKey('billing'));
export const peekUsage = () => settingsCache.peek<UsageData>(cacheKey('usage'));

/** After a plan change or a retry: billing and usage both refetch. The plan list stays. */
export function invalidateBilling(): void {
  settingsCache.forget(key => key !== 'plans');
}

/** Called when Settings opens: warm the shared me/subscription/plans only. */
export function prefetchBillingAndUsage(): void {
  void loadMe().catch(() => undefined);
  void loadSubscription().catch(() => undefined);
  void loadPlans().catch(() => undefined);
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
