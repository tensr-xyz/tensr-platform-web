'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/rest';
import { useOrganizationContext } from '@/contexts/organisation-context';

const loading = () => (
  <div className="settings-loading" aria-busy="true">
    <Skeleton className="h-8 w-48" />
    <Skeleton className="h-40 w-full" />
    <Skeleton className="h-24 w-full" />
  </div>
);

const SECTIONS = {
  general: {
    title: 'Account',
    lede: 'Your name, email and sign-in.',
    view: dynamic(() => import('@/components/templates/settings/general'), { loading }),
  },
  billing: {
    title: 'Workspace and billing',
    lede: 'Your plan, invoices and payment method.',
    view: dynamic(() => import('@/components/templates/settings/billing'), { loading }),
  },
  usage: {
    title: 'Usage',
    lede: 'Runs, tables and reports this period.',
    view: dynamic(() => import('@/components/templates/settings/usage'), { loading }),
  },
  organisation: {
    title: 'Organisation',
    lede: 'The workspace name and who owns it.',
    view: dynamic(() => import('@/components/templates/settings/organisation'), { loading }),
  },
  members: {
    title: 'Members',
    lede: 'Invite people and set what they can do.',
    view: dynamic(() => import('@/components/templates/settings/members'), { loading }),
  },
} as const;

export type SettingsSection = keyof typeof SECTIONS;

export function settingsSection(value?: string): SettingsSection {
  return value && value in SECTIONS ? (value as SettingsSection) : 'general';
}

export function SettingsScreen({ section }: { section?: string }) {
  const current = settingsSection(section);
  const { activeOrganization, isPersonalAccount } = useOrganizationContext();
  const hasOrg = Boolean(activeOrganization) && !isPersonalAccount;
  const shown = (Object.keys(SECTIONS) as SettingsSection[]).filter(
    key => hasOrg || (key !== 'organisation' && key !== 'members')
  );
  const View = SECTIONS[current].view;
  return (
    <div className="settings-page">
      <nav className="settings-nav" aria-label="Settings">
        <p className="settings-nav-label">Settings</p>
        {shown.map(key => (
          <Link key={key} href={`/flow/settings/${key}`} data-active={key === current}>
            {SECTIONS[key].title}
          </Link>
        ))}
      </nav>
      <section className="settings-body">
        <header className="settings-head">
          <h1 className="flow-page-title">{SECTIONS[current].title}</h1>
          <p className="flow-muted">{SECTIONS[current].lede}</p>
        </header>
        <div className="settings-content">
          <View />
        </div>
      </section>
    </div>
  );
}
