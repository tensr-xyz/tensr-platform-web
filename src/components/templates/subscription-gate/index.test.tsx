import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { SubscriptionGate } from './index';

const mockReplace = jest.fn();
const mockFetchMeProfile = jest.fn();
const mockSetEntitlements = jest.fn();

let authState = {
  isAuthReady: true,
  isLoading: false,
  hasActiveSubscription: false,
};

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('@/hooks/api/use-auth', () => ({
  useAuth: () => authState,
}));

jest.mock('@/lib/business-api', () => ({
  fetchMeProfile: (...args: unknown[]) => mockFetchMeProfile(...args),
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: (selector: (s: { setEntitlements: typeof mockSetEntitlements }) => unknown) =>
    selector({ setEntitlements: mockSetEntitlements }),
}));

jest.mock('@/components/molecules/loading', () => ({
  __esModule: true,
  default: ({ fullScreen }: { fullScreen?: boolean }) => (
    <div data-testid="loading">{fullScreen ? 'full' : 'inline'}</div>
  ),
}));

const proEntitlements = {
  can_use_ai_assistant: true,
  can_generate_reports: true,
  max_team_seats: 1,
  assistant_limit_monthly: 1200,
  assistant_cost_budget_usd_micros_monthly: 4_000_000,
  report_limit_monthly: 300,
  plan_code: 'pro',
};

const noneEntitlements = {
  ...proEntitlements,
  can_use_ai_assistant: false,
  assistant_limit_monthly: 0,
  assistant_cost_budget_usd_micros_monthly: 0,
  report_limit_monthly: 50,
  plan_code: 'none',
};

describe('SubscriptionGate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authState = {
      isAuthReady: true,
      isLoading: false,
      hasActiveSubscription: false,
    };
  });

  it('does not redirect when Zustand is unpaid but /api/me returns promo Pro', async () => {
    mockFetchMeProfile.mockResolvedValue({
      user: { userId: 'u1' },
      entitlements: proEntitlements,
      subscription: { status: 'active', plan_code: 'pro' },
    });

    render(
      <SubscriptionGate>
        <div>app</div>
      </SubscriptionGate>
    );

    await waitFor(() => {
      expect(mockFetchMeProfile).toHaveBeenCalled();
      expect(mockSetEntitlements).toHaveBeenCalledWith(proEntitlements);
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('redirects to /subscription only after /api/me confirms unpaid', async () => {
    mockFetchMeProfile.mockResolvedValue({
      user: { userId: 'u1' },
      entitlements: noneEntitlements,
      subscription: null,
    });

    render(
      <SubscriptionGate>
        <div>app</div>
      </SubscriptionGate>
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/subscription?returnTo=%2Fdashboard');
    });
  });

  it('does not redirect when /api/me fails (avoids null-entitlement replace loop)', async () => {
    mockFetchMeProfile.mockRejectedValue(new Error('network'));

    render(
      <SubscriptionGate>
        <div>app</div>
      </SubscriptionGate>
    );

    await waitFor(() => {
      expect(mockFetchMeProfile).toHaveBeenCalled();
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
