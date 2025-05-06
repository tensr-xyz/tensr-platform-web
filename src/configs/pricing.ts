import { IconType } from 'react-icons/lib';
import {
  LuBeaker,
  LuBrainCircuit,
  LuChartBar,
  LuDatabase,
  LuFileSpreadsheet,
  LuGitBranch,
  LuNetwork,
  LuShare2,
  LuShieldCheck,
  LuCircleUser,
  LuUsers,
  LuHeadphones,
  LuSettings,
  LuBuilding,
} from 'react-icons/lu';

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
  icon: IconType;
  text: string;
}

export type TierFeaturesMap = Record<Uppercase<TierType>, CardFeature[]>;

export const TIER_FEATURES: TierFeaturesMap = {
  EDUCATION: [
    { icon: LuChartBar, text: 'Complete statistical analysis suite' },
    { icon: LuFileSpreadsheet, text: 'Data preparation and cleaning tools' },
    { icon: LuBeaker, text: 'Basic research methods package' },
    { icon: LuDatabase, text: 'Local data storage' },
    { icon: LuGitBranch, text: 'Basic visualizations' },
    { icon: LuCircleUser, text: 'Single user license' },
    { icon: LuShieldCheck, text: 'Community support' },
  ],
  PRO: [
    { icon: LuBrainCircuit, text: 'Advanced statistical methods' },
    { icon: LuChartBar, text: 'Enhanced visualization capabilities' },
    { icon: LuFileSpreadsheet, text: 'Advanced data transformation' },
    { icon: LuNetwork, text: 'API integrations' },
    { icon: LuHeadphones, text: 'Priority support' },
    { icon: LuSettings, text: 'Customizable workspace' },
  ],
  TEAM: [
    { icon: LuUsers, text: 'Team collaboration (up to 5 users)' },
    { icon: LuShare2, text: 'Shared workspaces' },
    { icon: LuGitBranch, text: 'Version control' },
    { icon: LuNetwork, text: 'Real-time collaboration' },
    { icon: LuHeadphones, text: 'Dedicated support' },
    { icon: LuSettings, text: 'Team administration tools' },
  ],
  ENTERPRISE: [
    { icon: LuBuilding, text: 'Unlimited team size' },
    { icon: LuShieldCheck, text: 'Enhanced security features' },
    { icon: LuNetwork, text: 'Custom API integrations' },
    { icon: LuSettings, text: 'Custom deployment options' },
    { icon: LuHeadphones, text: 'Dedicated account manager' },
    { icon: LuUsers, text: 'Advanced user management' },
  ],
} as const;

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
