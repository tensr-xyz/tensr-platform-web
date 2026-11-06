import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import LoginTemplate from './login';
import { STYTCH_SESSION_DURATION_MINUTES } from '@/lib/stytch-session';

const mockPush = jest.fn();
const mockGoogleStart = jest.fn();
const mockMicrosoftStart = jest.fn();
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
const mockSendSessionEmailCode = jest.fn();

let searchParams = new URLSearchParams();

const fakeStytch = {
  oauth: {
    google: { start: (...a: unknown[]) => mockGoogleStart(...a) },
    microsoft: { start: (...a: unknown[]) => mockMicrosoftStart(...a) },
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
  needsEmail: {
    firstName: string | null;
    lastName: string | null;
    suggestedEmail: string | null;
  } | null;
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
  sendSessionEmailCode: (...a: unknown[]) => mockSendSessionEmailCode(...a),
  NeedsEmailError: class NeedsEmailError extends Error {},
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
  default: {
    capture: (...a: unknown[]) => mockCapture(...a),
    captureException: jest.fn(),
  },
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
  needsEmail: null,
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

  it('prefills the work email from ?email= and does not send a code', () => {
    searchParams = new URLSearchParams('email=ada%40example.com');
    render(<LoginTemplate />);
    expect(screen.getByLabelText(/work email/i)).toHaveValue('ada@example.com');
    expect(mockInitiateAuth).not.toHaveBeenCalled();
  });

  it('offers Google, Microsoft, GitHub and email sign-in', () => {
    render(<LoginTemplate />);
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /continue with microsoft/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /continue with github/i })).toBeEnabled();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /email me a code/i })).toBeInTheDocument();
  });

  describe('OAuth start', () => {
    it.each([
      ['Google', mockGoogleStart],
      ['Microsoft', mockMicrosoftStart],
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

  describe('Microsoft account with no mailbox', () => {
    it('prefills the sign-in name and shows a send failure once', async () => {
      authState = {
        ...loggedOut,
        needsEmail: {
          firstName: 'Ollie',
          lastName: 'Darby',
          suggestedEmail: 'ollie.darby@tensr.xyz',
        },
      };
      mockSendSessionEmailCode.mockRejectedValue(new Error('Not Found'));
      render(<LoginTemplate />);

      expect(await screen.findByDisplayValue('ollie.darby@tensr.xyz')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /send code/i }));

      expect(await screen.findAllByText("Couldn't send the code, try again")).toHaveLength(1);
      expect(screen.queryByText('Not Found')).not.toBeInTheDocument();
    });
  });

  describe('email OTP', () => {
    it('requires an email before sending a code', async () => {
      render(<LoginTemplate />);
      fireEvent.click(screen.getByRole('button', { name: /email me a code/i }));
      expect(await screen.findByText('Please enter an email address')).toBeInTheDocument();
      expect(mockInitiateAuth).not.toHaveBeenCalled();
    });

    it('trims and lowercases the email, then shows the code step', async () => {
      mockInitiateAuth.mockResolvedValue({ methodId: 'email-123' });
      render(<LoginTemplate />);

      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: '  Ada@Example.COM ' },
      });
      fireEvent.click(screen.getByRole('button', { name: /email me a code/i }));

      expect(await screen.findByLabelText(/6-digit code/i)).toBeInTheDocument();
      expect(mockInitiateAuth).toHaveBeenCalledWith('ada@example.com');
    });

    it('stays on the email step and shows the error when sending fails', async () => {
      mockInitiateAuth.mockRejectedValue(new Error('Please enter a valid email address.'));
      render(<LoginTemplate />);

      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'nope' } });
      fireEvent.click(screen.getByRole('button', { name: /email me a code/i }));

      expect(await screen.findByText('Please enter a valid email address.')).toBeInTheDocument();
      expect(screen.queryByLabelText(/6-digit code/i)).not.toBeInTheDocument();
    });

    async function goToCodeStep() {
      mockInitiateAuth.mockResolvedValue({ methodId: 'email-123' });
      render(<LoginTemplate />);
      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'ada@example.com' } });
      fireEvent.click(screen.getByRole('button', { name: /email me a code/i }));
      await screen.findByLabelText(/6-digit code/i);
      expect(screen.getByText(/codes can take a minute/i)).toBeInTheDocument();
      expect(screen.getByText(/we sent a 6-digit code to/i)).toBeInTheDocument();
    }

    it('verifies the code with the methodId from the send step', async () => {
      mockVerifyAuth.mockResolvedValue({ success: true });
      await goToCodeStep();

      fireEvent.change(screen.getByLabelText(/6-digit code/i), {
        target: { value: '123456' },
      });
      fireEvent.click(screen.getByRole('button', { name: /^verify/i }));

      await waitFor(() => {
        expect(mockVerifyAuth).toHaveBeenCalledWith('ada@example.com', '123456', 'email-123');
      });
      // Once the code is accepted the form gives way to the app's loading state until /flow draws.
      expect(await screen.findByText('Signing you in…')).toBeInTheDocument();
      expect(screen.queryByLabelText(/6-digit code/i)).not.toBeInTheDocument();
    });

    it('shows why verification failed and lets the user retry', async () => {
      mockVerifyAuth.mockResolvedValue({
        success: false,
        message: 'That code is incorrect or has expired. Check your email or request a new code.',
      });
      await goToCodeStep();

      fireEvent.change(screen.getByLabelText(/6-digit code/i), {
        target: { value: '000000' },
      });
      fireEvent.click(screen.getByRole('button', { name: /^verify/i }));

      expect(await screen.findByText(/that code is incorrect or has expired/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^verify/i })).toBeEnabled();
    });

    it('resends a code and uses the new methodId', async () => {
      jest.useFakeTimers({ advanceTimers: true });
      try {
        mockResend.mockResolvedValue({ methodId: 'email-456' });
        mockVerifyAuth.mockResolvedValue({ success: true });
        await goToCodeStep();

        expect(screen.getByRole('button', { name: /resend code in 0:30/i })).toBeDisabled();
        await act(async () => {
          jest.advanceTimersByTime(30_000);
        });
        fireEvent.click(screen.getByRole('button', { name: /^resend code$/i }));
        await waitFor(() => expect(mockResend).toHaveBeenCalledWith('ada@example.com'));

        fireEvent.change(screen.getByLabelText(/6-digit code/i), {
          target: { value: '123456' },
        });
        fireEvent.click(screen.getByRole('button', { name: /^verify/i }));

        await waitFor(() => {
          expect(mockVerifyAuth).toHaveBeenCalledWith('ada@example.com', '123456', 'email-456');
        });
      } finally {
        jest.useRealTimers();
      }
    });

    it('"Go back" returns to the email step', async () => {
      await goToCodeStep();
      fireEvent.click(screen.getByRole('button', { name: /use a different email/i }));
      expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
      expect(screen.queryByLabelText(/6-digit code/i)).not.toBeInTheDocument();
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
      await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/flow'));
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
      await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/flow'));
    });
  });
});

describe('LoginTemplate: signing in', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.sessionStorage.clear();
    authState = { ...loggedOut };
    mockRedeemStoredInvitation.mockResolvedValue(null);
    mockRedeemStoredReferral.mockResolvedValue(null);
  });

  it('shows "Signing you in…" from the OAuth return, not a blank or the form', () => {
    searchParams = new URLSearchParams('stytch_token_type=oauth&token=tok');
    mockOAuthAuthenticate.mockReturnValue(new Promise(() => undefined));
    render(<LoginTemplate />);
    expect(screen.getByText('Signing you in…')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /continue with google/i })).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem('tensr-signing-in')).not.toBeNull();
  });

  it('goes back to the form with the error when the OAuth return fails', async () => {
    searchParams = new URLSearchParams('stytch_token_type=oauth&token=tok');
    mockOAuthAuthenticate.mockRejectedValue(new Error('expired'));
    render(<LoginTemplate />);
    expect(
      await screen.findByRole('button', { name: /continue with google/i })
    ).toBeInTheDocument();
  });

  it('keeps "Signing you in…" while an already signed-in user is sent on', () => {
    searchParams = new URLSearchParams();
    authState = {
      ...loggedOut,
      isAuthenticated: true,
      hasActiveSubscription: true,
      entitlements: { plan_code: 'pro' },
    };
    render(<LoginTemplate />);
    expect(screen.getByText('Signing you in…')).toBeInTheDocument();
  });

  it('shows the real provider marks on the buttons', () => {
    searchParams = new URLSearchParams();
    const { container } = render(<LoginTemplate />);
    expect(container.querySelectorAll('.signin-provider svg[data-provider]')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument();
  });
});
