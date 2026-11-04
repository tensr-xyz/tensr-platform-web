const pending: { path: string; resolve: (value: unknown) => void }[] = [];
jest.mock('@/lib/flow-api', () => ({
  flowJson: jest.fn((path: string) => new Promise(resolve => pending.push({ path, resolve }))),
}));

import { flowJson } from '@/lib/flow-api';
import { loadBilling, loadInvoices, loadUsage, peekBilling, peekUsage } from './billing-load';
import { settingsCache } from './settings-cache';

const ANSWERS: Record<string, unknown> = {
  '/api/me': { entitlements: { plan_code: 'pro' } },
  '/api/billing/subscription': { subscription: { tier: 'pro' } },
  '/api/billing/plans': { currency: 'gbp', plans: [] },
  '/api/billing/invoices': { invoices: [] },
  '/api/billing/usage': { usage: { reports: 1 } },
  '/datasets/?scope=all': [{ n_rows: 10 }],
};

describe('billing and usage loading', () => {
  beforeEach(() => {
    pending.length = 0;
    settingsCache.forget(() => true);
    (flowJson as jest.Mock).mockClear();
  });

  it('loads billing without Stripe invoices; usage keeps its own batch', async () => {
    const billing = loadBilling();
    expect(pending.map(item => item.path).sort()).toEqual(
      ['/api/billing/plans', '/api/billing/subscription', '/api/me'].sort()
    );
    pending.splice(0).forEach(item => item.resolve(ANSWERS[item.path]));
    await billing;
    expect(peekBilling()?.catalog.currency).toBe('GBP');
    expect(peekBilling()?.invoices).toBeUndefined();

    const invoices = loadInvoices();
    expect(pending.map(item => item.path)).toEqual(['/api/billing/invoices']);
    pending.splice(0).forEach(item => item.resolve(ANSWERS[item.path]));
    await invoices;

    const usage = loadUsage();
    // me / subscription / plans are already cached from billing.
    expect(pending.map(item => item.path).sort()).toEqual(
      ['/api/billing/usage', '/datasets/?scope=all'].sort()
    );
    pending.splice(0).forEach(item => item.resolve(ANSWERS[item.path]));
    await usage;
    expect(peekUsage()?.datasets).toHaveLength(1);

    const calls = (flowJson as jest.Mock).mock.calls.length;
    await Promise.all([loadBilling(), loadUsage(), loadInvoices()]);
    expect((flowJson as jest.Mock).mock.calls.length).toBe(calls);
  });
});
