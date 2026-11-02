'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { flowJson, type FlowProject } from '@/lib/flow-api';
import { mapApiInvitation } from '@/lib/organization-invitations';
import { pickerColumns, type FlowColumn } from '@/lib/flow-columns';
import { datasetRowId } from '@/components/flow/survey-screens';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ChoiceSelect } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/rest';
import { Textarea } from '@/components/ui/textarea';

type DetailFile = {
  dataset_id?: string;
  id?: string;
  original_filename?: string;
  n_rows?: number;
  updated_at?: string | null;
  project_id?: string;
};

type Member = { user_id: string; role?: string };

export type WorkspacePerson = { userId: string; email: string; name: string };

export function workspacePerson(raw: Record<string, unknown>): WorkspacePerson {
  const email = String(raw.email || '');
  const stored = String(raw.display_name || '').trim();
  const name = stored || email.split('@')[0] || email;
  return { userId: String(raw.user_id || ''), email, name };
}

export function workspacePersonLabel(person: WorkspacePerson): string {
  if (person.name && person.email && person.name !== person.email) {
    return `${person.name} · ${person.email}`;
  }
  return person.email || person.name || 'Member';
}

export function peopleNotOnProject(
  people: WorkspacePerson[],
  members: Member[]
): WorkspacePerson[] {
  const ids = new Set(members.map(member => member.user_id));
  return people.filter(person => person.userId && !ids.has(person.userId));
}

type BriefDoc = {
  id?: string;
  kind?: string;
  text?: string;
  excerpt?: string;
  updated_at?: string;
};

export function splitBrief(text: string): { objectives: string; audience: string } {
  const marker = text.match(/\nAudience\n/);
  if (!marker || marker.index === undefined) {
    return { objectives: text.replace(/^Objectives\n/, '').trim(), audience: '' };
  }
  return {
    objectives: text
      .slice(0, marker.index)
      .replace(/^Objectives\n/, '')
      .trim(),
    audience: text.slice(marker.index + marker[0].length).trim(),
  };
}

export function joinBrief(objectives: string, audience: string): string {
  const parts = [];
  if (objectives.trim()) parts.push(`Objectives\n${objectives.trim()}`);
  if (audience.trim()) parts.push(`Audience\n${audience.trim()}`);
  return parts.join('\n\n');
}

function memberMark(id: string): string {
  const letters = id.replace(/[^a-z]/gi, '');
  return (letters.slice(0, 2) || '·').toUpperCase();
}

function roleLabel(role?: string): string {
  if (role === 'owner') return 'Owner';
  if (role === 'viewer') return 'Viewer';
  return 'Editor';
}

function columnKind(column: FlowColumn): string {
  const name = column.name;
  if (name.endsWith('_codes')) return 'open';
  const type = String(column.type || '').toLowerCase();
  const labels = Object.keys(column.value_labels || {});
  if (labels.length >= 5 && labels.every(code => /^\d+(\.0)?$/.test(code))) {
    return `scale ${Math.min(...labels.map(Number))}-${Math.max(...labels.map(Number))}`;
  }
  if (['string', 'text'].includes(type)) return labels.length ? 'single' : 'open';
  if (['numeric', 'number', 'float', 'integer', 'double'].includes(type))
    return labels.length ? 'single' : 'numeric';
  return type || 'single';
}

function editedLabel(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `Edited ${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
}

function objectiveLines(text: string): string[] {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
}

export function DetailsScreen({
  project,
  datasets,
}: {
  project?: FlowProject;
  datasets: DetailFile[];
}) {
  const projectId = project?.id || '';
  const files = datasets.filter(row => row.project_id === projectId);
  const active = files.find(row => datasetRowId(row) === project?.active_dataset_id) || files[0];
  const [docs, setDocs] = useState<BriefDoc[] | null>(null);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [columns, setColumns] = useState<FlowColumn[] | null>(null);
  const [weightName, setWeightName] = useState('');
  const [editing, setEditing] = useState(false);
  const [objectives, setObjectives] = useState('');
  const [audience, setAudience] = useState('');
  const [savedText, setSavedText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<WorkspacePerson[] | null>(null);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [picked, setPicked] = useState('');
  const [role, setRole] = useState('editor');
  const [inviteEmail, setInviteEmail] = useState('');
  const [memberError, setMemberError] = useState<string | null>(null);
  const [inviteNote, setInviteNote] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setDocs(null);
    setMembers(null);
    void flowJson<{ docs?: BriefDoc[] }>(`/api/projects/${projectId}/context-docs`)
      .then(page => {
        if (!cancelled) setDocs(page.docs || []);
      })
      .catch(() => {
        if (!cancelled) setDocs([]);
      });
    void flowJson<{ members?: Member[] }>(`/api/projects/${projectId}/members`)
      .then(page => {
        if (!cancelled) setMembers(page.members || []);
      })
      .catch(() => {
        if (!cancelled) setMembers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    void flowJson<{ active_organization?: { id?: string } }>('/me')
      .then(page => {
        const id = page.active_organization?.id || '';
        if (cancelled) return;
        setOrgId(id || null);
        if (!id) {
          setWorkspace([]);
          return;
        }
        return flowJson<{ members?: Record<string, unknown>[] }>(
          `/api/organizations/${id}/members`
        ).then(body => {
          if (!cancelled) setWorkspace((body.members || []).map(workspacePerson));
        });
      })
      .catch(() => {
        if (!cancelled) {
          setWorkspace([]);
          setWorkspaceError('Workspace members could not be loaded.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const datasetId = active ? datasetRowId(active) : '';
  useEffect(() => {
    if (!datasetId) {
      setColumns([]);
      return;
    }
    let cancelled = false;
    setColumns(null);
    void flowJson<{ columns?: FlowColumn[]; active_weight_column?: string | null }>(
      `/datasets/${datasetId}/metadata`
    )
      .then(meta => {
        if (cancelled) return;
        setColumns(meta.columns || []);
        setWeightName(meta.active_weight_column || '');
      })
      .catch(() => {
        if (!cancelled) setColumns([]);
      });
    return () => {
      cancelled = true;
    };
  }, [datasetId]);

  const brief = (docs || [])
    .filter(doc => !doc.kind || doc.kind === 'brief')
    .sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))[0];
  const briefText = savedText ?? brief?.text ?? brief?.excerpt ?? '';
  const parts = splitBrief(briefText);
  const ready = docs !== null && members !== null && columns !== null;
  const outline = pickerColumns(columns || []);

  const save = () => {
    if (!projectId || busy) return;
    const text = joinBrief(objectives, audience);
    if (!text.trim()) {
      setError('Write an objective or an audience before saving.');
      return;
    }
    setBusy(true);
    setError(null);
    void flowJson<{ doc?: BriefDoc }>(`/api/projects/${projectId}/context-docs`, {
      method: 'POST',
      body: JSON.stringify({ name: 'Project brief', text, kind: 'brief' }),
    })
      .then(page => {
        setSavedText(text);
        setDocs(current => [page.doc || { text, kind: 'brief' }, ...(current || [])]);
        setEditing(false);
      })
      .catch(err => setError(err instanceof Error ? err.message : 'The brief did not save.'))
      .finally(() => setBusy(false));
  };

  const candidates = peopleNotOnProject(workspace || [], members || []);
  const selected = picked || candidates[0]?.userId || '';

  const addMember = () => {
    if (!projectId || !selected) return;
    setMemberError(null);
    void flowJson<{ member?: Member }>(`/api/projects/${projectId}/members`, {
      method: 'POST',
      body: JSON.stringify({ user_id: selected, role }),
    })
      .then(page => {
        const member = page.member || { user_id: selected, role };
        setMembers(current => [...(current || []), member]);
        setPicked('');
        setAddOpen(false);
      })
      .catch(err =>
        setMemberError(err instanceof Error ? err.message : 'The member was not added.')
      );
  };

  const invite = () => {
    const email = inviteEmail.trim();
    if (!orgId || !email.includes('@')) {
      setMemberError(email ? 'Enter an email address.' : 'This account has no workspace.');
      return;
    }
    setMemberError(null);
    setInviteNote(null);
    void flowJson<{ invitation?: Record<string, unknown> }>(
      `/api/organizations/${orgId}/invitations`,
      {
        method: 'POST',
        body: JSON.stringify({ email, role: 'member' }),
      }
    )
      .then(page => {
        const invitation = mapApiInvitation(page.invitation || { email });
        setInviteEmail('');
        setInviteNote(
          invitation.emailStatus === 'sent'
            ? `Invitation emailed to ${invitation.email}.`
            : `Invitation created for ${invitation.email}. The email was not sent.`
        );
      })
      .catch(err =>
        setMemberError(err instanceof Error ? err.message : 'The invitation was not sent.')
      );
  };

  if (!ready) {
    return (
      <section className="details-page">
        <div className="details-head">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-8 w-28" />
        </div>
        <div className="details-body">
          <div className="details-main">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
          <div className="details-side">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      </section>
    );
  }

  const lines = objectiveLines(parts.objectives);

  return (
    <section className="details-page">
      <header className="details-head">
        <div className="details-title-row">
          <h1>Project brief</h1>
          <span className="flow-muted">
            {brief?.updated_at ? editedLabel(brief.updated_at) : 'No brief yet'}
          </span>
        </div>
        <div className="details-head-actions">
          <span className="details-agent">
            <i />
            The agent uses this brief as context in every chat
          </span>
          <Button
            className="flow-btn"
            type="button"
            onClick={() => {
              setObjectives(parts.objectives);
              setAudience(parts.audience);
              setEditing(current => !current);
              setError(null);
            }}
          >
            {editing ? 'Close' : 'Edit brief'}
          </Button>
        </div>
      </header>
      <div className="details-body">
        <div className="details-main">
          <div className="details-split">
            <div>
              <div className="flow-muted details-label">Objectives</div>
              {editing ? (
                <Textarea
                  className="flow-text"
                  value={objectives}
                  onChange={event => setObjectives(event.target.value)}
                  aria-label="Objectives"
                  placeholder="One objective on each line"
                />
              ) : lines.length ? (
                lines.map((line, index) => (
                  <div key={`${index}-${line}`} className="details-objective">
                    <span className="details-num">{index + 1}</span>
                    <span>{line}</span>
                  </div>
                ))
              ) : (
                <p className="flow-muted">No objectives yet.</p>
              )}
            </div>
            <div>
              <div className="flow-muted details-label">Audience</div>
              {editing ? (
                <Textarea
                  className="flow-text"
                  value={audience}
                  onChange={event => setAudience(event.target.value)}
                  aria-label="Audience"
                  placeholder="Who the file describes"
                />
              ) : (
                <>
                  <p className="details-audience">{parts.audience || 'No audience yet.'}</p>
                  {active ? (
                    <div className="details-tags">
                      {active.n_rows ? (
                        <span>{active.n_rows.toLocaleString('en-GB')} respondents</span>
                      ) : null}
                      {weightName ? <span>{weightName}</span> : null}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>
          {editing ? (
            <div className="flow-row">
              <Button className="flow-btn primary" type="button" disabled={busy} onClick={save}>
                {busy ? 'Saving' : 'Save brief'}
              </Button>
              {error ? <p className="flow-error">{error}</p> : null}
            </div>
          ) : null}
          <div>
            <div className="flow-muted details-label">Fieldwork · coming soon</div>
            <div className="details-fieldwork" data-soon>
              {['Panel', 'Target', 'Dates', 'Progress'].map(label => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{label === 'Panel' ? 'Panel fielding is coming soon' : '—'}</strong>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="details-q-head">
              <div className="flow-muted details-label">
                Questionnaire outline
                {outline.length ? ` · ${outline.length} questions` : ''}
              </div>
              {active ? (
                <Link href={`/flow/p/${projectId}/responses`}>
                  Linked to {active.original_filename || 'this file'}
                </Link>
              ) : (
                <Link href={`/flow/p/${projectId}/sources`}>Add a file on Sources</Link>
              )}
            </div>
            {outline.length ? (
              <div className="details-q">
                {outline.map((column, index) => {
                  const kind = columnKind(column);
                  return (
                    <div key={column.name} className="details-q-row">
                      <span className="details-q-num">Q{index + 1}</span>
                      <span className="details-q-name">{column.label || column.name}</span>
                      <span
                        className="details-q-kind"
                        data-kind={kind.startsWith('scale') ? 'scale' : kind}
                      >
                        {kind}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="flow-muted">This project has no columns to outline.</p>
            )}
          </div>
        </div>
        <aside className="details-side">
          <div>
            <div className="flow-muted details-label">Waves</div>
            {files.length ? (
              files.map(file => {
                const id = datasetRowId(file);
                const rows = file.n_rows
                  ? `${file.n_rows.toLocaleString('en-GB')} rows`
                  : 'No rows';
                return (
                  <div key={id} className="details-wave" data-active={id === datasetId}>
                    <i />
                    <span className="details-wave-name">{file.original_filename || id}</span>
                    <span className="flow-muted">
                      {id === datasetId
                        ? 'current'
                        : editedLabel(file.updated_at || undefined).replace('Edited ', '')}
                    </span>
                    <span className="details-wave-n">
                      {rows.replace(' rows', '') && file.n_rows
                        ? `n = ${file.n_rows.toLocaleString('en-GB')}`
                        : rows}
                    </span>
                  </div>
                );
              })
            ) : (
              <p className="flow-muted">Not fielded</p>
            )}
          </div>
          <div>
            <div className="flow-muted details-label">Client and deliverables</div>
            <div className="details-client" data-soon>
              <span className="details-client-mark">—</span>
              <div>
                <strong>No client yet</strong>
                <span>Client records are coming soon</span>
              </div>
            </div>
            {[
              ['Client deck', 'PowerPoint · default layout'],
              ['Banner book', 'Excel · 95% letters'],
              ['Topline', 'Word · first saved table'],
            ].map(([name, detail]) => (
              <Link key={name} className="details-deliverable" href={`/flow/p/${projectId}/report`}>
                <span>{name}</span>
                <span className="flow-muted">{detail}</span>
              </Link>
            ))}
          </div>
          <div>
            <div className="details-q-head">
              <div className="flow-muted details-label">Team</div>
              <Button className="details-invite" type="button" onClick={() => setAddOpen(true)}>
                + Invite
              </Button>
            </div>
            {members.length ? (
              members.map(member => {
                const person = (workspace || []).find(item => item.userId === member.user_id);
                const label = person ? workspacePersonLabel(person) : member.user_id;
                return (
                  <div key={member.user_id} className="details-member">
                    <Avatar className="size-6">
                      <AvatarFallback className="bg-[#D9E6E0] text-[9px] font-medium text-[#1e6b58]">
                        {memberMark(person?.name || member.user_id)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="details-member-id">{label}</span>
                    <span className="flow-muted">{roleLabel(member.role)}</span>
                  </div>
                );
              })
            ) : (
              <p className="flow-muted">No members yet.</p>
            )}
          </div>
        </aside>
      </div>
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add member</DialogTitle>
            <DialogDescription>
              Choose someone already in this workspace, or invite a new email. An email invite uses
              the workspace invitation.
            </DialogDescription>
          </DialogHeader>
          {workspace === null ? (
            <Skeleton className="h-9 w-full" />
          ) : workspaceError ? (
            <p className="flow-error">{workspaceError}</p>
          ) : candidates.length ? (
            <ChoiceSelect
              aria-label="Workspace member"
              value={selected}
              onValueChange={setPicked}
              options={candidates.map(person => ({
                value: person.userId,
                label: workspacePersonLabel(person),
              }))}
            />
          ) : (
            <p className="flow-muted">Everyone in this workspace is already on the project.</p>
          )}
          <ChoiceSelect
            aria-label="Role"
            value={role}
            onValueChange={setRole}
            options={[
              { value: 'editor', label: 'Editor' },
              { value: 'viewer', label: 'Viewer' },
            ]}
          />
          <div className="flow-row">
            <Button
              className="flow-btn primary"
              type="button"
              disabled={!selected}
              onClick={addMember}
            >
              Add to project
            </Button>
          </div>
          <Input
            value={inviteEmail}
            onChange={event => setInviteEmail(event.target.value)}
            aria-label="Email"
            placeholder="name@company.com"
          />
          <div className="flow-row">
            <Button className="flow-btn" type="button" onClick={invite}>
              Invite by email
            </Button>
            <Button className="flow-btn" type="button" onClick={() => setAddOpen(false)}>
              Close
            </Button>
          </div>
          {inviteNote ? <p className="flow-muted">{inviteNote}</p> : null}
          {memberError ? <p className="flow-error">{memberError}</p> : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
