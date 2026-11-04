/** Shapes and pure helpers for the Flow settings screens (7a–7f). */

export type MeAccess = {
  mode?: string;
  reason?: string;
  days_remaining?: number | null;
  trial_ends_at?: string | null;
};

export type MeEntitlements = {
  plan_code?: string;
  assistant_limit_monthly?: number;
  report_limit_monthly?: number;
  max_datasets?: number;
  max_rows_per_dataset?: number;
  trial_days?: number | null;
  max_team_seats?: number;
};

export type MePage = {
  user?: { firstName?: string | null; lastName?: string | null; email?: string };
  active_organization?: { id?: string; name?: string; role?: string };
  entitlements?: MeEntitlements;
  access?: MeAccess;
};

export type LegacySubscription = {
  tier?: string | null;
  status?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  renewalDate?: string;
  cancelAtPeriodEnd?: boolean;
  cancelAt?: string | null;
};

export type ApiPlan = {
  code: string;
  name: string;
  scope?: string;
  monthly?: number | null;
  annual_monthly_equiv?: number | null;
  annual_total?: number | null;
  per_seat?: boolean;
  assistant_limit_monthly?: number;
  report_limit_monthly?: number;
};

export type Invoice = {
  invoiceId: string;
  amount: number;
  currency: string;
  status: string;
  description?: string;
  pdfUrl?: string | null;
  createdAt?: string | null;
};

export type BillingInterval = 'monthly' | 'annual';

export const PAID_PLANS = ['pro', 'pro_plus', 'teams'] as const;

const PLAN_LABELS: Record<string, string> = {
  trial: 'Trial',
  pro: 'Pro',
  pro_plus: 'Pro+',
  teams: 'Teams',
};

export function planLabel(code?: string | null): string {
  if (!code || code === 'none') return 'No plan';
  return PLAN_LABELS[code] || code.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
}

/** "Skopos" → "Skopos workspace"; "Ollie's workspace" stays as it is. */
export function workspaceHeading(name?: string | null): string {
  const text = (name || '').trim();
  if (!text) return 'Your workspace';
  return /workspace$/i.test(text) ? text : `${text} workspace`;
}

const SYMBOLS: Record<string, string> = { GBP: '£', USD: '$', EUR: '€' };

export function formatMoney(amount: number, currency = 'GBP'): string {
  const code = currency.toUpperCase();
  const symbol = SYMBOLS[code];
  const whole = Number.isInteger(amount);
  const text = amount.toLocaleString('en-GB', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return symbol ? `${symbol}${text}` : `${text} ${code}`;
}

export function formatDay(iso?: string | null, now: Date = new Date()): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/** Today, Yesterday, 3 days ago, then the date. */
export function relativeDay(iso?: string | null, now: Date = new Date()): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((start(now) - start(date)) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return formatDay(iso, now);
}

export function compactCount(value: number): string {
  if (value >= 1_000_000) {
    const m = value / 1_000_000;
    return `${Number.isInteger(m) ? m : m.toFixed(1)}M`;
  }
  if (value >= 1_000) {
    const k = value / 1_000;
    return `${k >= 10 || Number.isInteger(k) ? Math.round(k) : k.toFixed(1)}k`;
  }
  return String(value);
}

export type TrialProgress = { used: number; total: number; daysLeft: number; percent: number };

export function trialProgress(
  access: MeAccess | undefined,
  trialDays: number | null | undefined,
  now: Date = new Date()
): TrialProgress | null {
  if (!access || access.reason !== 'trial' || !access.trial_ends_at) return null;
  const end = new Date(access.trial_ends_at).getTime();
  if (Number.isNaN(end)) return null;
  const total = trialDays && trialDays > 0 ? trialDays : 30;
  const daysLeft = Math.max(0, Math.ceil((end - now.getTime()) / 86_400_000));
  const used = Math.min(total, Math.max(0, total - daysLeft));
  return { used, total, daysLeft, percent: Math.round((used / total) * 100) };
}

export type Meter = {
  label: string;
  used: number;
  cap: number;
  unit?: string;
  percent: number;
  warn: boolean;
};

/** A cap of 0 means the plan has no limit for this figure. */
export function meter(label: string, used: number, cap: number, unit?: string): Meter {
  const percent = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0;
  return { label, used, cap, unit, percent, warn: cap > 0 && percent >= 80 };
}

/** The nudge under the usage cards: the tightest capped allowance at 80% or more. */
export function usageNudge(meters: Meter[], onTrial: boolean): string | null {
  const counted = meters.filter(item => item.warn && !item.unit);
  if (!counted.length) return null;
  const tightest = counted.reduce((a, b) => (b.percent > a.percent ? b : a));
  const left = Math.max(0, tightest.cap - tightest.used);
  const what = tightest.label.toLowerCase();
  if (left === 0) {
    return onTrial
      ? `You have used all your ${what} for this trial. Pick a plan to keep going.`
      : `You have used all your ${what} this month. Move up a plan to keep going.`;
  }
  return onTrial
    ? `${left.toLocaleString('en-GB')} ${what} left in your trial. Pick a plan to keep going without a gap.`
    : `${left.toLocaleString('en-GB')} ${what} left this month. Move up a plan to keep going without a gap.`;
}

export function planPrice(
  plan: ApiPlan,
  interval: BillingInterval
): { amount: number; unit: string } | null {
  const amount = interval === 'annual' ? plan.annual_monthly_equiv : plan.monthly;
  if (amount == null) return null;
  return { amount, unit: plan.per_seat ? '/ seat a month' : '/ month' };
}

const PLAN_BLURBS: Record<string, string> = {
  pro: 'One researcher running their own studies',
  pro_plus: 'Lean on the agent every day',
  teams: 'Research teams sharing a workspace',
};

export function planBlurb(code: string): string {
  return PLAN_BLURBS[code] || '';
}

export function planFeatures(plan: ApiPlan, seatMin = 3): string[] {
  const lines: string[] = [];
  if (plan.assistant_limit_monthly) {
    lines.push(`${plan.assistant_limit_monthly.toLocaleString('en-GB')} agent runs a month`);
  }
  if (plan.report_limit_monthly) {
    lines.push(`${plan.report_limit_monthly.toLocaleString('en-GB')} AI reports a month`);
  }
  if (plan.per_seat) {
    lines.push('Shared workspace and seats');
    lines.push(`${seatMin}-seat minimum`);
  }
  return lines;
}

export function isLiveStripeSubscription(sub: LegacySubscription | null | undefined): boolean {
  if (!sub) return false;
  const status = (sub.status || '').toLowerCase();
  return Boolean(sub.stripeSubscriptionId?.startsWith('sub_')) && status !== 'canceled';
}

/**
 * How choosing a plan is carried out. A live Stripe plan on the same scope is changed in place;
 * anything else (trial, ended plan, personal → Teams) goes through Stripe checkout.
 */
export function planChoice(
  sub: LegacySubscription | null | undefined,
  currentCode: string | undefined,
  target: ApiPlan,
  plans: ApiPlan[]
): 'current' | 'update' | 'checkout' {
  if (currentCode === target.code && isLiveStripeSubscription(sub)) return 'current';
  if (!isLiveStripeSubscription(sub)) return 'checkout';
  const current = plans.find(plan => plan.code === currentCode);
  if (current && (current.scope || 'user') !== (target.scope || 'user')) return 'checkout';
  return 'update';
}

export function alphaToLevel(alpha: number | null | undefined): string {
  const value = typeof alpha === 'number' && alpha > 0 && alpha <= 1 ? alpha : 0.05;
  return String(Math.round((1 - value) * 100));
}

export function levelToAlpha(level: string): number {
  return Math.round((100 - Number(level)) * 1000) / 100_000;
}

const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

export function parseInviteEmails(text: string): { valid: string[]; invalid: string[] } {
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const piece of text.split(/[\s,;]+/)) {
    const email = piece.trim().toLowerCase();
    if (!email) continue;
    if (!EMAIL.test(email)) invalid.push(piece.trim());
    else if (!valid.includes(email)) valid.push(email);
  }
  return { valid, invalid };
}

export type Person = {
  userId: string;
  email: string;
  name: string;
  role: 'owner' | 'member';
  joinedAt: string;
};

export function personFromApi(raw: Record<string, unknown>): Person {
  const email = String(raw.email || '');
  const stored = String(raw.display_name || '').trim();
  return {
    userId: String(raw.user_id || ''),
    email,
    name: stored || email.split('@')[0] || 'Member',
    role: String(raw.role || '').toLowerCase() === 'owner' ? 'owner' : 'member',
    joinedAt: String(raw.created_at || ''),
  };
}

/**
 * One row per person. Members are keyed by user id, and the API can hold two membership rows
 * for one email (two user records for the same address), so rows also merge on the lower-cased
 * email. The first row wins, except that your own row is kept over a twin, and a merged person
 * is an owner when any of their rows is.
 */
export function dedupeMembers(people: Person[], selfId = ''): Person[] {
  const out: Person[] = [];
  const byKey = new Map<string, number>();
  for (const person of people) {
    const idKey = person.userId ? `id:${person.userId}` : '';
    const emailKey = person.email.trim() ? `email:${person.email.trim().toLowerCase()}` : '';
    const keys = [idKey, emailKey].filter(Boolean);
    const at = keys.map(key => byKey.get(key)).find(index => index !== undefined);
    if (at === undefined) {
      keys.forEach(key => byKey.set(key, out.length));
      out.push(person);
      continue;
    }
    const kept = out[at];
    const base = selfId && person.userId === selfId && kept.userId !== selfId ? person : kept;
    out[at] = {
      ...base,
      name: base.name || kept.name || person.name,
      role: kept.role === 'owner' || person.role === 'owner' ? 'owner' : 'member',
      joinedAt: [kept.joinedAt, person.joinedAt].filter(Boolean).sort()[0] || '',
    };
    keys.forEach(key => byKey.set(key, at));
  }
  return out;
}

export function roleLabel(role: string): string {
  return role === 'owner' ? 'Owner' : 'Member';
}

/** FastAPI errors come back as {"detail": "..."}; flowJson puts the raw body in the message. */
export function errorText(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : '';
  if (!message) return fallback;
  try {
    const body = JSON.parse(message) as { detail?: unknown };
    if (typeof body.detail === 'string' && body.detail) return body.detail;
    if (Array.isArray(body.detail)) return fallback;
  } catch {
    // Not JSON: use the text when it is short enough to read.
  }
  return message.length < 200 ? message : fallback;
}
