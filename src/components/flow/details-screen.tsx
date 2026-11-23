'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { flowJson, type FlowProject } from '@/lib/flow-api';
import { mapApiInvitation } from '@/lib/organization-invitations';
import {
  questionKind,
  questionnaireOutline,
  type FlowColumn,
  type OutlineSet,
} from '@/lib/flow-columns';
import { datasetRowId, downloadExport, fileToBase64 } from '@/components/flow/survey-screens';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { SidePanel } from '@/components/flow/side-panel';
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
import { AudiencePanel } from '@/components/flow/audience-panel';
import { showDatasetVersionUndoToast } from '@/lib/dataset-version-undo';
import {
  labelChangeLine,
  labelsImportAppliedNote,
  labelsImportApplyLabel,
  labelsImportPreviewNote,
  unmatchedLabelLine,
  type LabelsImportPreview,
} from '@/lib/label-workbook';
import { ProjectAiSettingsPanel } from '@/components/flow/project-ai-settings';
import { isAiEnabled } from '@/lib/ai-controls';
import { defaultTemplateName } from '@/lib/project-templates';
import { formatApiErrorMessage } from '@/lib/api-error';
import { labelledMeasure } from '@/lib/measure-level';
import {
  useDatasetColumns,
  useDatasetPreview,
  useMe,
  useOrganizationDetail,
  useOrganizationMembers,
  useProjectAskerLog,
  useProjectContextDocs,
  useProjectMembers,
} from '@/hooks/api/use-project-data';
import { projectQueryKeys } from '@/lib/project-query-cache';

type DetailFile = {
  dataset_id?: string;
  id?: string;
  original_filename?: string;
  n_rows?: number;
  updated_at?: string | null;
  project_id?: string;
};

type Member = { user_id: string; role?: string };
type AskerTurn = {
  turn_id: string;
  question: string;
  answer: string;
  checked?: boolean;
  status?: string;
  audience?: string;
  base?: string;
  weight?: string;
  source?: string;
};

/** The measure and the reason, using the API's source when it sent one. */
function displayedMeasure(column: FlowColumn): { measure: string; source: string } {
  const sent = String(column.measure || '').toLowerCase();
  const source = String(column.measure_source || '');
  if (source && (sent === 'nominal' || sent === 'ordinal' || sent === 'scale')) {
    return { measure: sent, source };
  }
  if (sent === 'nominal' || sent === 'ordinal' || sent === 'scale') {
    return { measure: sent, source: 'stored' };
  }
  const labels = column.value_labels || {};
  if (Object.keys(labels).length >= 2) {
    return { measure: labelledMeasure(labels), source: 'labelled codes' };
  }
  if (column.type === 'numeric') return { measure: 'scale', source: 'unlabelled number' };
  return { measure: 'nominal', source: 'unlabelled text' };
}

function measureSourceLabel(source: string | null | undefined): string {
  if (source === 'override') return 'Set in Details';
  if (source === 'stored') return 'Stored measure';
  if (source === 'labelled codes') return 'From the labelled codes';
  if (source === 'unlabelled number') return 'Unlabelled number';
  if (source === 'unlabelled text') return 'Unlabelled text';
  return 'Classified from the file';
}

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
  updated_by?: string | null;
};

const BRIEF_SECTIONS = ['Objectives', 'Audience', 'Notes'] as const;

export function splitBrief(text: string): { objectives: string; audience: string; notes: string } {
  const out = { objectives: '', audience: '', notes: '' };
  const pattern = /(^|\n)(Objectives|Audience|Notes)\n/g;
  const marks = [...text.matchAll(pattern)];
  if (!marks.length) return { ...out, objectives: text.trim() };
  const lead = text.slice(0, marks[0].index).trim();
  if (lead) out.objectives = lead;
  marks.forEach((mark, index) => {
    const start = (mark.index || 0) + mark[0].length;
    const end = index + 1 < marks.length ? marks[index + 1].index : text.length;
    const key = mark[2].toLowerCase() as keyof typeof out;
    const value = text.slice(start, end).trim();
    out[key] = out[key] ? `${out[key]}\n${value}` : value;
  });
  return out;
}

export function joinBrief(objectives: string, audience: string, notes = ''): string {
  const values = [objectives, audience, notes];
  return BRIEF_SECTIONS.map((label, index) =>
    values[index].trim() ? `${label}\n${values[index].trim()}` : ''
  )
    .filter(Boolean)
    .join('\n\n');
}

function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true">
      <path
        d="M9.5 2.5l2 2L5 11H3V9z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function memberMark(id: string): string {
  const letters = id.replace(/[^a-z]/gi, '');
  return (letters.slice(0, 2) || '·').toUpperCase();
}

function roleLabel(role?: string): string {
  if (role === 'owner') return 'Owner';
  if (role === 'viewer') return 'Can view';
  if (role === 'asker') return 'Can ask';
  return 'Can edit';
}

function columnKind(column: FlowColumn): string {
  // Same rules as the outline: labelled nominals stay single, not a rating scale.
  return questionKind(column, []);
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
  onChanged,
}: {
  project?: FlowProject;
  datasets: DetailFile[];
  onChanged?: () => void;
}) {
  const projectId = project?.id || '';
  const files = datasets.filter(row => row.project_id === projectId);
  const active = files.find(row => datasetRowId(row) === project?.active_dataset_id) || files[0];
  const labelsFileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const docsQuery = useProjectContextDocs(projectId || null);
  const membersQuery = useProjectMembers(projectId || null);
  const askerQuery = useProjectAskerLog(projectId || null);
  const meQuery = useMe();
  const orgId = meQuery.data?.active_organization?.id || '';
  const orgMembersQuery = useOrganizationMembers(orgId || null);
  const orgDetailQuery = useOrganizationDetail(orgId || null);
  const datasetId = active ? datasetRowId(active) : '';
  const columnsQuery = useDatasetColumns(datasetId || null);
  const previewQuery = useDatasetPreview(datasetId || null);

  const docs = (docsQuery.data || null) as BriefDoc[] | null;
  const members = (membersQuery.data || null) as Member[] | null;
  const turns = (askerQuery.data || null) as AskerTurn[] | null;
  const userId = meQuery.data?.user?.id || meQuery.data?.user_id || '';
  const workspaceError = orgMembersQuery.isError ? 'Workspace members could not be loaded.' : null;
  const workspace = useMemo(() => {
    if (!orgId) return [] as WorkspacePerson[];
    if (!orgMembersQuery.data) return null;
    return orgMembersQuery.data.map(workspacePerson);
  }, [orgId, orgMembersQuery.data]);
  const orgAiEnabled = isAiEnabled(orgDetailQuery.data?.organization?.ai_enabled);

  const meta = columnsQuery.data as
    | {
        columns?: FlowColumn[];
        active_weight_column?: string | null;
        variable_sets?: OutlineSet[] | null;
        multiple_response_sets?:
          | {
              columns?: (string | { column?: string })[];
              variables?: string[];
            }[]
          | null;
      }
    | undefined;
  const preview = previewQuery.data;
  const { columns, variableSets, weightName, weightLabel, kinds } = useMemo(() => {
    if (!datasetId) {
      return {
        columns: [] as FlowColumn[],
        variableSets: [] as OutlineSet[],
        weightName: '',
        weightLabel: '',
        kinds: {} as Record<string, string>,
      };
    }
    if (!meta) {
      return {
        columns: null as FlowColumn[] | null,
        variableSets: [] as OutlineSet[],
        weightName: '',
        weightLabel: '',
        kinds: {} as Record<string, string>,
      };
    }
    const headers = preview?.headers || [];
    const rows = preview?.rows || [];
    const multi = new Set(
      (meta.multiple_response_sets || []).flatMap(set => [
        ...(set.columns || []).map(entry =>
          typeof entry === 'string' ? entry : String(entry.column || '')
        ),
        ...(set.variables || []),
      ])
    );
    for (const set of meta.variable_sets || []) {
      for (const column of set.columns || []) multi.add(String(column));
    }
    const nextKinds: Record<string, string> = {};
    for (const column of meta.columns || []) {
      const index = headers.findIndex(header => header === column.name || header === column.label);
      nextKinds[column.name] = questionKind(
        column,
        index >= 0 ? rows.map(row => row[index]) : [],
        multi
      );
    }
    const activeWeight = meta.active_weight_column || '';
    const weightColumn = (meta.columns || []).find(column => column.name === activeWeight);
    return {
      columns: (meta.columns || []) as FlowColumn[],
      variableSets: (Array.isArray(meta.variable_sets) ? meta.variable_sets : []) as OutlineSet[],
      weightName: activeWeight,
      weightLabel: String(weightColumn?.label || '').trim() || activeWeight,
      kinds: nextKinds,
    };
  }, [datasetId, meta, preview]);

  const [editing, setEditing] = useState(false);
  const [objectives, setObjectives] = useState('');
  const [audience, setAudience] = useState('');
  const [notes, setNotes] = useState('');
  const [savedText, setSavedText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [labelsBusy, setLabelsBusy] = useState(false);
  const [labelsPreview, setLabelsPreview] = useState<LabelsImportPreview | null>(null);
  const [labelsNote, setLabelsNote] = useState<string | null>(null);
  const [showLabelChanges, setShowLabelChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [picked, setPicked] = useState('');
  const [role, setRole] = useState('editor');
  const [inviteEmail, setInviteEmail] = useState('');
  const [memberError, setMemberError] = useState<string | null>(null);
  const [inviteNote, setInviteNote] = useState<string | null>(null);
  const [templateBusy, setTemplateBusy] = useState(false);
  const [templateNote, setTemplateNote] = useState<string | null>(null);

  const brief = (docs || [])
    .filter(doc => !doc.kind || doc.kind === 'brief')
    .sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))[0];
  const briefText = savedText ?? brief?.text ?? brief?.excerpt ?? '';
  const parts = splitBrief(briefText);
  // Cached data paints immediately on revisit — only the first load shows a skeleton.
  const ready =
    (docsQuery.isSuccess || docs !== null) &&
    (membersQuery.isSuccess || members !== null) &&
    (columnsQuery.isSuccess || columns !== null || !datasetId);
  const outline = questionnaireOutline(columns || [], variableSets, { weightName, kinds });

  const save = () => {
    if (!projectId || busy) return;
    const text = joinBrief(objectives, audience, notes);
    if (!text.trim()) {
      setError('Write an objective, an audience or a note before saving.');
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
        const nextDoc =
          page.doc || ({ text, kind: 'brief', updated_at: new Date().toISOString() } as BriefDoc);
        queryClient.setQueryData(
          projectQueryKeys.contextDocs(projectId),
          (current: BriefDoc[] | undefined) => [nextDoc, ...(current || [])]
        );
        setEditing(false);
      })
      .catch(err => setError(err instanceof Error ? err.message : 'The brief did not save.'))
      .finally(() => setBusy(false));
  };

  const downloadLabels = () => {
    if (!datasetId || labelsBusy) return;
    const stem = String(active?.original_filename || 'labels').replace(/\.[^.]+$/, '') || 'labels';
    setLabelsBusy(true);
    setLabelsNote(null);
    void downloadExport(`/datasets/${datasetId}/labels.xlsx`, `${stem}_labels.xlsx`)
      .then(() => setLabelsNote('Labels downloaded.'))
      .catch(err =>
        setLabelsNote(err instanceof Error ? err.message : 'Could not download labels.')
      )
      .finally(() => setLabelsBusy(false));
  };

  const onPickLabelsFile = (file: File | null) => {
    if (!file || !datasetId) return;
    setLabelsBusy(true);
    setLabelsNote(null);
    setShowLabelChanges(false);
    void fileToBase64(file)
      .then(content =>
        flowJson<{
          labels_changed?: number;
          unmatched?: number;
          unmatched_rows?: LabelsImportPreview['unmatched_rows'];
          code_changed?: number;
          changes?: LabelsImportPreview['changes'];
        }>(`/datasets/${datasetId}/labels/import`, {
          method: 'POST',
          body: JSON.stringify({
            content_base64: content,
            filename: file.name,
            apply: false,
          }),
        }).then(body => {
          const preview: LabelsImportPreview = {
            filename: file.name,
            content_base64: content,
            labels_changed: Number(body.labels_changed || 0),
            unmatched: Number(body.unmatched || 0),
            unmatched_rows: Array.isArray(body.unmatched_rows) ? body.unmatched_rows : [],
            code_changed: Number(body.code_changed || 0),
            changes: Array.isArray(body.changes) ? body.changes : [],
          };
          setLabelsPreview(preview);
          setLabelsNote(labelsImportPreviewNote(preview));
        })
      )
      .catch(err => {
        setLabelsPreview(null);
        setLabelsNote(err instanceof Error ? err.message : 'Could not read that labels file.');
      })
      .finally(() => {
        setLabelsBusy(false);
        if (labelsFileRef.current) labelsFileRef.current.value = '';
      });
  };

  const applyLabelsImport = () => {
    if (!datasetId || !projectId || !labelsPreview || labelsBusy) return;
    if (labelsPreview.labels_changed < 1) {
      setLabelsNote(labelsImportPreviewNote(labelsPreview));
      return;
    }
    const previousId = datasetId;
    const content = labelsPreview.content_base64;
    const appliedCount = labelsPreview.labels_changed;
    if (!content) {
      setLabelsNote('Upload the labels file again, then apply.');
      return;
    }
    setLabelsBusy(true);
    setLabelsNote(null);
    void flowJson<{ dataset_id?: string }>(`/datasets/${datasetId}/labels/import`, {
      method: 'POST',
      body: JSON.stringify({
        content_base64: content,
        filename: labelsPreview.filename,
        apply: true,
      }),
    })
      .then(saved => {
        const nextId = String(saved.dataset_id || '');
        if (!nextId || nextId === previousId) {
          throw new Error('Labels were not saved as a new version.');
        }
        setLabelsPreview(null);
        setShowLabelChanges(false);
        return flowJson(`/api/projects/${projectId}`, {
          method: 'PATCH',
          body: JSON.stringify({ active_dataset_id: nextId }),
        }).then(() => {
          showDatasetVersionUndoToast({
            projectId,
            previousDatasetId: previousId,
            currentDatasetId: nextId,
            title: 'Labels saved as a new version',
            onRestored: () => onChanged?.(),
          });
          setLabelsNote(labelsImportAppliedNote(appliedCount));
          onChanged?.();
        });
      })
      .catch(err =>
        setLabelsNote(err instanceof Error ? err.message : 'Could not apply those labels.')
      )
      .finally(() => setLabelsBusy(false));
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
        queryClient.setQueryData(
          projectQueryKeys.members(projectId),
          (current: Member[] | undefined) => [...(current || []), member]
        );
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
        body: JSON.stringify({
          email,
          role: 'member',
          project_id: projectId,
          project_role: role,
        }),
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

  const saveAsTemplate = () => {
    if (!projectId || templateBusy) return;
    const label = defaultTemplateName(project?.name);
    setTemplateBusy(true);
    setTemplateNote(null);
    setError(null);
    void flowJson<{ template?: { name?: string } }>(`/api/projects/${projectId}/save-as-template`, {
      method: 'POST',
      body: JSON.stringify({ name: label }),
    })
      .then(page => {
        setTemplateNote(`Saved “${page.template?.name || label}” as a team template.`);
      })
      .catch(err => setError(formatApiErrorMessage(err)))
      .finally(() => setTemplateBusy(false));
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

  const mine = (members || []).find(member => member.user_id === userId);
  const asker = mine?.role === 'asker';
  const lines = objectiveLines(parts.objectives);
  const startEdit = () => {
    setObjectives(parts.objectives);
    setAudience(parts.audience);
    setNotes(parts.notes);
    setEditing(true);
    setError(null);
  };

  return (
    <section className="details-page">
      <header className="details-head">
        <div className="details-title-row">
          <h1>Project brief</h1>
          <span className="flow-muted">
            {brief?.updated_at
              ? `${editedLabel(brief.updated_at)}${brief.updated_by ? ` by ${brief.updated_by}` : ''}`
              : 'No brief yet'}
          </span>
        </div>
        <div className="details-head-actions">
          {editing ? (
            <>
              <Button
                className="flow-btn"
                type="button"
                disabled={busy}
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
              <Button className="flow-btn primary" type="button" disabled={busy} onClick={save}>
                {busy ? 'Saving…' : 'Save brief'}
              </Button>
            </>
          ) : (
            <>
              <Button
                className="flow-btn"
                type="button"
                disabled={templateBusy || asker}
                onClick={saveAsTemplate}
              >
                {templateBusy ? 'Saving template…' : 'Save as template'}
              </Button>
              <Button className="flow-btn primary details-edit" type="button" onClick={startEdit}>
                <PencilIcon /> Edit brief
              </Button>
            </>
          )}
        </div>
      </header>
      {templateNote ? <p className="flow-muted details-template-note">{templateNote}</p> : null}
      <p className="details-explainer">
        <i />
        The agent reads this brief before every answer, so objectives, audience and notes shape what
        it runs and how it writes up results.
      </p>
      {projectId ? (
        <div className="details-ai-wrap">
          <ProjectAiSettingsPanel projectId={projectId} lockedByWorkspace={!orgAiEnabled} />
        </div>
      ) : null}
      <div className="details-body">
        <div className="details-main">
          <div className="details-split">
            <div>
              <div className="flow-muted details-label">Objectives</div>
              {!editing ? (
                <Button
                  className="details-editable"
                  type="button"
                  aria-label="Edit objectives"
                  onClick={startEdit}
                >
                  {lines.length ? (
                    lines.map((line, index) => (
                      <div key={`${index}-${line}`} className="details-objective">
                        <span className="details-num">{index + 1}</span>
                        <span>{line}</span>
                      </div>
                    ))
                  ) : (
                    <span className="flow-muted">Add the questions this study should answer.</span>
                  )}
                </Button>
              ) : null}
              {editing ? (
                <Textarea
                  className="flow-text"
                  value={objectives}
                  onChange={event => setObjectives(event.target.value)}
                  aria-label="Objectives"
                  placeholder="One objective on each line"
                />
              ) : null}
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
                  <Button
                    className="details-editable"
                    type="button"
                    aria-label="Edit audience"
                    onClick={startEdit}
                  >
                    <span className={parts.audience ? 'details-audience' : 'flow-muted'}>
                      {parts.audience || 'Add who the respondents are.'}
                    </span>
                  </Button>
                  {active ? (
                    <div className="details-tags">
                      {active.n_rows ? (
                        <span>{active.n_rows.toLocaleString('en-GB')} respondents</span>
                      ) : null}
                      {weightName ? <span>{weightLabel || weightName}</span> : null}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>
          {active ? (
            <AudiencePanel
              datasetId={datasetRowId(active)}
              columns={columns || []}
              canEdit={!asker}
            />
          ) : null}
          <div>
            <div className="flow-muted details-label">Notes</div>
            {editing ? (
              <Textarea
                className="flow-text"
                value={notes}
                onChange={event => setNotes(event.target.value)}
                aria-label="Notes"
                placeholder="Anything the agent should know: client terms, nets to use, caveats"
              />
            ) : (
              <Button
                className="details-editable"
                type="button"
                aria-label="Edit notes"
                onClick={startEdit}
              >
                <span className={parts.notes ? 'details-notes' : 'flow-muted'}>
                  {parts.notes || 'Add client terms, nets to use, or caveats for the agent.'}
                </span>
              </Button>
            )}
          </div>
          {error ? <p className="flow-error">{error}</p> : null}
          <div>
            <div className="details-q-head">
              <div className="flow-muted details-label">
                Questionnaire outline
                {outline.length ? ` · ${outline.length} questions` : ''}
              </div>
              <div className="details-q-head-actions">
                {active && datasetId ? (
                  <>
                    <Button
                      type="button"
                      className="flow-btn"
                      disabled={labelsBusy}
                      onClick={() => void downloadLabels()}
                    >
                      Download labels (.xlsx)
                    </Button>
                    <Button
                      type="button"
                      className="flow-btn"
                      disabled={labelsBusy}
                      onClick={() => labelsFileRef.current?.click()}
                    >
                      Upload labels
                    </Button>
                    <Input
                      ref={labelsFileRef}
                      className="sr-only"
                      type="file"
                      accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      aria-label="Labels Excel file"
                      onChange={event => void onPickLabelsFile(event.target.files?.[0] || null)}
                    />
                  </>
                ) : null}
                {active ? (
                  <Link href={`/flow/p/${projectId}/responses`}>
                    Linked to {active.original_filename || 'this file'}
                  </Link>
                ) : (
                  <Link href={`/flow/p/${projectId}/sources`}>Add a file on Sources</Link>
                )}
              </div>
            </div>
            {labelsPreview ? (
              <div className="details-labels-import" aria-busy={labelsBusy}>
                <p className="details-labels-import-title">
                  Upload labels · {labelsPreview.filename}
                </p>
                <div className="details-labels-stats">
                  <div className="details-labels-stat">
                    <strong data-tone="ok">{labelsPreview.labels_changed}</strong>
                    <span>labels changed</span>
                  </div>
                  <div className="details-labels-stat">
                    <strong>{labelsPreview.unmatched}</strong>
                    <span>rows not matched · skipped</span>
                  </div>
                  <div className="details-labels-stat">
                    <strong data-tone="warn">{labelsPreview.code_changed}</strong>
                    <span>code changed · not allowed</span>
                  </div>
                </div>
                <p className="flow-muted">
                  Sheets: Questions (name, label) and Answers (name, code, label). Only labels
                  change, never codes or data.
                </p>
                {showLabelChanges && labelsPreview.changes.length ? (
                  <ul className="details-labels-changes">
                    {labelsPreview.changes.map((change, index) => (
                      <li key={`${change.column}-${change.field}-${change.code || ''}-${index}`}>
                        {labelChangeLine(change)}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {showLabelChanges && labelsPreview.unmatched_rows.length ? (
                  <ul className="details-labels-changes">
                    {labelsPreview.unmatched_rows.map((row, index) => (
                      <li key={`unmatched-${row.name}-${row.code || ''}-${index}`}>
                        {unmatchedLabelLine(row)}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="details-labels-import-actions">
                  <Button
                    type="button"
                    className="flow-btn"
                    disabled={!labelsPreview.changes.length && !labelsPreview.unmatched_rows.length}
                    onClick={() => setShowLabelChanges(open => !open)}
                  >
                    {showLabelChanges ? 'Hide changes' : 'See changes'}
                  </Button>
                  <Button
                    type="button"
                    className="flow-btn primary"
                    disabled={labelsBusy || labelsPreview.labels_changed < 1}
                    onClick={() => void applyLabelsImport()}
                  >
                    {labelsImportApplyLabel(labelsPreview.labels_changed)}
                  </Button>
                </div>
              </div>
            ) : null}
            {labelsNote ? <p className="flow-muted">{labelsNote}</p> : null}
            {outline.length ? (
              <div className="details-q">
                {outline.map((question, index) => {
                  const measureColumnName = question.measureColumn || question.columns[0] || '';
                  const column =
                    (columns || []).find(item => item.name === measureColumnName) || null;
                  const kind = question.kind || (column ? columnKind(column) : 'single');
                  const shown = column
                    ? displayedMeasure(column)
                    : { measure: 'nominal', source: '' };
                  const setOnly = question.columns.length > 1;
                  return (
                    <div key={question.key} className="details-q-row">
                      <span className="details-q-num">Q{index + 1}</span>
                      <span className="details-q-name">{question.label}</span>
                      <span
                        className="details-q-kind"
                        data-kind={kind.startsWith('scale') ? 'scale' : kind}
                      >
                        {kind}
                      </span>
                      {setOnly || !column ? (
                        <span className="flow-muted">
                          {question.columns.length > 1 ? `${question.columns.length} items` : '—'}
                        </span>
                      ) : (
                        <ChoiceSelect
                          aria-label={`Measurement level for ${question.label}`}
                          value={shown.measure}
                          options={[
                            { value: 'nominal', label: 'Nominal' },
                            { value: 'ordinal', label: 'Ordinal' },
                            { value: 'scale', label: 'Scale' },
                          ]}
                          onValueChange={measure => {
                            if (datasetId) {
                              queryClient.setQueryData(
                                projectQueryKeys.columns(datasetId),
                                (current: { columns?: FlowColumn[] } | undefined) => {
                                  if (!current) return current;
                                  return {
                                    ...current,
                                    columns: (current.columns || []).map(item =>
                                      item.name === column.name
                                        ? { ...item, measure, measure_source: 'override' }
                                        : item
                                    ),
                                  };
                                }
                              );
                              void flowJson(`/datasets/${datasetId}/metadata`, {
                                method: 'PUT',
                                body: JSON.stringify({
                                  columns: { [column.name]: { measure_override: measure } },
                                }),
                              });
                            }
                          }}
                        />
                      )}
                      <span className="flow-muted">
                        {setOnly ? '' : measureSourceLabel(shown.source)}
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
        <SidePanel id="details" defaultWidth={280} className="details-side">
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
              {asker ? null : (
                <Button className="details-invite" type="button" onClick={() => setAddOpen(true)}>
                  + Invite
                </Button>
              )}
            </div>
            {(members || []).length ? (
              (members || []).map(member => {
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
            {asker || !turns?.length ? null : (
              <p className="flow-muted">
                Review Asker answers on{' '}
                <a href={`/flow/p/${projectId}/asker-questions`}>Asker questions</a>.
              </p>
            )}
          </div>
        </SidePanel>
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
              { value: 'asker', label: 'Can ask' },
              { value: 'viewer', label: 'Viewer' },
              { value: 'editor', label: 'Editor' },
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
