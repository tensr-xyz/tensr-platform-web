'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ChoiceSelect } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton, Switch } from '@/components/ui/rest';
import { flowJson } from '@/lib/flow-api';
import { publicShareEmbedSnippet } from '@/lib/public-share';
import { outputKindLabel, outputRuns, type OutputRun } from '@/components/flow/report-output-runs';

type Person = { user_id: string; role: string; email: string; name: string };
type Invite = { email?: string; status?: string; token?: string; created_at?: string };
type Share = {
  id: string;
  token: string;
  kind: 'project_link' | 'output';
  role?: string;
  run_id?: string | null;
  title?: string | null;
  password_required?: boolean;
  viewer_controls?: { label?: string; column?: string }[] | null;
};

function shareUrl(token: string): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/s/${token}`;
}

function viewerFilterLabels(share: Share | undefined): string[] {
  const rows = share?.viewer_controls;
  if (!Array.isArray(rows)) return [];
  return rows.map(row => String(row?.label || row?.column || '').trim()).filter(Boolean);
}

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
  const [role, setRole] = useState('asker');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [shares, setShares] = useState<Share[]>([]);
  const [linkBusy, setLinkBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [outputs, setOutputs] = useState<OutputRun[] | null>(null);
  const [pickerError, setPickerError] = useState('');
  const [passwordDraft, setPasswordDraft] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [settingsShareId, setSettingsShareId] = useState<string | null>(null);

  const projectShare = shares.find(share => share.kind === 'project_link');
  const outputShare = shares.find(share => share.kind === 'output');
  const linkOn = Boolean(projectShare);
  const oneOutput = Boolean(outputShare);
  const link = projectShare ? shareUrl(projectShare.token) : '';
  const outputLink = outputShare ? shareUrl(outputShare.token) : '';
  const settingsShare =
    shares.find(share => share.id === settingsShareId) || projectShare || outputShare || null;
  const settingsLink = settingsShare ? shareUrl(settingsShare.token) : '';
  const embedSnippet = settingsShare
    ? publicShareEmbedSnippet(
        settingsShare.token,
        settingsShare.title || projectName || 'Published report'
      )
    : '';
  const filterLabels = viewerFilterLabels(settingsShare || undefined);

  const loadShares = () =>
    flowJson<{ shares?: Share[] }>(`/api/projects/${projectId}/shares`)
      .then(page => setShares(page.shares || []))
      .catch(() => setShares([]));

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
          loadShares(),
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

  const setProjectLink = (on: boolean) => {
    setError('');
    setLinkBusy(true);
    const work = on
      ? flowJson<{ share: Share }>(`/api/projects/${projectId}/shares`, {
          method: 'POST',
          body: JSON.stringify({ kind: 'project_link', role: 'viewer' }),
        }).then(async body => {
          await loadShares();
          const url = shareUrl(body.share.token);
          await navigator.clipboard.writeText(url).catch(() => undefined);
          setNote('Link copied.');
        })
      : flowJson(`/api/projects/${projectId}/shares/revoke-kind`, {
          method: 'POST',
          body: JSON.stringify({ kind: 'project_link' }),
        }).then(() => {
          setNote('Link sharing turned off.');
          return loadShares();
        });
    void work
      .catch(err => setError(err instanceof Error ? err.message : 'Could not update the link'))
      .finally(() => setLinkBusy(false));
  };

  const openPicker = () => {
    setPickerOpen(true);
    setPickerError('');
    setOutputs(null);
    void flowJson<{ runs?: unknown[] }>(`/api/projects/${projectId}/overview`)
      .then(page => setOutputs(outputRuns(page.runs || [])))
      .catch(err => {
        setOutputs([]);
        setPickerError(err instanceof Error ? err.message : 'Could not load outputs');
      });
  };

  const chooseOutput = (run: OutputRun) => {
    setError('');
    setPickerOpen(false);
    void flowJson<{ share: Share }>(`/api/projects/${projectId}/shares`, {
      method: 'POST',
      body: JSON.stringify({
        kind: 'output',
        run_id: run.id,
        title: run.title,
      }),
    })
      .then(async body => {
        await loadShares();
        const url = shareUrl(body.share.token);
        await navigator.clipboard.writeText(url).catch(() => undefined);
        setNote(`Link for “${run.title}” copied.`);
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Could not share that output'));
  };

  const clearOutputShare = () => {
    setError('');
    void flowJson(`/api/projects/${projectId}/shares/revoke-kind`, {
      method: 'POST',
      body: JSON.stringify({ kind: 'output', run_id: outputShare?.run_id || undefined }),
    })
      .then(() => {
        setNote('Output link removed.');
        return loadShares();
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Could not remove the link'));
  };

  const savePassword = (on: boolean) => {
    if (!settingsShare) return;
    setError('');
    setPasswordBusy(true);
    const password = on ? passwordDraft.trim() : null;
    if (on && !password) {
      setError('Enter a password before turning protection on.');
      setPasswordBusy(false);
      return;
    }
    void flowJson<{ share: Share }>(
      `/api/projects/${projectId}/shares/${settingsShare.id}/password`,
      {
        method: 'PATCH',
        body: JSON.stringify({ password }),
      }
    )
      .then(async () => {
        setPasswordDraft('');
        setNote(on ? 'Password saved. Viewers must enter it.' : 'Password removed.');
        await loadShares();
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Could not update the password'))
      .finally(() => setPasswordBusy(false));
  };

  const unpublish = (share: Share) => {
    setError('');
    setLinkBusy(true);
    void flowJson(`/api/projects/${projectId}/shares/${share.id}`, { method: 'DELETE' })
      .then(async () => {
        setNote(share.kind === 'output' ? 'Output unpublished.' : 'Link unpublished.');
        if (settingsShareId === share.id) setSettingsShareId(null);
        await loadShares();
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Could not unpublish'))
      .finally(() => setLinkBusy(false));
  };

  const mark = (value?: string) => {
    const text = (value || '?').split('@')[0];
    const parts = text.split(/[^A-Za-z0-9]+/).filter(Boolean);
    return ((parts[0]?.[0] || '') + (parts[1]?.[0] || parts[0]?.[1] || '')).toUpperCase() || '?';
  };
  const roleName = (value?: string) => {
    if (value === 'asker') return 'Asker';
    if (value === 'editor') return 'Editor';
    if (value === 'viewer' || !value) return 'Viewer';
    if (value === 'owner') return 'Owner';
    return value[0].toUpperCase() + value.slice(1).toLowerCase();
  };
  const count = (people || []).length + invites.length;

  return (
    <>
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
                    { value: 'asker', label: 'Asker' },
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
              <span>Viewer · reads outputs</span>
              <span>Asker · asks questions, can&apos;t edit</span>
              <span>Editor · runs and edits</span>
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
                <span className="share-person-role">Can view</span>
              </div>
            ))}
          </div>
          <div className="share-section">
            <div className="share-anyone">
              <span className="share-icon">⛓</span>
              <span className="share-who">
                <strong>Anyone with the link</strong>
                <span>Signed-in people who open the link</span>
              </span>
              <span className="share-person-role">Can view</span>
              <Checkbox
                checked={linkOn}
                disabled={linkBusy}
                onCheckedChange={value => setProjectLink(value === true)}
                aria-label="Link sharing"
              />
            </div>
            <div className="share-copy">
              <Input readOnly aria-label="Project link" value={linkOn ? link : ''} />
              <Button
                className="flow-btn"
                type="button"
                disabled={!linkOn || !link}
                onClick={() =>
                  void navigator.clipboard.writeText(link).then(() => setNote('Link copied.'))
                }
              >
                Copy link
              </Button>
            </div>
            <div className="share-one">
              <Checkbox
                checked={oneOutput}
                onCheckedChange={value => {
                  if (value === true) openPicker();
                  else clearOutputShare();
                }}
                aria-label="Share one output only"
              />
              <span className="share-who">
                <strong>Share one output only</strong>
                <span>
                  {outputShare?.title
                    ? `Link for “${outputShare.title}”`
                    : 'Send one result, like a table by brand, on its own'}
                </span>
              </span>
              <Button className="flow-btn" type="button" onClick={openPicker}>
                Choose
              </Button>
            </div>
            {outputLink ? (
              <div className="share-copy">
                <Input readOnly aria-label="Output link" value={outputLink} />
                <Button
                  className="flow-btn"
                  type="button"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(outputLink)
                      .then(() => setNote('Output link copied.'))
                  }
                >
                  Copy link
                </Button>
              </div>
            ) : null}
            {settingsShare ? (
              <div className="share-published" aria-label="Published link settings">
                <div className="share-published-head">
                  <span className="share-label">Published link settings</span>
                  {projectShare && outputShare ? (
                    <ChoiceSelect
                      className="share-settings-pick"
                      aria-label="Which link"
                      value={settingsShare.id}
                      onValueChange={setSettingsShareId}
                      options={[
                        {
                          value: projectShare.id,
                          label: 'Project link',
                        },
                        {
                          value: outputShare.id,
                          label: outputShare.title
                            ? `Output · ${outputShare.title}`
                            : 'Output link',
                        },
                      ]}
                    />
                  ) : null}
                </div>
                <div className="share-published-row">
                  <span className="share-who">
                    <strong>Password</strong>
                    <span>
                      {settingsShare.password_required
                        ? 'Viewers must enter a password'
                        : 'Optional. Protect this published link'}
                    </span>
                  </span>
                  <Switch
                    checked={Boolean(settingsShare.password_required)}
                    disabled={passwordBusy}
                    onCheckedChange={value => {
                      if (!value) {
                        savePassword(false);
                        return;
                      }
                      if (!passwordDraft.trim()) {
                        setError('Enter a password, then turn protection on.');
                        return;
                      }
                      savePassword(true);
                    }}
                    aria-label="Password protect"
                  />
                </div>
                <div className="share-copy share-password-row">
                  <Input
                    type="password"
                    autoComplete="new-password"
                    aria-label="Link password"
                    placeholder={
                      settingsShare.password_required ? 'Replace password' : 'Set a password'
                    }
                    value={passwordDraft}
                    onChange={event => setPasswordDraft(event.target.value)}
                    onKeyDown={event => {
                      if (event.key === 'Enter') savePassword(true);
                    }}
                  />
                  <Button
                    className="flow-btn"
                    type="button"
                    disabled={passwordBusy || !passwordDraft.trim()}
                    onClick={() => savePassword(true)}
                  >
                    Save
                  </Button>
                </div>
                <div className="share-published-row share-published-stack">
                  <span className="share-who">
                    <strong>Viewer filters</strong>
                    <span>
                      {filterLabels.length
                        ? `On the shared page: ${filterLabels.join(', ')}`
                        : settingsShare.kind === 'output'
                          ? 'Filters appear on the shared page when set on this output'
                          : 'Use a one-output link to offer viewer filters'}
                    </span>
                  </span>
                </div>
                <div className="share-published-row share-published-stack">
                  <span className="share-who">
                    <strong>Embed</strong>
                    <span>Paste this iframe into another web page</span>
                  </span>
                  <div className="share-copy share-embed">
                    <Textarea
                      readOnly
                      aria-label="Embed code"
                      className="share-embed-code"
                      value={embedSnippet}
                      rows={3}
                    />
                    <Button
                      className="flow-btn"
                      type="button"
                      disabled={!settingsLink}
                      onClick={() =>
                        void navigator.clipboard
                          .writeText(embedSnippet)
                          .then(() => setNote('Embed code copied.'))
                      }
                    >
                      Copy embed
                    </Button>
                  </div>
                </div>
                <div className="share-published-row">
                  <span className="share-who">
                    <strong>Unpublish</strong>
                    <span>Turn this published link off. The URL stops working.</span>
                  </span>
                  <Button
                    className="flow-btn"
                    type="button"
                    disabled={linkBusy}
                    onClick={() => unpublish(settingsShare)}
                  >
                    Unpublish
                  </Button>
                </div>
              </div>
            ) : null}
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
      {pickerOpen ? (
        <Dialog open onOpenChange={open => !open && setPickerOpen(false)}>
          <DialogContent className="share-dialog share-picker">
            <DialogHeader className="share-head">
              <DialogTitle>Choose an output</DialogTitle>
              <DialogDescription>The link shows this result only.</DialogDescription>
            </DialogHeader>
            <div className="share-body">
              {outputs === null ? <Skeleton className="h-24" /> : null}
              {pickerError ? <p className="flow-error">{pickerError}</p> : null}
              {outputs && !outputs.length && !pickerError ? (
                <p className="flow-muted">No outputs in this project yet.</p>
              ) : null}
              {(outputs || []).map(run => (
                <Button
                  key={run.id}
                  type="button"
                  className="share-pick-row"
                  onClick={() => chooseOutput(run)}
                >
                  <span className="share-who">
                    <strong>{run.title}</strong>
                    <span>
                      {outputKindLabel(run.op)}
                      {run.file ? ` · ${run.file}` : ''}
                    </span>
                  </span>
                </Button>
              ))}
            </div>
            <div className="share-foot">
              <span />
              <Button className="flow-btn" type="button" onClick={() => setPickerOpen(false)}>
                Cancel
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
