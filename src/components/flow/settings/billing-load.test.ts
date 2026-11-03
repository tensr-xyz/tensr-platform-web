const pending: { path: string; resolve: (value: unknown) => void }[] = [];
jest.mock('@/lib/flow-api', () => ({
  flowJson: jest.fn((path: string) => new Promise(resolve => pending.push({ path, resolve }))),
}));

import { flowJson } from '@/lib/flow-api';
import { loadBilling, loadUsage, peekBilling, peekUsage } from './billing-load';

const ANSWERS: Record<string, unknown> = {
  '/api/me': { entitlements: { plan_code: 'pro' } },
  '/api/billing/subscription': { subscription: { tier: 'pro' } },
  '/api/billing/plans': { currency: 'gbp', plans: [] },
  '/api/billing/invoices': { invoices: [] },
  '/api/billing/usage': { usage: { reports: 1 } },
  '/datasets/?scope=all': [{ n_rows: 10 }],
};

describe('billing and usage loading', () => {
  it('sends every request at once and shares the common ones between both tabs', async () => {
    const billing = loadBilling();
    const usage = loadUsage();
    const paths = pending.map(item => item.path).sort();
    // Nothing waits on anything else: all six distinct requests are in flight before any answers.
    expect(paths).toEqual(Object.keys(ANSWERS).sort());
    pending.splice(0).forEach(item => item.resolve(ANSWERS[item.path]));
    await Promise.all([billing, usage]);
    expect(peekBilling()?.catalog.currency).toBe('GBP');
    expect(peekUsage()?.datasets).toHaveLength(1);

    // Coming back to either tab reuses the answer without new requests.
    const calls = (flowJson as jest.Mock).mock.calls.length;
    await Promise.all([loadBilling(), loadUsage()]);
    expect((flowJson as jest.Mock).mock.calls.length).toBe(calls);
  });
});
