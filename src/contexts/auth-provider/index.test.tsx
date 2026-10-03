import { act, fireEvent, render, screen } from '@testing-library/react';
import { AuthProvider } from './index';
import LoginTemplate from '@/components/templates/auth/login';
import { useAuthStore } from '@/stores/auth-store';

const mockFetchMeProfile = jest.fn();
const mockRouterPush = jest.fn();
const mockSessionRevoke = jest.fn();

type Tokens = { session_token: string; session_jwt: string };
const signedInTokens: Tokens = { session_token: 'sess-token', session_jwt: 'x.y.z' };
let sdkTokens: Tokens | null = null;

const fakeStytch = {
  otps: {
    email: { loginOrCreate: async () => ({ status_code: 200, email_id: 'email-123' }) },
    authenticate: async () => ({ status_code: 200, ...signedInTokens }),
  },
  oauth: { authenticate: jest.fn() },
  session: {
    getTokens: () => sdkTokens,
    revoke: async (options?: { forceClear?: boolean }) => {
      mockSessionRevoke(options);
      if (options?.forceClear) sdkTokens = null;
    },
  },
};
// The SDK's session object can lag behind a revoke until it re-renders.
const staleStytchSession = { session_id: 'sess-1' };

jest.mock('@stytch/nextjs', () => ({
  useStytch: () => fakeStytch,
  useStytchUser: () => ({ user: null }),
  useStytchSession: () => ({ session: staleStytchSession, isInitialized: true }),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush, replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  // eslint-disable-next-line @next/next/no-img-element
  default: (props: { alt: string }) => <img alt={props.alt} />,
}));

jest.mock('@/lib/business-api', () => ({
  fetchMeProfile: (...a: unknown[]) => mockFetchMeProfile(...a),
  redeemStoredInvitation: async () => null,
  storePendingInviteToken: jest.fn(),
}));

jest.mock('@/lib/referral', () => ({
  redeemStoredReferral: async () => null,
  storeReferralCode: jest.fn(),
}));

jest.mock('@/lib/session-expired', () => ({ redirectToLogin: jest.fn() }));
jest.mock('@/lib/auth-trace', () => ({ authTrace: jest.fn(), dumpAuthTrace: jest.fn() }));
jest.mock('posthog-js', () => ({
  __esModule: true,
  default: { identify: jest.fn(), capture: jest.fn(), reset: jest.fn() },
}));

const profile = {
  user: { userId: 'u1', email: 'ada@example.com', firstName: 'Ada', lastName: 'L' },
  entitlements: { plan_code: 'pro' },
};

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (reason: unknown) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const PROFILE_ERROR = "We couldn't load your account. Please try again.";

async function signInWhileProviderLoadIsPending() {
  const providerLoad = deferred<typeof profile>();
  mockFetchMeProfile
    .mockReturnValueOnce(providerLoad.promise)
    .mockRejectedValueOnce(new Error('Internal Server Error'))
    .mockRejectedValueOnce(new Error('Internal Server Error'))
    .mockResolvedValue(profile);

  render(
    <AuthProvider>
      <LoginTemplate />
    </AuthProvider>
  );

  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'ada@example.com' } });
  fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));
  fireEvent.change(await screen.findByLabelText(/verification code/i), {
    target: { value: '123456' },
  });
  fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
  expect(await screen.findByText(PROFILE_ERROR)).toBeInTheDocument();
  return providerLoad;
}

async function waitPastProviderRetries() {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 1000));
  });
}

function expectSignedOut() {
  expect(mockRouterPush).not.toHaveBeenCalled();
  expect(useAuthStore.getState().user).toBeNull();
  expect(useAuthStore.getState().entitlements).toBeNull();
  expect(localStorage.getItem('stytch_session_token')).toBeNull();
  expect(screen.getByText(PROFILE_ERROR)).toBeInTheDocument();
}

describe('AuthProvider after a sign-in whose profile load failed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    sdkTokens = signedInTokens;
    useAuthStore.getState().reset();
  });

  it('does not sign the user in when its pending /me call later succeeds', async () => {
    const providerLoad = await signInWhileProviderLoadIsPending();
    expect(mockSessionRevoke).toHaveBeenCalledWith({ forceClear: true });

    await act(async () => {
      providerLoad.resolve(profile);
    });
    await waitPastProviderRetries();

    expectSignedOut();
  });

  it('does not retry /me with the cleared session', async () => {
    const providerLoad = await signInWhileProviderLoadIsPending();

    await act(async () => {
      providerLoad.reject(new Error('Internal Server Error'));
    });
    await waitPastProviderRetries();

    expect(mockFetchMeProfile).toHaveBeenCalledTimes(3);
    expectSignedOut();
  });
});
