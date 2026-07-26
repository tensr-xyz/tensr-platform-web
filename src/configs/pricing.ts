import { type LucideIcon, BrainCircuit, BarChart3 as ChartBar, Users } from 'lucide-react';

export interface CardFeature {
  icon: LucideIcon;
  text: string;
}

/** Paid tiers available at checkout — matches tensr-api PLANS (pro, pro_plus, teams). */
export type SubscriptionTier = 'pro' | 'pro_plus' | 'team';

export const SUBSCRIPTION_TIERS: SubscriptionTier[] = ['pro', 'pro_plus', 'team'];

export const DEFAULT_TEAM_SEATS = 3;
export const MIN_TEAM_SEATS = 1;
export const MAX_TEAM_SEATS = 500;

export const SUBSCRIPTION_TIER_LABELS: Record<SubscriptionTier, string> = {
  pro: 'Pro',
  pro_plus: 'Pro Plus',
  team: 'Teams',
};

export const ANNUAL_MONTHLY_DISCOUNT = 0.8;

export const DEFAULT_SUBSCRIPTION_PRICING: Record<
  SubscriptionTier,
  { monthly: number; annual: number; description: string }
> = {
  pro: {
    monthly: 20,
    annual: 16,
    description: 'For individual analysts running real tests on real data.',
  },
  pro_plus: {
    monthly: 60,
    annual: 48,
    description: 'For power users who live in the agent and ship more analyses.',
  },
  team: {
    monthly: 40,
    annual: 32,
    description: 'For research groups and analytics teams working in one place.',
  },
};

/** Landing-aligned marketing copy for checkout cards (prices come from DEFAULT_SUBSCRIPTION_PRICING / API). */
export type SubscriptionPlanCardMeta = {
  tier: SubscriptionTier;
  name: string;
  subtitle: string;
  note: string;
  featured: boolean;
  perSeat: boolean;
  cta: string;
  features: string[];
};

export const SUBSCRIPTION_PLAN_CARDS: SubscriptionPlanCardMeta[] = [
  {
    tier: 'pro',
    name: 'Pro',
    subtitle: 'For individual analysts running real tests on real data.',
    note: 'Per user · cancel any time',
    featured: false,
    perSeat: false,
    cta: 'Get Pro',
    features: [
      'Full tri‑modal workspace',
      'Sheet, charts & notebook',
      'All 80+ statistical tests + report view',
      'Tensr Agent — 1,200 runs / month',
      '300 AI reports / month',
      'APA, PDF, CSV & Markdown export',
    ],
  },
  {
    tier: 'pro_plus',
    name: 'Pro Plus',
    subtitle: 'For power users who live in the agent and ship more analyses.',
    note: 'Per user · cancel any time',
    featured: true,
    perSeat: false,
    cta: 'Get Pro+',
    features: [
      'Everything in Pro, plus',
      'Tensr Agent — 5,000 runs / month',
      '1,200 AI reports / month',
      'Higher assistant cost budget',
      'Priority support',
      'Early access to new analysis tools',
    ],
  },
  {
    tier: 'team',
    name: 'Teams',
    subtitle: 'For research groups and analytics teams working in one place.',
    note: 'Per seat · billed to your organisation',
    featured: false,
    perSeat: true,
    cta: 'Get Teams',
    features: [
      'Everything in Pro Plus, plus',
      'Organisation billing & shared seats',
      'Real‑time collaboration & presence',
      'Tensr Agent — 10,000 runs / month',
      '3,000 AI reports / month',
      'Shared workspaces & plugin library',
    ],
  },
];

/** `annual` prices are monthly equivalents (20% off), not lump-sum yearly totals. */
export function monthlyEquivalentRate(monthly: number): number {
  return Math.round(monthly * ANNUAL_MONTHLY_DISCOUNT * 100) / 100;
}

export function unitPriceForBilling(
  pricing: { monthly: number; annual: number },
  billingType: 'monthly' | 'annual'
): number {
  return billingType === 'annual' ? pricing.annual : pricing.monthly;
}

export function formatBillingCadence(
  billingType: 'monthly' | 'annual',
  tier?: SubscriptionTier
): string {
  if (billingType === 'annual') {
    return tier === 'team' ? 'per seat / mo, billed annually' : '/mo, billed annually';
  }
  return tier === 'team' ? 'per seat / month' : '/month';
}

export const SUBSCRIPTION_TIER_FEATURES: Record<'PRO' | 'PRO_PLUS' | 'TEAM', CardFeature[]> = {
  PRO: SUBSCRIPTION_PLAN_CARDS[0].features.map(text => ({ icon: ChartBar, text })),
  PRO_PLUS: SUBSCRIPTION_PLAN_CARDS[1].features.map(text => ({ icon: BrainCircuit, text })),
  TEAM: SUBSCRIPTION_PLAN_CARDS[2].features.map(text => ({ icon: Users, text })),
};
