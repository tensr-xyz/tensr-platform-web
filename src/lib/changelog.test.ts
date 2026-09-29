import {
  CHANGELOG_SEEN_STORAGE_KEY,
  LANDING_CHANGELOG_URL,
  fetchChangelogFeed,
  hasUnread,
  latestVersion,
  parseChangelogPayload,
  readSeenVersion,
  writeSeenVersion,
} from './changelog';

const sample = {
  success: true,
  data: [
    {
      title: 'ARIMA matches auto.arima; trees default to pruned',
      date: '2026-09-28',
      version: '0.4.1',
      tags: ['fix', 'improvement'],
      url: 'https://www.tensr.xyz/changelog#0-4-1-arima-matches-auto-arima-trees-default-to-pruned',
      summary: 'Automatic ARIMA now picks the order the same way as R’s forecast::auto.arima.',
    },
    {
      title: 'Significance letters on weighted banners',
      date: '2026-09-18',
      version: '0.4.0',
      tags: ['feature'],
      url: 'https://www.tensr.xyz/changelog#0-4-0-significance-letters-on-weighted-banners',
      summary: 'Column letters now run on the weighted banner.',
    },
  ],
  error: null,
  meta: { total: 2, page: 1, limit: 10 },
};

describe('parseChangelogPayload', () => {
  it('reads the public changelog envelope', () => {
    const entries = parseChangelogPayload(sample);
    expect(entries).toHaveLength(2);
    expect(entries[0].version).toBe('0.4.1');
    expect(entries[0].title).toContain('ARIMA');
    expect(entries[0].tags).toEqual(['fix', 'improvement']);
  });

  it('rejects a failed envelope', () => {
    expect(() => parseChangelogPayload({ success: false, data: null, error: 'down' })).toThrow(
      'down'
    );
  });

  it('rejects a payload without data', () => {
    expect(() => parseChangelogPayload({ success: true, data: null, error: null })).toThrow(
      /missing/i
    );
  });
});

describe('unread state', () => {
  it('treats an unseen latest version as unread', () => {
    expect(hasUnread('0.4.1', null)).toBe(true);
    expect(hasUnread('0.4.1', '0.4.0')).toBe(true);
    expect(hasUnread('0.4.1', '0.4.1')).toBe(false);
    expect(hasUnread(null, null)).toBe(false);
  });

  it('uses the first feed entry as the latest version', () => {
    expect(latestVersion(parseChangelogPayload(sample))).toBe('0.4.1');
    expect(latestVersion([])).toBeNull();
  });

  it('persists the seen version in localStorage', () => {
    const storage = {
      store: {} as Record<string, string>,
      getItem(key: string) {
        return this.store[key] ?? null;
      },
      setItem(key: string, value: string) {
        this.store[key] = value;
      },
    };

    expect(readSeenVersion(storage)).toBeNull();
    writeSeenVersion('0.4.1', storage);
    expect(storage.store[CHANGELOG_SEEN_STORAGE_KEY]).toBe('0.4.1');
    expect(readSeenVersion(storage)).toBe('0.4.1');
  });
});

describe('fetchChangelogFeed', () => {
  it('GETs the landing changelog API', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => sample,
    });

    const entries = await fetchChangelogFeed(fetchImpl);
    expect(fetchImpl).toHaveBeenCalledWith(
      LANDING_CHANGELOG_URL,
      expect.objectContaining({ headers: { Accept: 'application/json' } })
    );
    expect(entries[0].version).toBe('0.4.1');
  });

  it('throws when the landing changelog is down', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({}),
    });
    await expect(fetchChangelogFeed(fetchImpl)).rejects.toThrow(/502/);
  });
});
