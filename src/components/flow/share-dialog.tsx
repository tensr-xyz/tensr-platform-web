'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChoiceSelect } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="share-dialog">
        <DialogHeader>
          <DialogTitle>Share {projectName}</DialogTitle>
          <DialogDescription>
            Project, with its sources, tables, outputs and report.
          </DialogDescription>
        </DialogHeader>
        <div className="share-invite">
          <Input
            aria-label="Email"
            value={email}
            placeholder="Add people by email"
            onChange={event => setEmail(event.target.value)}
          />
          <ChoiceSelect
            aria-label="Role"
            value={role}
            onValueChange={setRole}
            options={[
              { value: 'viewer', label: 'Viewer' },
              { value: 'editor', label: 'Editor' },
            ]}
          />
          <Button className="flow-btn primary" type="button" onClick={invite}>
            Invite
          </Button>
        </div>
        <p className="flow-muted">
          Viewer reads tables, outputs and rows. Editor runs analyses and edits.
        </p>
        {people === null ? <Skeleton className="h-16" /> : null}
        {(people || []).map(person => (
          <div key={person.user_id} className="share-person">
            <span>{person.name}</span>
            <span className="flow-muted">{person.email}</span>
            <span>{person.role}</span>
          </div>
        ))}
        {invites.map(inviteRow => (
          <div key={inviteRow.token || inviteRow.email} className="share-person">
            <span>{inviteRow.email}</span>
            <span className="flow-muted">Pending</span>
            {inviteRow.token ? (
              <Button
                className="flow-btn"
                type="button"
                onClick={() => {
                  if (!orgId || !inviteRow.token) return;
                  void flowJson(
                    `/api/organizations/${orgId}/invitations/${inviteRow.token}/resend`,
                    {
                      method: 'POST',
                    }
                  )
                    .then(() => setNote('Invitation resent.'))
                    .catch(() => setError('Could not resend.'));
                }}
              >
                Resend
              </Button>
            ) : null}
          </div>
        ))}
        <div className="share-invite">
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
        <p className="flow-muted">
          The link opens this project for people who already have access.
        </p>
        {error ? <p className="flow-error">{error}</p> : null}
        {note ? <p className="flow-muted">{note}</p> : null}
        <DialogFooter>
          <Button className="flow-btn" type="button" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
