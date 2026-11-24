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
import { inviteCreatedToast, mapApiInvitation } from '@/lib/organization-invitations';
import { publicShareEmbedSnippet } from '@/lib/public-share';
import { outputKindLabel, outputRuns, type OutputRun } from '@/components/flow/report-output-runs';

type Person = { user_id: string; role: string; email: string; name: string };
type Invite = {
  email?: string;
  status?: string;
  token?: string;
  created_at?: string;
  project_id?: string;
  project_role?: string;
  email_status?: string;
  email_error?: string | null;
};
type Share = {
  id: string;
  token: string;
  kind: 'project_link' | 'output';
  role?: string;
  access?: 'signed_in' | 'anonymous';
  run_id?: string | null;
  title?: string | null;
  password_required?: boolean;
  viewer_controls?: { label?: string; column?: string }[] | null;
};

type LinkAccess = 'signed_in' | 'anonymous';

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
  const [workspaceName, setWorkspaceName] = useState('this workspace');
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
  const [pageCounts, setPageCounts] = useState<{ shared: number; total: number } | null>(null);

  const projectShare = shares.find(share => share.kind === 'project_link');
  const outputShare = shares.find(share => share.kind === 'output');
  const linkOn = Boolean(projectShare);
  const linkAccess: LinkAccess =
    projectShare?.access === 'anonymous' ? 'anonymous' : linkOn ? 'signed_in' : 'signed_in';
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
    void flowJson<{ active_organization?: { id?: string; name?: string } }>('/me')
      .then(async me => {
        const orgId = me.active_organization?.id || '';
        setOrgId(orgId);
        setWorkspaceName(me.active_organization?.name?.trim() || 'this workspace');
        const [members, workspace, pending, overview] = await Promise.all([
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
          flowJson<{
            findings?: unknown[];
            tables?: unknown[];
            report?: { pages?: { hide_from_publish?: boolean; hideFromPublish?: boolean }[] };
          }>(`/api/projects/${projectId}/overview`).catch(
            () =>
              ({}) as {
                report?: { pages?: { hide_from_publish?: boolean; hideFromPublish?: boolean }[] };
              }
          ),
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
          (pending.invitations || []).filter(invite => {
            const status = String(invite.status || 'PENDING').toUpperCase();
            if (status !== 'PENDING') return false;
            const forProject = String(invite.project_id || '');
            // Project share invites only. Legacy org-only invites stay on Settings.
            return forProject === projectId;
          })
        );
        const pages = overview.report?.pages;
        if (Array.isArray(pages) && pages.length) {
          const total = pages.length;
          const shared = pages.filter(
            page => !(page.hide_from_publish ?? page.hideFromPublish)
          ).length;
          setPageCounts({ shared, total });
        } else {
          setPageCounts(null);
        }
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
        const page = await flowJson<{ invitation?: Record<string, unknown> }>(
          `/api/organizations/${orgId}/invitations`,
          {
            method: 'POST',
            body: JSON.stringify({
              email: address,
              role: 'member',
              project_id: projectId,
              project_role: role,
            }),
          }
        );
        setEmail('');
        const invitation = mapApiInvitation(
          page.invitation || { email: address, status: 'PENDING', project_id: projectId }
        );
        const toast = inviteCreatedToast(invitation);
        if (toast.variant === 'destructive') {
          setError(toast.description);
          setNote(toast.title);
        } else {
          setNote(`${toast.title}. ${toast.description}`);
        }
        load();
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Could not invite'));
  };

  const resendInvite = (inviteRow: Invite) => {
    if (!orgId || !inviteRow.token) return;
    setError('');
    void flowJson<{ invitation?: Record<string, unknown> }>(
      `/api/organizations/${orgId}/invitations/${inviteRow.token}/resend`,
      { method: 'POST' }
    )
      .then(page => {
        const invitation = mapApiInvitation(
          page.invitation || { email: inviteRow.email, status: 'PENDING' }
        );
        const toast = inviteCreatedToast(invitation);
        if (toast.variant === 'destructive') {
          setError(toast.description);
          setNote('Invitation still pending.');
        } else {
          setNote('Invitation resent.');
        }
        load();
      })
      .catch(() => setError('Could not resend.'));
  };

  const revokeInvite = (inviteRow: Invite) => {
    if (!inviteRow.token) return;
    setError('');
    void flowJson(`/api/invitations/${inviteRow.token}`, { method: 'DELETE' })
      .then(() => {
        setNote('Invitation revoked.');
        load();
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Could not revoke.'));
  };

  const setProjectLink = (access: LinkAccess | null) => {
    setError('');
    setLinkBusy(true);
    const work =
      access === null
        ? flowJson(`/api/projects/${projectId}/shares/revoke-kind`, {
            method: 'POST',
            body: JSON.stringify({ kind: 'project_link' }),
          }).then(() => {
            setNote('Link sharing turned off.');
            return loadShares();
          })
        : flowJson<{ share: Share }>(`/api/projects/${projectId}/shares`, {
            method: 'POST',
            body: JSON.stringify({ kind: 'project_link', role: 'viewer', access }),
          }).then(async body => {
            await loadShares();
            const url = shareUrl(body.share.token);
            await navigator.clipboard.writeText(url).catch(() => undefined);
            setNote(
              access === 'anonymous'
                ? 'Public read-only link copied.'
                : 'Link copied. Signed-in people can open it.'
            );
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
    if (value === 'asker') return 'Can ask';
    if (value === 'editor') return 'Can edit';
    if (value === 'viewer' || !value) return 'Can view';
    if (value === 'owner') return 'Owner';
    return value[0].toUpperCase() + value.slice(1).toLowerCase();
  };
  const invitedAgo = (createdAt?: string) => {
    if (!createdAt) return 'Invited';
    const then = Date.parse(createdAt);
    if (Number.isNaN(then)) return 'Invited';
    const days = Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
    if (days <= 0) return 'Invited today';
    if (days === 1) return 'Invited 1 day ago';
    return `Invited ${days} days ago`;
  };
  const count = (people || []).length + invites.length;

  return (
    <>
      <Dialog open onOpenChange={open => !open && onClose()}>
        <DialogContent className="share-dialog flow-modal">
          <DialogHeader className="share-head flow-modal-head">
            <DialogTitle>Share {projectName}</DialogTitle>
            <DialogDescription>
              Project, with its sources, tables, outputs and report.
            </DialogDescription>
          </DialogHeader>
          <div className="share-scroll flow-modal-body">
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
                      { value: 'asker', label: 'Can ask' },
                      { value: 'viewer', label: 'Can view' },
                      { value: 'editor', label: 'Can edit' },
                    ]}
                  />
                </div>
                <Button className="flow-btn primary" type="button" onClick={invite}>
                  Invite
                </Button>
              </div>
              <p className="share-roles">
                <span>Can view · reads outputs</span>
                <span>Can ask · asks questions, can&apos;t edit</span>
                <span>Can edit · runs and edits</span>
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
                      {invitedAgo(inviteRow.created_at)}
                      {inviteRow.token ? (
                        <>
                          {' · '}
                          <Button
                            className="share-link-btn"
                            type="button"
                            onClick={() => resendInvite(inviteRow)}
                          >
                            Resend
                          </Button>
                          {' · '}
                          <Button
                            className="share-link-btn"
                            type="button"
                            onClick={() => revokeInvite(inviteRow)}
                          >
                            Revoke
                          </Button>
                        </>
                      ) : null}
                      {inviteRow.email_status && inviteRow.email_status !== 'sent' ? (
                        <>
                          {' · '}
                          <span className="share-email-status">
                            {inviteRow.email_status === 'not_configured'
                              ? 'Not emailed'
                              : inviteRow.email_status === 'failed'
                                ? 'Email failed'
                                : 'No email on record'}
                          </span>
                        </>
                      ) : null}
                    </span>
                  </span>
                  <span className="share-person-role">{roleName(inviteRow.project_role)}</span>
                </div>
              ))}
            </div>
            <div className="share-section">
              <div className="share-anyone">
                <span className="share-icon">⛓</span>
                <span className="share-who">
                  <strong>Anyone with the link</strong>
                  <span>
                    {linkOn
                      ? linkAccess === 'anonymous'
                        ? 'Anyone, no sign-in (read-only)'
                        : `Signed-in people in ${workspaceName}`
                      : 'Choose who can open the link'}
                  </span>
                </span>
                <span className="share-person-role">Can view</span>
                <Checkbox
                  checked={linkOn}
                  disabled={linkBusy}
                  onCheckedChange={value => setProjectLink(value === true ? 'signed_in' : null)}
                  aria-label="Link sharing"
                />
              </div>
              {linkOn ? (
                <div className="share-link-modes" role="radiogroup" aria-label="Link access">
                  <Button
                    type="button"
                    className="share-link-mode"
                    data-active={linkAccess === 'signed_in' ? 'true' : 'false'}
                    aria-checked={linkAccess === 'signed_in'}
                    role="radio"
                    disabled={linkBusy}
                    onClick={() => setProjectLink('signed_in')}
                  >
                    <strong>Signed-in people in {workspaceName}</strong>
                  </Button>
                  <Button
                    type="button"
                    className="share-link-mode"
                    data-active={linkAccess === 'anonymous' ? 'true' : 'false'}
                    aria-checked={linkAccess === 'anonymous'}
                    role="radio"
                    disabled={linkBusy}
                    onClick={() => setProjectLink('anonymous')}
                  >
                    <strong>Anyone, no sign-in (read-only)</strong>
                    <span>Opens this viewer. No rows, no chat, no edits.</span>
                  </Button>
                  <p className="share-link-meta">
                    {pageCounts
                      ? `Pages shared: ${pageCounts.shared} of ${pageCounts.total}`
                      : 'Pages shared: all publishable pages'}
                    {' · '}Expires: never · Turn off any time
                  </p>
                </div>
              ) : null}
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
                  <div className="share-published-grid">
                    <div className="share-published-card">
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
                    </div>
                    <div className="share-published-card">
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
          </div>
          <div className="share-foot flow-modal-foot">
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
          <DialogContent className="share-dialog share-picker flow-modal">
            <DialogHeader className="share-head flow-modal-head">
              <DialogTitle>Choose an output</DialogTitle>
              <DialogDescription>The link shows this result only.</DialogDescription>
            </DialogHeader>
            <div className="share-body share-scroll flow-modal-body">
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
            <div className="share-foot flow-modal-foot">
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
