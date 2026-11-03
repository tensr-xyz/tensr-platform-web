'use client';

import Link from 'next/link';
import { useOrganizationContext } from '@/contexts/organisation-context';
import { SettingsBilling } from '@/components/flow/settings/billing';
import { SettingsGeneral } from '@/components/flow/settings/general';
import { SettingsOrganisation } from '@/components/flow/settings/organisation';
import { SettingsTeams } from '@/components/flow/settings/teams';
import { SettingsUsage } from '@/components/flow/settings/usage';
import { workspaceHeading } from '@/components/flow/settings/settings-data';
import '@/components/flow/settings/settings.css';

const SECTIONS = {
  general: 'General',
  billing: 'Billing',
  usage: 'Usage',
  organisation: 'Organisation',
  teams: 'Teams',
} as const;

export type SettingsSection = keyof typeof SECTIONS;

const ALIASES: Record<string, SettingsSection> = { members: 'organisation' };

export function settingsSection(value?: string): SettingsSection {
  if (value && value in ALIASES) return ALIASES[value];
  return value && value in SECTIONS ? (value as SettingsSection) : 'general';
}

/** Settings 7a–7f: workspace line, title, underline tabs, then the section. */
export function SettingsScreen({ section }: { section?: string }) {
  const current = settingsSection(section);
  const { activeOrganization, isPersonalAccount, userOrganizations } = useOrganizationContext();
  const orgId = !isPersonalAccount && activeOrganization ? activeOrganization.id : '';
  const inTeam = userOrganizations.some(org => !org.isPersonal);
  const shown = (Object.keys(SECTIONS) as SettingsSection[]).filter(key =>
    key === 'organisation' ? Boolean(orgId) : key === 'teams' ? inTeam : true
  );
  const workspace = orgId
    ? activeOrganization?.name
    : userOrganizations.find(org => org.isPersonal)?.name || 'Personal workspace';

  let body;
  if (current === 'billing') body = <SettingsBilling />;
  else if (current === 'usage') body = <SettingsUsage />;
  else if (current === 'organisation')
    body = orgId ? (
      <SettingsOrganisation orgId={orgId} />
    ) : (
      <p className="st-note">
        You are in your personal workspace. Switch to an organisation from the sidebar to manage its
        members.
      </p>
    );
  else if (current === 'teams') body = <SettingsTeams />;
  else body = <SettingsGeneral />;

  return (
    <div className="st-page">
      <header className="st-head">
        <p className="st-workspace">{workspaceHeading(workspace)}</p>
        <h1 className="st-title">Settings</h1>
      </header>
      <nav className="st-tabs" aria-label="Settings">
        {shown.map(key => (
          <Link
            key={key}
            href={`/flow/settings/${key}`}
            data-active={key === current || undefined}
            aria-current={key === current ? 'page' : undefined}
          >
            {SECTIONS[key]}
          </Link>
        ))}
      </nav>
      <div className="st-body">{body}</div>
    </div>
  );
}
