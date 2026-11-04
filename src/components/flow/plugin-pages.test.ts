import {
  ageLabel,
  apiErrorText,
  installLabel,
  money,
  permissionLines,
  permissionSummary,
  priceLabel,
  reviewState,
  scanLines,
  trialLine,
  visibilityLabel,
} from './plugin-pages';

describe('plugin page helpers', () => {
  it('formats prices from the pricing the API returns', () => {
    expect(money(12, 'gbp')).toBe('£12');
    expect(money(4.5, 'usd')).toBe('$4.50');
    expect(money(3, 'sek')).toBe('3 SEK');
    expect(priceLabel({ model: 'subscription', price: 12, currency: 'gbp' })).toBe('£12 / month');
    expect(
      priceLabel({
        model: 'subscription',
        price: 99,
        currency: 'gbp',
        subscriptionInterval: 'yearly',
      })
    ).toBe('£99 / year');
    expect(priceLabel({ model: 'one-time', price: 40, currency: 'usd' })).toBe('$40 one-off');
    expect(priceLabel(null)).toBeNull();
    expect(priceLabel({ price: 0 })).toBeNull();
  });

  it('labels install buttons and trial lines', () => {
    expect(installLabel({ isPaid: false, pricing: null })).toBe('Install');
    expect(
      installLabel({ isPaid: true, pricing: { model: 'subscription', price: 12, currency: 'gbp' } })
    ).toBe('Install · £12 / month');
    expect(trialLine({ model: 'subscription', price: 12, trialDays: 14 })).toBe(
      '14-day free trial · cancel any time'
    );
    expect(trialLine({ model: 'one-time', price: 12 })).toBeNull();
  });

  it('turns declared capabilities into can/cannot lines', () => {
    const lines = permissionLines({ dataAccess: ['schema', 'columns'], network: false });
    expect(lines).toEqual([
      { allowed: true, text: 'Column names and types' },
      { allowed: true, text: 'Values in the columns you run it on' },
      { allowed: false, text: 'Respondent-level rows' },
      { allowed: false, text: 'The internet. It cannot send your data anywhere.' },
    ]);
    expect(permissionLines(undefined)).toEqual([]);
    expect(permissionSummary({ dataAccess: ['schema'], network: false })).toBe(
      "Read column names and types. It can't reach respondent-level rows or the internet."
    );
  });

  it('maps review status', () => {
    expect(reviewState('APPROVED').label).toBe('Live');
    expect(reviewState('PENDING').tone).toBe('warn');
    expect(reviewState('REJECTED').label).toBe('Changes asked');
    expect(visibilityLabel('APPROVED')).toBe('Marketplace');
    expect(visibilityLabel('PENDING')).toBe('Not listed');
  });

  it('reads scan results', () => {
    expect(scanLines({ passed: true, findings: [] })).toEqual([
      { text: 'Static code scan', passed: true },
    ]);
    expect(scanLines({ passed: false, findings: ['a.js: eval'] })).toEqual([
      { text: 'a.js: eval', passed: false },
    ]);
    expect(scanLines(null)).toEqual([]);
  });

  it('describes ages', () => {
    const now = Date.parse('2026-11-03T12:00:00Z');
    expect(ageLabel('2026-11-03T06:00:00Z', now)).toBe('6 hours');
    expect(ageLabel('2026-11-01T12:00:00Z', now)).toBe('2 days');
    expect(ageLabel('2026-11-02T11:00:00Z', now)).toBe('1 day');
    expect(ageLabel('nope', now)).toBeNull();
  });

  it('pulls detail out of API errors', () => {
    expect(apiErrorText(new Error('{"detail":"Nope"}'), 'x')).toBe('Nope');
    expect(apiErrorText(new Error('plain'), 'x')).toBe('plain');
    expect(apiErrorText(null, 'fallback')).toBe('fallback');
  });
});
