import {
  PENDING_REFERRAL_KEY,
  readStoredReferral,
  redeemStoredReferral,
  referralLink,
  storeReferralCode,
} from './referral';

jest.mock('@/utils/auth', () => ({ getStytchBearerForTensrApi: () => 'jwt-test' }));
jest.mock('@/lib/session-expired', () => ({ handleUnauthorizedResponse: () => false }));

function memoryStorage() {
  const store: Record<string, string> = {};
  return {
    store,
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
  };
}

function response(status: number, body: unknown = {}) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe('referral link capture', () => {
  it('stores a valid code with a capture timestamp, upper-cased', () => {
    const storage = memoryStorage();
    storeReferralCode('tensr-abc1234567', storage);
    const stored = readStoredReferral(storage);
    expect(stored?.code).toBe('TENSR-ABC1234567');
    expect(Number.isNaN(Date.parse(stored?.captured_at ?? ''))).toBe(false);
  });

  it('ignores malformed codes', () => {
    const storage = memoryStorage();
    storeReferralCode('<script>alert(1)</script>', storage);
    storeReferralCode('abc', storage);
    expect(storage.store[PENDING_REFERRAL_KEY]).toBeUndefined();
  });

  it('keeps the most recent link', () => {
    const storage = memoryStorage();
    storeReferralCode('TENSR-AAAAAAAAAA', storage);
    storeReferralCode('TENSR-BBBBBBBBBB', storage);
    expect(readStoredReferral(storage)?.code).toBe('TENSR-BBBBBBBBBB');
  });

  it('builds the shareable link from the panel path', () => {
    expect(referralLink({ link_path: '/login?ref=TENSR-X' }, 'https://app.test/')).toBe(
      'https://app.test/login?ref=TENSR-X'
    );
  });
});

describe('redeemStoredReferral', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it('does nothing without a stored code', async () => {
    global.fetch = jest.fn();
    expect(await redeemStoredReferral(memoryStorage())).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('posts the code and capture time, then clears it on success', async () => {
    const storage = memoryStorage();
    storeReferralCode('TENSR-ABC1234567', storage);
    global.fetch = jest.fn().mockResolvedValue(response(200, { attributed: true }));

    expect(await redeemStoredReferral(storage)).toEqual({ attributed: true });
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(String(url)).toContain('/api/billing/referral/attribute');
    expect(JSON.parse(init.body)).toMatchObject({ code: 'TENSR-ABC1234567' });
    expect(init.headers.Authorization).toBe('Bearer jwt-test');
    expect(storage.store[PENDING_REFERRAL_KEY]).toBeUndefined();
  });

  it('clears the code when the server refuses it', async () => {
    const storage = memoryStorage();
    storeReferralCode('TENSR-ABC1234567', storage);
    global.fetch = jest.fn().mockResolvedValue(response(409, { detail: 'existing_account' }));
    expect(await redeemStoredReferral(storage)).toEqual({
      attributed: false,
      reason: 'existing_account',
    });
    expect(storage.store[PENDING_REFERRAL_KEY]).toBeUndefined();
  });

  it.each([500, 401])('keeps the code for a retry after HTTP %s', async status => {
    const storage = memoryStorage();
    storeReferralCode('TENSR-ABC1234567', storage);
    global.fetch = jest.fn().mockResolvedValue(response(status));
    expect(await redeemStoredReferral(storage)).toBeNull();
    expect(storage.store[PENDING_REFERRAL_KEY]).toBeDefined();
  });

  it('keeps the code after a network error', async () => {
    const storage = memoryStorage();
    storeReferralCode('TENSR-ABC1234567', storage);
    global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await redeemStoredReferral(storage)).toBeNull();
    expect(storage.store[PENDING_REFERRAL_KEY]).toBeDefined();
  });
});
