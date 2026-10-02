import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import LoginTemplate from './login';
import { STYTCH_SESSION_DURATION_MINUTES } from '@/lib/stytch-session';

const mockPush = jest.fn();
const mockGoogleStart = jest.fn();
const mockGitHubStart = jest.fn();
const mockOAuthAuthenticate = jest.fn();
const mockInitiateAuth = jest.fn();
const mockVerifyAuth = jest.fn();
const mockResend = jest.fn();
const mockStoreSession = jest.fn();
const mockRedeemStoredInvitation = jest.fn();
const mockStorePendingInviteToken = jest.fn();
const mockCapture = jest.fn();
const mockRedeemStoredReferral = jest.fn();
const mockStoreReferralCode = jest.fn();

let searchParams = new URLSearchParams();

const fakeStytch = {
  oauth: {
    google: { start: (...a: unknown[]) => mockGoogleStart(...a) },
    github: { start: (...a: unknown[]) => mockGitHubStart(...a) },
    authenticate: (...a: unknown[]) => mockOAuthAuthenticate(...a),
  },
};

type AuthState = {
  isLoading: boolean;
  isAuthenticated: boolean;
  isAuthReady: boolean;
  hasActiveSubscription: boolean;
  entitlements: { plan_code: string } | null;
  error: string | null;
  stytch: typeof fakeStytch | null;
};

let authState: AuthState;

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
  useSearchParams: () => searchParams,
}));

jest.mock('next/image', () => ({
  __esModule: true,
  // eslint-disable-next-line @next/next/no-img-element
  default: (props: { alt: string }) => <img alt={props.alt} />,
}));

jest.mock('@/hooks/api/use-auth', () => ({
  useAuth: () => ({
    ...authState,
    initiateAuth: mockInitiateAuth,
    verifyAuth: mockVerifyAuth,
    resendVerificationCode: mockResend,
    initiateGoogleAuth: jest.fn(),
  }),
}));

jest.mock('@/lib/business-api', () => ({
  redeemStoredInvitation: (...a: unknown[]) => mockRedeemStoredInvitation(...a),
  storePendingInviteToken: (...a: unknown[]) => mockStorePendingInviteToken(...a),
}));

jest.mock('@/lib/referral', () => ({
  redeemStoredReferral: (...a: unknown[]) => mockRedeemStoredReferral(...a),
  storeReferralCode: (...a: unknown[]) => mockStoreReferralCode(...a),
}));

jest.mock('@/utils/auth', () => ({
  storeSession: (...a: unknown[]) => mockStoreSession(...a),
}));

jest.mock('@/lib/auth-trace', () => ({ authTrace: jest.fn(), dumpAuthTrace: jest.fn() }));

jest.mock('posthog-js', () => ({
  __esModule: true,
  default: { capture: (...a: unknown[]) => mockCapture(...a) },
}));

function stytchApiError(error_type: string, error_message: string, status_code = 400) {
  const err = new Error(
    `[${status_code}] ${error_type}\n${error_message}\nSee https://stytch.com/docs for more information.\nrequest_id: req-1\n`
  );
  err.name = 'StytchAPIError';
  return Object.assign(err, { error_type, error_message, status_code });
}

const loggedOut: AuthState = {
  isLoading: false,
  isAuthenticated: false,
  isAuthReady: true,
  hasActiveSubscription: false,
  entitlements: null,
  error: null,
  stytch: fakeStytch,
};

describe('LoginTemplate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    searchParams = new URLSearchParams();
    authState = { ...loggedOut };
    mockRedeemStoredInvitation.mockResolvedValue(null);
    mockRedeemStoredReferral.mockResolvedValue(null);
  });

  it('offers Google, GitHub and email sign-in', () => {
    render(<LoginTemplate />);
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /continue with github/i })).toBeEnabled();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^continue$/i })).toBeInTheDocument();
  });

  describe('OAuth start', () => {
    it.each([
      ['Google', mockGoogleStart],
      ['GitHub', mockGitHubStart],
    ])('%s sends login and signup back to /login', async (provider, startMock) => {
      startMock.mockResolvedValue(undefined);
      render(<LoginTemplate />);

      fireEvent.click(
        screen.getByRole('button', { name: new RegExp(`continue with ${provider}`, 'i') })
      );

      await waitFor(() => {
        expect(startMock).toHaveBeenCalledWith({
          login_redirect_url: 'http://localhost/login',
          signup_redirect_url: 'http://localhost/login',
        });
      });
      expect(mockCapture).toHaveBeenCalledWith('oauth_login_started', {
        provider: provider.toLowerCase(),
      });
    });

    it('shows a friendly error and re-enables the form when start fails', async () => {
      mockGoogleStart.mockRejectedValue(stytchApiError('too_many_requests', 'Too many.', 429));
      render(<LoginTemplate />);

      fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));

      expect(
        await screen.findByText('Too many attempts. Please wait a minute and try again.')
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /continue with google/i })).toBeEnabled();
    });

    it('does nothing if the Stytch client has not loaded', () => {
      authState = { ...loggedOut, stytch: null };
      render(<LoginTemplate />);
      fireEvent.click(screen.getByRole('button', { name: /continue with github/i }));
      expect(mockGitHubStart).not.toHaveBeenCalled();
    });
  });

  describe('OAuth callback (?stytch_token_type=oauth&token=...)', () => {
    it('exchanges the token once and stores the session', async () => {
      searchParams = new URLSearchParams('stytch_token_type=oauth&token=oauth-token-1');
      mockOAuthAuthenticate.mockResolvedValue({
        session_token: 'sess-token',
        session_jwt: 'a.b.c',
      });

      const { rerender } = render(<LoginTemplate />);
      rerender(<LoginTemplate />);

      await waitFor(() => {
        expect(mockStoreSession).toHaveBeenCalledWith('sess-token', 'a.b.c');
      });
      expect(mockOAuthAuthenticate).toHaveBeenCalledTimes(1);
      expect(mockOAuthAuthenticate).toHaveBeenCalledWith('oauth-token-1', {
        session_duration_minutes: STYTCH_SESSION_DURATION_MINUTES,
      });
      expect(mockRedeemStoredInvitation).toHaveBeenCalled();
      expect(mockCapture).toHaveBeenCalledWith('user_signed_in', { method: 'oauth' });
    });

    it('explains an expired/reused token instead of dumping the SDK error', async () => {
      searchParams = new URLSearchParams('stytch_token_type=oauth&token=used-token');
      mockOAuthAuthenticate.mockRejectedValue(
        stytchApiError('oauth_token_not_found', 'The OAuth token could not be found.', 404)
      );

      render(<LoginTemplate />);

      expect(
        await screen.findByText('That sign-in link has expired. Please try signing in again.')
      ).toBeInTheDocument();
      expect(screen.queryByText(/request_id/)).not.toBeInTheDocument();
      expect(mockStoreSession).not.toHaveBeenCalled();
    });

    it('ignores non-OAuth tokens (e.g. magic links)', () => {
      searchParams = new URLSearchParams('stytch_token_type=magic_links&token=ml-1');
      render(<LoginTemplate />);
      expect(mockOAuthAuthenticate).not.toHaveBeenCalled();
    });
  });

  describe('email OTP', () => {
    it('requires an email before sending a code', async () => {
      render(<LoginTemplate />);
      fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));
      expect(await screen.findByText('Please enter an email address')).toBeInTheDocument();
      expect(mockInitiateAuth).not.toHaveBeenCalled();
    });

    it('trims and lowercases the email, then shows the code step', async () => {
      mockInitiateAuth.mockResolvedValue({ methodId: 'email-123' });
      render(<LoginTemplate />);

      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: '  Ada@Example.COM ' },
      });
      fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

      expect(await screen.findByLabelText(/verification code/i)).toBeInTheDocument();
      expect(mockInitiateAuth).toHaveBeenCalledWith('ada@example.com');
    });

    it('stays on the email step and shows the error when sending fails', async () => {
      mockInitiateAuth.mockRejectedValue(new Error('Please enter a valid email address.'));
      render(<LoginTemplate />);

      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'nope' } });
      fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

      expect(await screen.findByText('Please enter a valid email address.')).toBeInTheDocument();
      expect(screen.queryByLabelText(/verification code/i)).not.toBeInTheDocument();
    });

    async function goToCodeStep() {
      mockInitiateAuth.mockResolvedValue({ methodId: 'email-123' });
      render(<LoginTemplate />);
      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'ada@example.com' } });
      fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));
      await screen.findByLabelText(/verification code/i);
    }

    it('verifies the code with the methodId from the send step', async () => {
      mockVerifyAuth.mockResolvedValue({ success: true });
      await goToCodeStep();

      fireEvent.change(screen.getByLabelText(/verification code/i), {
        target: { value: '123456' },
      });
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(mockVerifyAuth).toHaveBeenCalledWith('ada@example.com', '123456', 'email-123');
      });
      expect(screen.getByRole('button', { name: /verifying/i })).toBeDisabled();
    });

    it('shows why verification failed and lets the user retry', async () => {
      mockVerifyAuth.mockResolvedValue({
        success: false,
        message: 'That code is incorrect or has expired. Check your email or request a new code.',
      });
      await goToCodeStep();

      fireEvent.change(screen.getByLabelText(/verification code/i), {
        target: { value: '000000' },
      });
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      expect(await screen.findByText(/that code is incorrect or has expired/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeEnabled();
    });

    it('resends a code and uses the new methodId', async () => {
      mockResend.mockResolvedValue({ methodId: 'email-456' });
      mockVerifyAuth.mockResolvedValue({ success: true });
      await goToCodeStep();

      fireEvent.click(screen.getByRole('button', { name: /resend code/i }));
      await waitFor(() => expect(mockResend).toHaveBeenCalledWith('ada@example.com'));

      fireEvent.change(screen.getByLabelText(/verification code/i), {
        target: { value: '123456' },
      });
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(mockVerifyAuth).toHaveBeenCalledWith('ada@example.com', '123456', 'email-456');
      });
    });

    it('"Go back" returns to the email step', async () => {
      await goToCodeStep();
      fireEvent.click(screen.getByRole('button', { name: /go back/i }));
      expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
      expect(screen.queryByLabelText(/verification code/i)).not.toBeInTheDocument();
    });
  });

  describe('redirect after sign-in', () => {
    it('sends subscribed users to a safe returnTo', async () => {
      searchParams = new URLSearchParams('returnTo=/workspace/abc');
      authState = {
        ...loggedOut,
        isAuthenticated: true,
        hasActiveSubscription: true,
        entitlements: { plan_code: 'pro' },
      };
      render(<LoginTemplate />);
      await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/workspace/abc'));
    });

    it('sends unpaid users to /subscription, preserving returnTo', async () => {
      searchParams = new URLSearchParams('returnTo=/workspace/abc');
      authState = {
        ...loggedOut,
        isAuthenticated: true,
        hasActiveSubscription: false,
        entitlements: { plan_code: 'none' },
      };
      render(<LoginTemplate />);
      await waitFor(() =>
        expect(mockPush).toHaveBeenCalledWith('/subscription?returnTo=%2Fworkspace%2Fabc')
      );
    });

    it('ignores external returnTo values', async () => {
      searchParams = new URLSearchParams('returnTo=https://evil.example');
      authState = {
        ...loggedOut,
        isAuthenticated: true,
        hasActiveSubscription: true,
        entitlements: { plan_code: 'pro' },
      };
      render(<LoginTemplate />);
      await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard'));
    });

    it('waits for /me entitlements before redirecting (null is unresolved, not unpaid)', async () => {
      authState = { ...loggedOut, isAuthenticated: true, entitlements: null };
      render(<LoginTemplate />);
      await new Promise(r => setTimeout(r, 20));
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('stores an ?invite= token for redemption after sign-in', () => {
      searchParams = new URLSearchParams('invite=invite-abc');
      render(<LoginTemplate />);
      expect(mockStorePendingInviteToken).toHaveBeenCalledWith('invite-abc');
    });

    it('stores a ?ref= referral code before sign-in', () => {
      searchParams = new URLSearchParams('ref=TENSR-ABC1234567');
      render(<LoginTemplate />);
      expect(mockStoreReferralCode).toHaveBeenCalledWith('TENSR-ABC1234567');
      expect(mockRedeemStoredReferral).not.toHaveBeenCalled();
    });

    it('redeems the stored referral after sign-in, before redirecting', async () => {
      let finishRedeem: (v: null) => void = () => {};
      mockRedeemStoredReferral.mockReturnValue(new Promise(resolve => (finishRedeem = resolve)));
      authState = {
        ...loggedOut,
        isAuthenticated: true,
        hasActiveSubscription: true,
        entitlements: { plan_code: 'trial' },
      };
      render(<LoginTemplate />);
      await waitFor(() => expect(mockRedeemStoredReferral).toHaveBeenCalled());
      expect(mockPush).not.toHaveBeenCalled();
      finishRedeem(null);
      await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard'));
    });
  });
});
