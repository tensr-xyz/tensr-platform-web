import { act, renderHook } from '@testing-library/react';
import { useAuth } from './index';
import { useAuthStore } from '@/stores/auth-store';
import { STYTCH_SESSION_DURATION_MINUTES } from '@/lib/stytch-session';
import posthog from 'posthog-js';

const mockLoginOrCreate = jest.fn();
const mockOtpAuthenticate = jest.fn();
const mockGoogleStart = jest.fn();
const mockSessionRevoke = jest.fn();
const mockFetchMeProfile = jest.fn();
const mockRedeemStoredInvitation = jest.fn();
const mockRouterPush = jest.fn();

const fakeStytch = {
  otps: {
    email: { loginOrCreate: (...a: unknown[]) => mockLoginOrCreate(...a) },
    authenticate: (...a: unknown[]) => mockOtpAuthenticate(...a),
  },
  oauth: { google: { start: (...a: unknown[]) => mockGoogleStart(...a) } },
  session: { revoke: (...a: unknown[]) => mockSessionRevoke(...a), getTokens: () => null },
};

let stytchSession: object | null = null;

jest.mock('@stytch/nextjs', () => ({
  useStytch: () => fakeStytch,
  useStytchUser: () => ({ user: null }),
  useStytchSession: () => ({ session: stytchSession, isInitialized: true }),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush, replace: jest.fn() }),
}));

jest.mock('@/lib/business-api', () => ({
  fetchMeProfile: (...a: unknown[]) => mockFetchMeProfile(...a),
  redeemStoredInvitation: (...a: unknown[]) => mockRedeemStoredInvitation(...a),
}));

jest.mock('posthog-js', () => ({
  __esModule: true,
  default: { identify: jest.fn(), capture: jest.fn(), reset: jest.fn() },
}));

function stytchApiError(error_type: string, error_message: string, status_code = 400) {
  const err = new Error(
    `[${status_code}] ${error_type}\n${error_message}\nSee https://stytch.com/docs for more information.\nrequest_id: req-1\n`
  );
  err.name = 'StytchAPIError';
  return Object.assign(err, { error_type, error_message, status_code });
}

const profile = {
  user: { userId: 'u1', email: 'ada@example.com', firstName: 'Ada', lastName: 'L' },
  entitlements: { plan_code: 'pro' },
};

describe('useAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    stytchSession = null;
    useAuthStore.getState().reset();
    mockRedeemStoredInvitation.mockResolvedValue(null);
  });

  describe('email OTP sign-in / sign-up', () => {
    it('sends a code via loginOrCreate (one flow for new and existing users)', async () => {
      mockLoginOrCreate.mockResolvedValue({ status_code: 200, email_id: 'email-123' });
      const { result } = renderHook(() => useAuth());

      let out: { methodId?: string } | undefined;
      await act(async () => {
        out = await result.current.initiateAuth('ada@example.com');
      });

      expect(mockLoginOrCreate).toHaveBeenCalledWith('ada@example.com');
      expect(out?.methodId).toBe('email-123');
    });

    it('surfaces a friendly error when Stytch rejects the email', async () => {
      mockLoginOrCreate.mockRejectedValue(
        stytchApiError('invalid_email', 'Email format is invalid.')
      );
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await expect(result.current.initiateAuth('not-an-email')).rejects.toThrow(
          'Please enter a valid email address.'
        );
      });
      expect(useAuthStore.getState().error).toBe('Please enter a valid email address.');
    });

    it('verifies the code, stores the session and loads the tensr profile', async () => {
      mockOtpAuthenticate.mockResolvedValue({
        status_code: 200,
        session_token: 'sess-token',
        session_jwt: 'a.b.c',
      });
      mockFetchMeProfile.mockResolvedValue(profile);
      const { result } = renderHook(() => useAuth());

      let out: { success: boolean } | undefined;
      await act(async () => {
        out = await result.current.verifyAuth('ada@example.com', '123456', 'email-123');
      });

      expect(out?.success).toBe(true);
      expect(mockOtpAuthenticate).toHaveBeenCalledWith('123456', 'email-123', {
        session_duration_minutes: STYTCH_SESSION_DURATION_MINUTES,
      });
      expect(localStorage.getItem('stytch_session_token')).toBe('sess-token');
      expect(document.cookie).toContain('stytch_session_token=sess-token');
      expect(useAuthStore.getState().user?.userId).toBe('u1');
      expect(useAuthStore.getState().entitlements?.plan_code).toBe('pro');
    });

    it('tells the user their code is wrong (SDK throws, does not return non-200)', async () => {
      mockOtpAuthenticate.mockRejectedValue(
        stytchApiError('otp_code_not_found', 'The OTP code could not be found.', 404)
      );
      const { result } = renderHook(() => useAuth());

      let out: { success: boolean; message?: string } | undefined;
      await act(async () => {
        out = await result.current.verifyAuth('ada@example.com', '000000', 'email-123');
      });

      expect(out?.success).toBe(false);
      expect(out?.message).toBe(
        'That code is incorrect or has expired. Check your email or request a new code.'
      );
      expect(localStorage.getItem('stytch_session_token')).toBeNull();
    });

    it('asks for a new code when the methodId is missing', async () => {
      const { result } = renderHook(() => useAuth());

      let out: { success: boolean; code?: string } | undefined;
      await act(async () => {
        out = await result.current.verifyAuth('ada@example.com', '123456');
      });

      expect(out).toMatchObject({ success: false, code: 'METHOD_ID_MISSING' });
      expect(mockOtpAuthenticate).not.toHaveBeenCalled();
    });

    describe('when tensr-api /me fails', () => {
      const stytchResponse = {
        status_code: 200,
        session_token: 'sess-token',
        user: {
          user_id: 'stytch-user-1',
          emails: [{ email: 'ada@example.com' }],
          name: { first_name: 'Ada' },
        },
      };

      it('retries /me once and signs in when the retry succeeds', async () => {
        mockOtpAuthenticate.mockResolvedValue(stytchResponse);
        mockFetchMeProfile
          .mockRejectedValueOnce(new Error('Internal Server Error'))
          .mockResolvedValueOnce(profile);
        const { result } = renderHook(() => useAuth());

        let out: { success: boolean } | undefined;
        await act(async () => {
          out = await result.current.verifyAuth('ada@example.com', '123456', 'email-123');
        });

        expect(out?.success).toBe(true);
        expect(mockFetchMeProfile).toHaveBeenCalledTimes(2);
        expect(useAuthStore.getState().user?.userId).toBe('u1');
        expect(useAuthStore.getState().entitlements?.plan_code).toBe('pro');
      });

      it('fails sign-in without a Stytch fallback user when the retry also fails', async () => {
        mockOtpAuthenticate.mockResolvedValue(stytchResponse);
        mockFetchMeProfile.mockRejectedValue(new Error('Internal Server Error'));
        const { result } = renderHook(() => useAuth());

        let out: { success: boolean; code?: string; message?: string } | undefined;
        await act(async () => {
          out = await result.current.verifyAuth('ada@example.com', '123456', 'email-123');
        });

        expect(out).toEqual({
          success: false,
          code: 'PROFILE_LOAD_FAILED',
          message: "We couldn't load your account. Please try again.",
        });
        expect(mockFetchMeProfile).toHaveBeenCalledTimes(2);
        expect(useAuthStore.getState().user).toBeNull();
        expect(useAuthStore.getState().error).toBe(
          "We couldn't load your account. Please try again."
        );
        expect(posthog.capture).not.toHaveBeenCalledWith('user_signed_in', expect.anything());
      });

      it('does not retry when /me reports the session expired', async () => {
        mockOtpAuthenticate.mockResolvedValue(stytchResponse);
        mockFetchMeProfile.mockRejectedValue(new Error('Session expired'));
        const { result } = renderHook(() => useAuth());

        let out: { success: boolean; code?: string } | undefined;
        await act(async () => {
          out = await result.current.verifyAuth('ada@example.com', '123456', 'email-123');
        });

        expect(out).toMatchObject({ success: false, code: 'PROFILE_LOAD_FAILED' });
        expect(mockFetchMeProfile).toHaveBeenCalledTimes(1);
        expect(useAuthStore.getState().user).toBeNull();
      });
    });

    it('resends a code and returns the new methodId', async () => {
      mockLoginOrCreate.mockResolvedValue({ status_code: 200, email_id: 'email-456' });
      const { result } = renderHook(() => useAuth());

      let out: { methodId?: string } | undefined;
      await act(async () => {
        out = await result.current.resendVerificationCode('ada@example.com');
      });

      expect(out?.methodId).toBe('email-456');
    });

    it('surfaces rate limiting on resend', async () => {
      mockLoginOrCreate.mockRejectedValue(
        stytchApiError('too_many_requests', 'Too many requests.', 429)
      );
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await expect(result.current.resendVerificationCode('ada@example.com')).rejects.toThrow(
          'Too many attempts. Please wait a minute and try again.'
        );
      });
    });
  });

  describe('logout', () => {
    it('revokes the Stytch session, clears tokens and returns to /login', async () => {
      stytchSession = { session_id: 's1' };
      localStorage.setItem('stytch_session_token', 'sess-token');
      mockSessionRevoke.mockResolvedValue(undefined);
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.handleLogout();
      });

      expect(mockSessionRevoke).toHaveBeenCalled();
      expect(localStorage.getItem('stytch_session_token')).toBeNull();
      expect(mockRouterPush).toHaveBeenCalledWith('/login');
    });

    it('still logs out locally if revoking the Stytch session fails', async () => {
      stytchSession = { session_id: 's1' };
      localStorage.setItem('stytch_session_token', 'sess-token');
      mockSessionRevoke.mockRejectedValue(new Error('network'));
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.handleLogout();
      });

      expect(localStorage.getItem('stytch_session_token')).toBeNull();
      expect(mockRouterPush).toHaveBeenCalledWith('/login');
    });
  });
});
