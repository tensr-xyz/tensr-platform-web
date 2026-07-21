import {
  entitlementsResolved,
  hasActiveSubscription,
  subscriptionRedirectPath,
} from './subscription';

describe('subscription helpers', () => {
  it('treats null/undefined entitlements as unresolved, not unpaid', () => {
    expect(entitlementsResolved(null)).toBe(false);
    expect(entitlementsResolved(undefined)).toBe(false);
    expect(hasActiveSubscription(null)).toBe(false);
    expect(hasActiveSubscription(undefined)).toBe(false);
  });

  it('treats plan_code none as resolved but unpaid', () => {
    const none = {
      can_use_ai_assistant: false,
      can_generate_reports: true,
      max_team_seats: 1,
      assistant_limit_monthly: 0,
      assistant_cost_budget_usd_micros_monthly: 0,
      report_limit_monthly: 50,
      plan_code: 'none',
    };
    expect(entitlementsResolved(none)).toBe(true);
    expect(hasActiveSubscription(none)).toBe(false);
  });

  it('recognizes promo/manual comp Pro entitlements as active', () => {
    const pro = {
      can_use_ai_assistant: true,
      can_generate_reports: true,
      max_team_seats: 1,
      assistant_limit_monthly: 1200,
      assistant_cost_budget_usd_micros_monthly: 4_000_000,
      report_limit_monthly: 300,
      plan_code: 'pro',
    };
    expect(entitlementsResolved(pro)).toBe(true);
    expect(hasActiveSubscription(pro)).toBe(true);
  });

  it('builds subscription redirect with returnTo', () => {
    expect(subscriptionRedirectPath('/dashboard')).toBe('/subscription?returnTo=%2Fdashboard');
    expect(subscriptionRedirectPath('https://evil.example')).toBe('/subscription');
  });
});
