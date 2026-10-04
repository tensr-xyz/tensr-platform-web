import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import BillingSettings from './billing';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));
jest.mock('@/hooks/api/use-auth', () => ({
  useAuth: () => ({ isAuthenticated: true, user: { userId: 'user-1' } }),
}));
jest.mock('@/utils/auth', () => ({ getIdToken: () => 'id-token' }));
jest.mock('@/components/molecules/referral-panel', () => ({ ReferralPanelBody: () => null }));
jest.mock('posthog-js', () => ({ capture: jest.fn() }));

const PERIOD_END = '2026-11-01T00:00:00+00:00';
const periodEndShown = new Date(PERIOD_END).toLocaleDateString();

function stripeSub(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'user-1',
    stripeCustomerId: 'cus_1',
    stripeSubscriptionId: 'sub_1',
    tier: 'pro',
    status: 'ACTIVE',
    billingType: 'monthly',
    startDate: '2026-10-01T00:00:00+00:00',
    renewalDate: PERIOD_END,
    cancelAtPeriodEnd: false,
    cancelAt: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

type Reply = { status?: number; body: unknown };

function mockApi(initial: Record<string, unknown>, posts: Record<string, Reply>) {
  const calls: string[] = [];
  global.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(url), 'http://localhost').pathname;
    const method = init?.method ?? 'GET';
    calls.push(`${method} ${path}`);
    let reply: Reply = { body: {} };
    if (method === 'POST' && posts[path]) reply = posts[path];
    else if (path.endsWith('/api/billing/subscription'))
      reply = { body: { subscription: initial } };
    else if (path.endsWith('/api/billing/invoices')) reply = { body: { invoices: [] } };
    else if (path.endsWith('/api/billing/payment-methods'))
      reply = { body: { paymentMethods: [] } };
    else if (path.endsWith('/api/billing/plans')) reply = { body: [] };
    const status = reply.status ?? 200;
    const text = JSON.stringify(reply.body);
    return {
      ok: status < 400,
      status,
      statusText: '',
      json: async () => reply.body,
      text: async () => text,
    } as Response;
  }) as jest.Mock;
  return calls;
}

describe('BillingSettings cancel at period end', () => {
  it('cancelling a Stripe plan shows "Cancels on <date>" and keeps it active', async () => {
    const calls = mockApi(stripeSub(), {
      '/api/billing/cancel-subscription': {
        body: { subscription: stripeSub({ cancelAtPeriodEnd: true, cancelAt: PERIOD_END }) },
      },
    });
    render(<BillingSettings />);

    expect(
      await screen.findByText(`Your subscription will renew on ${periodEndShown}`)
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel Subscription' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/You can undo this until then/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Yes, Cancel Subscription' }));

    expect(
      await screen.findByText(`Cancels on ${periodEndShown}. You keep access until then.`)
    ).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel Subscription' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keep subscription' })).toBeInTheDocument();
    expect(calls).toContain('POST /api/billing/cancel-subscription');
  });

  it('"Keep subscription" undoes a scheduled cancel', async () => {
    const calls = mockApi(stripeSub({ cancelAtPeriodEnd: true, cancelAt: PERIOD_END }), {
      '/api/billing/resume-subscription': { body: { subscription: stripeSub() } },
    });
    render(<BillingSettings />);

    fireEvent.click(await screen.findByRole('button', { name: 'Keep subscription' }));

    expect(
      await screen.findByText(`Your subscription will renew on ${periodEndShown}`)
    ).toBeInTheDocument();
    expect(screen.queryByText(/Cancels on/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel Subscription' })).toBeInTheDocument();
    expect(calls).toContain('POST /api/billing/resume-subscription');
  });

  it('shows the API message in the dialog when cancel fails, and keeps the page', async () => {
    mockApi(stripeSub(), {
      '/api/billing/cancel-subscription': {
        status: 502,
        body: { detail: 'Stripe cancel failed: card network down. Nothing was changed.' },
      },
    });
    render(<BillingSettings />);

    fireEvent.click(await screen.findByRole('button', { name: 'Cancel Subscription' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Yes, Cancel Subscription' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Stripe cancel failed: card network down. Nothing was changed.'
    );
    expect(screen.queryByText('Error Loading Subscription Details')).not.toBeInTheDocument();
  });

  it('shows the API message when undo fails', async () => {
    mockApi(stripeSub({ cancelAtPeriodEnd: true, cancelAt: PERIOD_END }), {
      '/api/billing/resume-subscription': {
        status: 409,
        body: {
          detail: 'This subscription has already ended. Start a new checkout to subscribe again.',
        },
      },
    });
    render(<BillingSettings />);

    fireEvent.click(await screen.findByRole('button', { name: 'Keep subscription' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('This subscription has already ended.')
    );
  });

  it('a plan without Stripe billing says it ends now', async () => {
    mockApi(stripeSub({ stripeCustomerId: '', stripeSubscriptionId: 'manual-comp-cofounder' }), {});
    render(<BillingSettings />);

    fireEvent.click(await screen.findByRole('button', { name: 'Cancel Subscription' }));
    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).getByText(/Your plan ends now/)).toBeInTheDocument();
    expect(within(dialog).queryByText(/You can undo this/)).not.toBeInTheDocument();
  });
});
