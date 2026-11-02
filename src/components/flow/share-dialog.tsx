'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChoiceSelect } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/rest';
import { flowJson } from '@/lib/flow-api';

type Person = { user_id: string; role: string; email: string; name: string };
type Invite = { email?: string; status?: string; token?: string; created_at?: string };

export function ShareDialog({
  projectId,
  projectName,
  onClose,
}: {
  projectId: string;
  projectName: string;
  onClose: () => void;
}) {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [orgId, setOrgId] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('viewer');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const link =
    typeof window === 'undefined' ? '' : `${window.location.origin}/flow/p/${projectId}/report`;

  const load = () => {
    void flowJson<{ active_organization?: { id?: string } }>('/me')
      .then(async me => {
        const orgId = me.active_organization?.id || '';
        setOrgId(orgId);
        const [members, workspace, pending] = await Promise.all([
          flowJson<{ members?: { user_id?: string; role?: string }[] }>(
            `/api/projects/${projectId}/members`
          ),
          orgId
            ? flowJson<{ members?: { user_id?: string; email?: string; display_name?: string }[] }>(
                `/api/organizations/${orgId}/members`
              ).catch(() => ({ members: [] }))
            : Promise.resolve({ members: [] }),
          orgId
            ? flowJson<{ invitations?: Invite[] }>(`/api/organizations/${orgId}/invitations`).catch(
                () => ({
                  invitations: [],
                })
              )
            : Promise.resolve({ invitations: [] }),
        ]);
        const byId = new Map(
          (workspace.members || []).map(person => [person.user_id || '', person])
        );
        setPeople(
          (members.members || [])
            .filter(member => member.user_id)
            .map(member => {
              const person = byId.get(member.user_id || '');
              return {
                user_id: member.user_id || '',
                role: member.role || 'viewer',
                email: person?.email || '',
                name: person?.display_name || person?.email || member.user_id || '',
              };
            })
        );
        setInvites(
          (pending.invitations || []).filter(
            invite => invite.status === 'pending' || !invite.status
          )
        );
      })
      .catch(err => {
        setPeople([]);
        setError(err instanceof Error ? err.message : 'Could not load people');
      });
  };

  useEffect(() => {
    load();
  }, [projectId]);

  const invite = () => {
    const address = email.trim();
    if (!address) return;
    setError('');
    void flowJson<{ active_organization?: { id?: string }; user_id?: string }>('/me')
      .then(async me => {
        const orgId = me.active_organization?.id || '';
        if (!orgId) {
          setError('This account has no workspace.');
          return;
        }
        const workspace = await flowJson<{ members?: { user_id?: string; email?: string }[] }>(
          `/api/organizations/${orgId}/members`
        ).catch(() => ({ members: [] }));
        const existing = (workspace.members || []).find(
          person => (person.email || '').toLowerCase() === address.toLowerCase()
        );
        if (existing?.user_id) {
          await flowJson(`/api/projects/${projectId}/members`, {
            method: 'POST',
            body: JSON.stringify({ user_id: existing.user_id, role }),
          });
          setEmail('');
          setNote('Added to the project.');
          load();
          return;
        }
        await flowJson(`/api/organizations/${orgId}/invitations`, {
          method: 'POST',
          body: JSON.stringify({ email: address, role: 'member' }),
        });
        setEmail('');
        setNote('Invitation sent.');
        load();
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Could not invite'));
  };

  const mark = (value?: string) => {
    const text = (value || '?').split('@')[0];
    const parts = text.split(/[^A-Za-z0-9]+/).filter(Boolean);
    return ((parts[0]?.[0] || '') + (parts[1]?.[0] || parts[0]?.[1] || '')).toUpperCase() || '?';
  };
  const roleName = (value?: string) =>
    value ? value[0].toUpperCase() + value.slice(1).toLowerCase() : 'Viewer';
  const count = (people || []).length + invites.length;

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="share-dialog">
        <DialogHeader className="share-head">
          <DialogTitle>Share {projectName}</DialogTitle>
          <DialogDescription>
            Project, with its sources, tables, outputs and report.
          </DialogDescription>
        </DialogHeader>
        <div className="share-body">
          <div className="share-invite">
            <div className="share-field">
              <Input
                aria-label="Email"
                value={email}
                placeholder="Add people by email"
                onChange={event => setEmail(event.target.value)}
              />
              <ChoiceSelect
                className="share-role"
                aria-label="Role"
                value={role}
                onValueChange={setRole}
                options={[
                  { value: 'viewer', label: 'Viewer' },
                  { value: 'editor', label: 'Editor' },
                ]}
              />
            </div>
            <Button className="flow-btn primary" type="button" onClick={invite}>
              Invite
            </Button>
          </div>
          <p className="share-roles">
            <span>Viewer · reads tables, outputs and rows</span>
            <span>Editor · runs analyses and edits</span>
          </p>
          <span className="share-label">People with access · {count}</span>
          {people === null ? <Skeleton className="h-16" /> : null}
          {(people || []).map(person => (
            <div key={person.user_id} className="share-person">
              <span className="share-mark">{mark(person.name || person.email)}</span>
              <span className="share-who">
                <strong>{person.name}</strong>
                <span>{person.email}</span>
              </span>
              <span className="share-person-role">{roleName(person.role)}</span>
            </div>
          ))}
          {invites.map(inviteRow => (
            <div key={inviteRow.token || inviteRow.email} className="share-person">
              <span className="share-mark pending">{mark(inviteRow.email)}</span>
              <span className="share-who">
                <strong>
                  {inviteRow.email} <span className="share-pending">Pending</span>
                </strong>
                <span>
                  Invited
                  {inviteRow.token ? (
                    <>
                      {' · '}
                      <Button
                        className="share-link-btn"
                        type="button"
                        onClick={() => {
                          if (!orgId || !inviteRow.token) return;
                          void flowJson(
                            `/api/organizations/${orgId}/invitations/${inviteRow.token}/resend`,
                            { method: 'POST' }
                          )
                            .then(() => setNote('Invitation resent.'))
                            .catch(() => setError('Could not resend.'));
                        }}
                      >
                        Resend
                      </Button>
                    </>
                  ) : null}
                </span>
              </span>
              <span className="share-person-role">Viewer</span>
            </div>
          ))}
        </div>
        <div className="share-section">
          <div className="share-anyone">
            <span className="share-icon">⛓</span>
            <span className="share-who">
              <strong>Anyone with the link</strong>
              <span>Opens the project for people who already have access</span>
            </span>
            <span className="share-soon">Public links soon</span>
          </div>
          <div className="share-copy">
            <Input readOnly aria-label="Project link" value={link} />
            <Button
              className="flow-btn"
              type="button"
              onClick={() =>
                void navigator.clipboard.writeText(link).then(() => setNote('Link copied.'))
              }
            >
              Copy link
            </Button>
          </div>
          <div className="share-one">
            <span className="share-radio" />
            <span className="share-who">
              <strong>Share one output only</strong>
              <span>Send one result on its own</span>
            </span>
            <span className="share-soon">Coming soon</span>
          </div>
        </div>
        <div className="share-foot">
          <span className="share-foot-note">
            {error ? (
              <span className="flow-error">{error}</span>
            ) : note ? (
              note
            ) : (
              <>
                ⓘ Shared people see the data behind every number.
                <br />
                Remove access any time.
              </>
            )}
          </span>
          <Button className="flow-btn" type="button" onClick={onClose}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
