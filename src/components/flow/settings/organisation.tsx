'use client';

import { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { flowJson } from '@/lib/flow-api';
import {
  inviteEmailLabel,
  mapApiInvitation,
  type OrganizationInvitation,
} from '@/lib/organization-invitations';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Skeleton,
} from '@/components/ui/rest';
import { ChoiceSelect } from '@/components/ui/select';
import { PersonMark, SettingsError } from './parts';
import {
  errorText,
  formatDay,
  parseInviteEmails,
  personFromApi,
  planLabel,
  relativeDay,
  roleLabel,
  type MePage,
  type Person,
} from './settings-data';
import { useLoad } from './use-load';

const ROLES = [
  { value: 'member', label: 'Member' },
  { value: 'owner', label: 'Owner' },
];

type OrgRecord = { id?: string; name?: string };

async function loadOrganisation(orgId: string) {
  const [me, org, members, invitations] = await Promise.all([
    flowJson<MePage & { user?: { id?: string } }>('/api/me'),
    flowJson<{ organization?: OrgRecord }>(`/api/organizations/${orgId}`).then(
      page => page.organization || {}
    ),
    flowJson<{ members?: Record<string, unknown>[] }>(`/api/organizations/${orgId}/members`).then(
      page => (page.members || []).map(personFromApi)
    ),
    flowJson<{ invitations?: Record<string, unknown>[] }>(`/api/organizations/${orgId}/invitations`)
      .then(page => (page.invitations || []).map(mapApiInvitation))
      .catch(() => [] as OrganizationInvitation[]),
  ]);
  return { me, org, members, invitations };
}

export function pendingInvitations(
  invitations: OrganizationInvitation[],
  members: Person[],
  now: Date = new Date()
): OrganizationInvitation[] {
  const emails = new Set(members.map(member => member.email.toLowerCase()));
  return invitations.filter(
    invite =>
      invite.status === 'PENDING' &&
      Date.parse(invite.expiresAt) > now.getTime() &&
      !emails.has(invite.email.toLowerCase())
  );
}

/** 7e. The organisation card, invites and the member list in one place. */
export function SettingsOrganisation({ orgId }: { orgId: string }) {
  const { state, retry, reload, setData } = useLoad(() => loadOrganisation(orgId), [orgId]);
  const [emails, setEmails] = useState('');
  const [role, setRole] = useState('member');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [name, setName] = useState('');

  if (state.phase === 'loading') {
    return (
      <div className="st-stack st-wide" aria-busy="true">
        <div className="st-card st-org-card">
          <Skeleton className="size-11 rounded-md" />
          <Skeleton className="h-10 w-48" />
        </div>
        <Skeleton className="h-9 w-full" />
        <div className="st-card st-skeleton">
          {[0, 1, 2].map(i => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    );
  }
  if (state.phase === 'error') return <SettingsError message={state.error} onRetry={retry} />;

  const { me, org, members, invitations } = state.data;
  const isOwner = me.active_organization?.role === 'owner';
  const selfId = me.user?.id || '';
  const pending = pendingInvitations(invitations, members);
  const orgName = org.name || me.active_organization?.name || 'Organisation';
  const people = members.length + pending.length;

  const run = async (key: string, work: () => Promise<string | void>) => {
    setBusy(key);
    setMessage(null);
    try {
      const text = await work();
      if (text) setMessage({ text });
      await reload();
    } catch (err) {
      setMessage({ text: errorText(err, 'That did not go through.'), error: true });
    } finally {
      setBusy('');
    }
  };

  const sendInvites = () => {
    const { valid, invalid } = parseInviteEmails(emails);
    if (invalid.length) {
      setMessage({
        text: `Check ${invalid.join(', ')}. That isn’t an email address.`,
        error: true,
      });
      return;
    }
    if (!valid.length) return;
    void run('invite', async () => {
      const sent: OrganizationInvitation[] = [];
      for (const email of valid) {
        const page = await flowJson<{ invitation?: Record<string, unknown> }>(
          `/api/organizations/${orgId}/invitations`,
          { method: 'POST', body: JSON.stringify({ email, role }) }
        );
        if (page.invitation) sent.push(mapApiInvitation(page.invitation));
      }
      setEmails('');
      const unsent = sent.filter(invite => invite.emailStatus !== 'sent');
      return unsent.length
        ? `Invites saved. ${unsent.map(i => `${i.email}: ${inviteEmailLabel(i).toLowerCase()}`).join('; ')}. They join when they sign in with that email.`
        : `Invite${sent.length === 1 ? '' : 's'} sent. People join when they sign in with that email.`;
    });
  };

  const rename = () =>
    run('rename', async () => {
      const page = await flowJson<{ organization?: OrgRecord }>(`/api/organizations/${orgId}`, {
        method: 'PUT',
        body: JSON.stringify({ name: name.trim() }),
      });
      setData(d => ({ ...d, org: page.organization || { ...d.org, name: name.trim() } }));
      setRenameOpen(false);
    });

  return (
    <div className="st-stack st-wide">
      <section className="st-card st-org-card">
        <span className="st-org-logo" aria-hidden="true">
          {orgName.trim()[0]?.toUpperCase() || 'O'}
        </span>
        <div className="st-org-text">
          <p className="st-section-title">{orgName}</p>
          <p className="st-row-sub">
            {people} {people === 1 ? 'person' : 'people'} · {planLabel(me.entitlements?.plan_code)}
          </p>
        </div>
        {isOwner ? (
          <Button
            className="st-btn"
            type="button"
            onClick={() => {
              setName(orgName);
              setRenameOpen(true);
            }}
          >
            Edit details
          </Button>
        ) : null}
      </section>

      {isOwner ? (
        <div className="st-invite">
          <Input
            aria-label="Invite by email"
            placeholder="Invite by email, separate several with commas"
            value={emails}
            onChange={event => setEmails(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') sendInvites();
            }}
          />
          <ChoiceSelect
            className="st-select"
            aria-label="Role for new people"
            value={role}
            options={ROLES}
            onValueChange={setRole}
          />
          <Button
            className="st-btn primary"
            type="button"
            disabled={!emails.trim() || Boolean(busy)}
            onClick={sendInvites}
          >
            {busy === 'invite' ? 'Sending…' : 'Send invites'}
          </Button>
        </div>
      ) : null}
      {message ? (
        <p className={message.error ? 'flow-error' : 'st-note'} role="status">
          {message.text}
        </p>
      ) : null}

      <section className="st-card st-members">
        <div className="st-member-row st-member-head">
          <span>Member</span>
          <span>Role</span>
          <span>Joined</span>
          <span />
        </div>
        {members.map(member => {
          const self = member.userId === selfId;
          return (
            <div key={member.userId} className="st-member-row">
              <div className="st-person">
                <PersonMark label={member.name || member.email} />
                <div>
                  <p className="st-person-name">
                    {member.name}
                    {self ? <span className="st-muted"> (you)</span> : null}
                  </p>
                  <p className="st-row-sub">{member.email}</p>
                </div>
              </div>
              <div>
                {isOwner && !self ? (
                  <ChoiceSelect
                    className="st-role-select"
                    aria-label={`Role for ${member.email}`}
                    value={member.role}
                    options={ROLES}
                    disabled={Boolean(busy)}
                    onValueChange={next =>
                      void run(`role-${member.userId}`, async () => {
                        await flowJson(
                          `/api/organizations/${orgId}/members/${member.userId}/role`,
                          { method: 'PUT', body: JSON.stringify({ role: next }) }
                        );
                      })
                    }
                  />
                ) : (
                  <span>{roleLabel(member.role)}</span>
                )}
              </div>
              <span className="st-muted">{formatDay(member.joinedAt)}</span>
              <div className="st-row-menu">
                {isOwner && !self ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        className="st-icon-btn"
                        type="button"
                        aria-label={`More for ${member.email}`}
                      >
                        <MoreHorizontal size={16} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onSelect={() =>
                          void run(`remove-${member.userId}`, async () => {
                            await flowJson(`/api/organizations/${orgId}/members/${member.userId}`, {
                              method: 'DELETE',
                            });
                            return `${member.email} was removed.`;
                          })
                        }
                      >
                        Remove from organisation
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </div>
            </div>
          );
        })}
        {pending.map(invite => (
          <div key={invite.id || invite.token} className="st-member-row">
            <div className="st-person">
              <PersonMark label={invite.email} pending />
              <div>
                <p className="st-person-name st-regular">{invite.email}</p>
                <p className="st-row-sub">
                  Invited {relativeDay(invite.createdAt).toLowerCase()} ·{' '}
                  {inviteEmailLabel(invite).toLowerCase()}
                </p>
              </div>
            </div>
            <span>{roleLabel(invite.role === 'ADMIN' ? 'owner' : 'member')}</span>
            {isOwner ? (
              <Button
                className="st-link accent"
                type="button"
                disabled={Boolean(busy)}
                onClick={() =>
                  void run(`resend-${invite.token}`, async () => {
                    await flowJson(
                      `/api/organizations/${orgId}/invitations/${invite.token}/resend`,
                      { method: 'POST' }
                    );
                    return `Invite sent again to ${invite.email}.`;
                  })
                }
              >
                {busy === `resend-${invite.token}` ? 'Sending…' : 'Resend'}
              </Button>
            ) : (
              <span className="st-muted">Pending</span>
            )}
            <div className="st-row-menu">
              {isOwner ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      className="st-icon-btn"
                      type="button"
                      aria-label={`More for ${invite.email}`}
                    >
                      <MoreHorizontal size={16} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onSelect={() =>
                        void run(`cancel-${invite.token}`, async () => {
                          await flowJson(`/api/invitations/${invite.token}`, { method: 'DELETE' });
                          return `The invite to ${invite.email} was cancelled.`;
                        })
                      }
                    >
                      Cancel invite
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
          </div>
        ))}
      </section>
      <div className="st-foot-note">
        <span>
          Owners manage billing, members and invites. Members run analyses and share projects.
        </span>
        <span>
          {people} {people === 1 ? 'person' : 'people'}
        </span>
      </div>

      <Dialog open={renameOpen} onOpenChange={next => (busy ? null : setRenameOpen(next))}>
        <DialogContent className="st-dialog">
          <DialogHeader>
            <DialogTitle>Organisation name</DialogTitle>
            <DialogDescription>Everyone in the organisation sees this name.</DialogDescription>
          </DialogHeader>
          <Input
            aria-label="Organisation name"
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <DialogFooter className="st-dialog-foot">
            <Button className="st-btn" type="button" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button
              className="st-btn primary"
              type="button"
              disabled={name.trim().length < 2 || Boolean(busy)}
              onClick={() => void rename()}
            >
              {busy === 'rename' ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
