import {
  alphaToLevel,
  compactCount,
  errorText,
  formatMoney,
  levelToAlpha,
  meter,
  parseInviteEmails,
  personFromApi,
  planChoice,
  planFeatures,
  planLabel,
  planPrice,
  relativeDay,
  trialProgress,
  usageNudge,
  workspaceHeading,
  type ApiPlan,
} from './settings-data';
import { flowSettingsPath } from '@/lib/settings-redirect';

jest.mock('@/components/flow/flow-shell', () => ({ memberInitials: () => 'XX' }));

const plans: ApiPlan[] = [
  {
    code: 'pro',
    name: 'Pro',
    scope: 'user',
    monthly: 79,
    annual_monthly_equiv: 63,
    assistant_limit_monthly: 1200,
    report_limit_monthly: 300,
  },
  { code: 'pro_plus', name: 'Pro+', scope: 'user', monthly: 149, annual_monthly_equiv: 119 },
  {
    code: 'teams',
    name: 'Teams',
    scope: 'organization',
    monthly: 119,
    annual_monthly_equiv: 95,
    per_seat: true,
    assistant_limit_monthly: 10000,
  },
];

describe('settings helpers', () => {
  it('labels plans and workspaces', () => {
    expect(planLabel('pro_plus')).toBe('Pro+');
    expect(planLabel('none')).toBe('No plan');
    expect(workspaceHeading('Skopos')).toBe('Skopos workspace');
    expect(workspaceHeading("Ollie's workspace")).toBe("Ollie's workspace");
    expect(workspaceHeading('')).toBe('Your workspace');
  });

  it('formats money and counts', () => {
    expect(formatMoney(79)).toBe('£79');
    expect(formatMoney(12.5, 'usd')).toBe('$12.50');
    expect(compactCount(50_000)).toBe('50k');
    expect(compactCount(1_500)).toBe('1.5k');
    expect(compactCount(1_000_000)).toBe('1M');
    expect(compactCount(42)).toBe('42');
  });

  it('says relative days', () => {
    const now = new Date('2026-11-03T12:00:00');
    expect(relativeDay('2026-11-03T08:00:00', now)).toBe('Today');
    expect(relativeDay('2026-11-02T08:00:00', now)).toBe('Yesterday');
    expect(relativeDay('2026-10-31T08:00:00', now)).toBe('3 days ago');
    expect(relativeDay('2026-10-08T08:00:00', now)).toBe('8 Oct');
  });

  it('works out trial progress', () => {
    const now = new Date('2026-11-03T00:00:00Z');
    const progress = trialProgress(
      { reason: 'trial', trial_ends_at: '2026-11-21T00:00:00Z' },
      30,
      now
    );
    expect(progress).toEqual({ used: 12, total: 30, daysLeft: 18, percent: 40 });
    expect(trialProgress({ reason: 'paid' }, 30, now)).toBeNull();
  });

  it('builds meters and the nudge from the tightest allowance', () => {
    const runs = meter('Agent runs', 96, 150);
    const reports = meter('AI reports', 131, 150);
    const rows = meter('Largest file', 95_000, 100_000, 'rows');
    expect(runs.warn).toBe(false);
    expect(reports).toMatchObject({ percent: 87, warn: true });
    expect(meter('Datasets', 4, 0)).toMatchObject({ percent: 0, warn: false });
    expect(usageNudge([runs, reports, rows], true)).toBe(
      '19 ai reports left in your trial. Pick a plan to keep going without a gap.'
    );
    expect(usageNudge([runs], false)).toBeNull();
  });

  it('prices and describes plans', () => {
    expect(planPrice(plans[0], 'annual')).toEqual({ amount: 63, unit: '/ month' });
    expect(planPrice(plans[2], 'monthly')).toEqual({ amount: 119, unit: '/ seat a month' });
    expect(planFeatures(plans[0])).toEqual(['1,200 agent runs a month', '300 AI reports a month']);
    expect(planFeatures(plans[2])).toContain('3-seat minimum');
  });

  it('chooses checkout or an in-place change', () => {
    const live = { stripeSubscriptionId: 'sub_123', status: 'ACTIVE' };
    expect(planChoice(live, 'pro', plans[0], plans)).toBe('current');
    expect(planChoice(live, 'pro', plans[1], plans)).toBe('update');
    expect(planChoice(live, 'pro', plans[2], plans)).toBe('checkout');
    expect(
      planChoice({ stripeSubscriptionId: 'trial-1', status: 'ACTIVE' }, 'trial', plans[0], plans)
    ).toBe('checkout');
    expect(planChoice(null, undefined, plans[1], plans)).toBe('checkout');
  });

  it('maps significance levels to alpha', () => {
    expect(alphaToLevel(0.05)).toBe('95');
    expect(alphaToLevel(undefined)).toBe('95');
    expect(alphaToLevel(0.1)).toBe('90');
    expect(levelToAlpha('99')).toBe(0.01);
    expect(levelToAlpha('90')).toBe(0.1);
  });

  it('splits invite emails', () => {
    expect(parseInviteEmails('a@x.com, B@x.com; a@x.com nope')).toEqual({
      valid: ['a@x.com', 'b@x.com'],
      invalid: ['nope'],
    });
  });

  it('reads members and API errors', () => {
    expect(personFromApi({ user_id: 'u1', email: 'jo@x.com', role: 'owner' })).toMatchObject({
      name: 'jo',
      role: 'owner',
    });
    expect(errorText(new Error('{"detail":"Owner role required"}'), 'x')).toBe(
      'Owner role required'
    );
    expect(errorText(new Error(''), 'fallback')).toBe('fallback');
  });

  it('keeps the query when old settings routes redirect', () => {
    expect(flowSettingsPath('billing', { checkout: 'success' })).toBe(
      '/flow/settings/billing?checkout=success'
    );
    expect(flowSettingsPath('organisation')).toBe('/flow/settings/organisation');
    expect(flowSettingsPath('usage', { a: ['1', '2'] })).toBe('/flow/settings/usage?a=1&a=2');
  });
});
