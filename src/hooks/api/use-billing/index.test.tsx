import { act, renderHook } from '@testing-library/react';
import { useBilling } from './index';

const mockRouterPush = jest.fn();
let portalResponse: Record<string, unknown> = {};

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush, replace: jest.fn() }),
}));
jest.mock('@/hooks/api/use-auth', () => ({
  useAuth: () => ({ isAuthenticated: false, user: null }),
}));
jest.mock('@/utils/auth', () => ({ getIdToken: () => 'id-token' }));

describe('useBilling openCustomerPortal', () => {
  const open = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    window.open = open;
    global.fetch = jest.fn(async (url: RequestInfo | URL) => {
      const body = String(url).endsWith('/api/billing/portal') ? portalResponse : [];
      return { ok: true, status: 200, json: async () => body } as Response;
    }) as jest.Mock;
  });

  it('sends users with no Stripe customer to the plan page instead of reopening billing', async () => {
    portalResponse = { url: 'http://localhost/settings/billing', mode: 'local_dev' };
    const { result } = renderHook(() => useBilling());

    await act(async () => {
      await result.current.openCustomerPortal();
    });

    expect(mockRouterPush).toHaveBeenCalledWith('/subscription');
    expect(open).not.toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });

  it('opens the Stripe portal when the API returns a portal session', async () => {
    portalResponse = { url: 'https://billing.stripe.com/p/session/abc' };
    const { result } = renderHook(() => useBilling());

    await act(async () => {
      await result.current.openCustomerPortal();
    });

    expect(open).toHaveBeenCalledWith(
      'https://billing.stripe.com/p/session/abc',
      '_blank',
      'noopener,noreferrer'
    );
    expect(mockRouterPush).not.toHaveBeenCalled();
  });
});
