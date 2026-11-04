'use client';

import './archived-projects.css';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/rest';
import { shortDate } from '@/components/flow/datasets-screen';
import { flowJson, type FlowProject } from '@/lib/flow-api';

export type ArchivedProject = FlowProject & { dataset_count?: number };

type MemberRow = { user_id?: string; name?: string; email?: string };

/** "3 files", "1 file", or "No data". */
export function archivedFilesLine(count?: number): string {
  if (!count) return 'No data';
  return `${count} file${count === 1 ? '' : 's'}`;
}

/** "2 Sep", with the year when it is not this year. */
export function archivedDate(iso?: string, now: Date = new Date()): string {
  if (!iso) return '—';
  const when = new Date(iso);
  if (!Number.isFinite(when.getTime())) return '—';
  return shortDate(when, now);
}

/** Match a search against the project name and folder. */
export function filterArchived(projects: ArchivedProject[], query: string): ArchivedProject[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return projects;
  return projects.filter(project =>
    [project.name, project.folder].some(text => (text || '').toLowerCase().includes(needle))
  );
}

/** The creator's name from the project's member list, never their id. */
export function creatorName(project: ArchivedProject, members: MemberRow[]): string {
  const creator = members.find(member => member.user_id && member.user_id === project.created_by);
  return creator?.name || creator?.email || '—';
}

export function ArchivedProjects({ onChanged }: { onChanged: () => Promise<void> }) {
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [projects, setProjects] = useState<ArchivedProject[]>([]);
  const [people, setPeople] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const page = await flowJson<{ projects?: ArchivedProject[] }>(
      '/api/projects?status=archived&limit=100'
    );
    const rows = page.projects || [];
    const named: Record<string, string> = {};
    if (rows.length) {
      const batch = await flowJson<{ members?: Record<string, MemberRow[]> }>(
        `/api/projects/batch/members?ids=${rows.map(row => row.id).join(',')}`
      ).catch(() => ({ members: {} as Record<string, MemberRow[]> }));
      for (const row of rows) named[row.id] = creatorName(row, batch.members?.[row.id] || []);
    }
    setProjects(rows);
    setPeople(named);
  }, []);

  useEffect(() => {
    let live = true;
    load()
      .then(() => live && setPhase('ready'))
      .catch(() => live && setPhase('error'));
    return () => {
      live = false;
    };
  }, [load]);

  const restore = (project: ArchivedProject) => {
    setBusy(project.id);
    setError('');
    void flowJson(`/api/projects/${project.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'active' }),
    })
      .then(() => Promise.all([load(), onChanged()]))
      .catch(err =>
        setError(err instanceof Error ? err.message : `${project.name} did not restore.`)
      )
      .finally(() => setBusy(null));
  };

  const shown = filterArchived(projects, query);

  return (
    <div className="ap-page">
      <div className="ap-toolbar">
        <div className="ap-count">
          {phase === 'ready'
            ? `${projects.length} archived project${projects.length === 1 ? '' : 's'}`
            : 'Archived projects'}
        </div>
        <Input
          className="ap-search"
          value={query}
          placeholder="Search archived"
          aria-label="Search archived projects"
          onChange={event => setQuery(event.target.value)}
        />
      </div>

      <div className="ap-info">
        Archived projects keep every file, table and report. They don’t count towards your dataset
        allowance and nobody can run new analyses in them until you restore them.
      </div>

      {error ? <p className="ap-error">{error}</p> : null}

      {phase === 'loading' ? (
        <div className="ap-table-wrap" aria-busy="true">
          <div className="ap-skeleton-head" />
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="ap-skeleton-row">
              <div className="ap-skeleton-name">
                <Skeleton className="ap-skeleton-line" />
                <Skeleton className="ap-skeleton-line short" />
              </div>
              <Skeleton className="ap-skeleton-cell" />
              <Skeleton className="ap-skeleton-cell small" />
              <Skeleton className="ap-skeleton-cell" />
              <Skeleton className="ap-skeleton-button" />
            </div>
          ))}
        </div>
      ) : phase === 'error' ? (
        <div className="ap-empty">
          <strong>We couldn’t load your archived projects</strong>
          <Button
            className="ap-restore"
            type="button"
            onClick={() => {
              setPhase('loading');
              load()
                .then(() => setPhase('ready'))
                .catch(() => setPhase('error'));
            }}
          >
            Try again
          </Button>
        </div>
      ) : shown.length === 0 ? (
        <div className="ap-empty">
          <strong>{query.trim() ? 'No archived project matches' : 'Nothing archived'}</strong>
          <span className="ap-muted">
            {query.trim()
              ? 'Try a different project or folder name.'
              : 'Projects you archive show up here, ready to restore.'}
          </span>
        </div>
      ) : (
        <div className="ap-table-wrap">
          <Table className="ap-table">
            <thead>
              <tr>
                <th>Project</th>
                <th className="ap-col-folder">Folder</th>
                <th className="ap-col-date">Archived</th>
                <th className="ap-col-by">By</th>
                <th className="ap-col-action" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {shown.map(project => (
                <tr key={project.id}>
                  <td>
                    <div className="ap-name">{project.name}</div>
                    <div className="ap-sub">{archivedFilesLine(project.dataset_count)}</div>
                  </td>
                  <td className="ap-col-folder">
                    {project.folder ? (
                      <span className="ap-folder">
                        <span className="ap-dot" aria-hidden />
                        {project.folder}
                      </span>
                    ) : (
                      <span className="ap-muted">No folder</span>
                    )}
                  </td>
                  <td className="ap-col-date ap-muted">{archivedDate(project.updated_at)}</td>
                  <td className="ap-col-by">{people[project.id] || '—'}</td>
                  <td className="ap-col-action">
                    <Button
                      className="ap-restore"
                      type="button"
                      disabled={busy === project.id}
                      onClick={() => restore(project)}
                    >
                      {busy === project.id ? 'Restoring…' : 'Restore'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  );
}
