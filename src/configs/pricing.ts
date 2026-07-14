import { type LucideIcon } from 'lucide-react';
import {
  Beaker,
  BrainCircuit,
  BarChart3 as ChartBar,
  Database,
  FileSpreadsheet,
  GitBranch,
  Network,
  Share2,
  ShieldCheck,
  CircleUser,
  Users,
  Headphones,
  Settings,
  Building,
} from 'lucide-react';

export type TierType = 'education' | 'pro' | 'team' | 'enterprise';

export interface TableFeature {
  name: string;
  description?: string;
  education: string | boolean;
  pro: string | boolean;
  team: string | boolean;
  enterprise: string | boolean;
}

export interface CardFeature {
  icon: LucideIcon;
  text: string;
}

export type TierFeaturesMap = Record<Uppercase<TierType>, CardFeature[]>;

export const TIER_FEATURES: TierFeaturesMap = {
  EDUCATION: [
    { icon: ChartBar, text: 'Complete statistical analysis suite' },
    { icon: FileSpreadsheet, text: 'Data preparation and cleaning tools' },
    { icon: Beaker, text: 'Basic research methods package' },
    { icon: Database, text: 'Local data storage' },
    { icon: GitBranch, text: 'Basic visualizations' },
    { icon: CircleUser, text: 'Single user license' },
    { icon: ShieldCheck, text: 'Community support' },
  ],
  PRO: [
    { icon: BrainCircuit, text: 'Advanced statistical methods' },
    { icon: ChartBar, text: 'Enhanced visualization capabilities' },
    { icon: FileSpreadsheet, text: 'Advanced data transformation' },
    { icon: Network, text: 'API integrations' },
    { icon: Headphones, text: 'Priority support' },
    { icon: Settings, text: 'Customizable workspace' },
  ],
  TEAM: [
    { icon: Users, text: 'Team collaboration (up to 5 users)' },
    { icon: Share2, text: 'Shared workspaces' },
    { icon: GitBranch, text: 'Version control' },
    { icon: Network, text: 'Real-time collaboration' },
    { icon: Headphones, text: 'Dedicated support' },
    { icon: Settings, text: 'Team administration tools' },
  ],
  ENTERPRISE: [
    { icon: Building, text: 'Unlimited team size' },
    { icon: ShieldCheck, text: 'Enhanced security features' },
    { icon: Network, text: 'Custom API integrations' },
    { icon: Settings, text: 'Custom deployment options' },
    { icon: Headphones, text: 'Dedicated account manager' },
    { icon: Users, text: 'Advanced user management' },
  ],
} as const;

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

export const FEATURES: TableFeature[] = [
  {
    name: 'Statistical Analysis',
    description: 'Core statistical analysis capabilities',
    education: true,
    pro: true,
    team: true,
    enterprise: true,
  },
  {
    name: 'Structural Equation Modelling',
    description: 'Test complex hypotheses and analyze relationships between variables',
    education: true,
    pro: true,
    team: true,
    enterprise: true,
  },
  {
    name: 'Plugins',
    description: 'Add custom tools and integrate with external services',
    education: true,
    pro: true,
    team: true,
    enterprise: true,
  },
  {
    name: 'Notebooks',
    description: 'Create interactive documents with code, visuals, and text',
    education: true,
    pro: true,
    team: true,
    enterprise: true,
  },
  {
    name: 'Data Visualization',
    description: 'Create charts and graphs',
    education: 'Basic',
    pro: 'Advanced',
    team: 'Advanced',
    enterprise: 'Advanced + Custom',
  },
  {
    name: 'Collaboration Features',
    description: 'Work together on analyses',
    education: '—',
    pro: '—',
    team: 'Up to 5 users',
    enterprise: 'Unlimited',
  },
  {
    name: 'Support Level',
    description: 'Available support options',
    education: 'Community',
    pro: 'Priority',
    team: 'Dedicated',
    enterprise: 'Account Manager',
  },
  {
    name: 'Custom Scripting',
    description: 'Create and save custom analyses',
    education: 'Basic',
    pro: 'Advanced',
    team: 'Advanced',
    enterprise: 'Advanced + Custom',
  },
  {
    name: 'API Access',
    description: 'Connect with external data sources',
    education: '—',
    pro: 'Standard',
    team: 'Advanced',
    enterprise: 'Custom',
  },
  {
    name: 'Version Control',
    description: 'Track changes in analyses',
    education: '—',
    pro: 'Basic',
    team: 'Advanced',
    enterprise: 'Enterprise',
  },
];

export const FAQ_ITEMS = [
  {
    question: 'Who qualifies for the Education plan?',
    answer:
      'The Education plan is available free of charge to anyone with a valid university email address.',
  },
  {
    question: "What's included in the base statistical package?",
    answer:
      'The base package includes all standard analysis functionality including descriptive statistics, regression analysis, factor analysis, and basic visualization tools.',
  },
  {
    question: 'How does the Team plan work?',
    answer:
      'The Team plan supports up to 5 users with full collaboration features, shared workspaces, and version control. Perfect for small research teams or departments.',
  },
  {
    question: 'Do I get access to new features automatically?',
    answer:
      "Yes! Paid plans (Pro, Team, and Enterprise) automatically get access to new features as they're released.",
  },
  {
    question: 'Can I upgrade from Education to a paid plan?',
    answer:
      'Yes, you can upgrade from an Education plan to any paid plan at any time while keeping all your existing analyses and data.',
  },
  {
    question: 'Is there a limit on dataset size?',
    answer:
      "No, there are no artificial limits on dataset size. Performance will depend on your computer's specifications as this is a desktop application.",
  },
  {
    question: 'What happens to my analyses if I downgrade?',
    answer:
      "You'll maintain access to all your existing analyses, but features specific to higher tiers will become unavailable.",
  },
  {
    question: 'Do you offer training and onboarding?',
    answer:
      'Yes, we offer basic training resources for all users, with additional custom training options for Team and Enterprise plans.',
  },
];
