'use client';

import './folder-view.css';

import Link from 'next/link';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { Table } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/rest';
import { lowerWhen, relativeWhen } from '@/components/flow/datasets-screen';
import { memberInitials, type ShellDataset } from '@/components/flow/flow-shell';
import { flowJson, type FlowProject } from '@/lib/flow-api';
import { useAuth } from '@/hooks/api/use-auth';

export type FolderFilter = 'active' | 'mine' | 'archived';

/** Projects in a folder for a filter, newest edit first. */
export function folderProjects(
  projects: FlowProject[],
  folderName: string,
  filter: FolderFilter,
  userIds: string[]
): FlowProject[] {
  return projects
    .filter(project => (project.folder || '') === folderName)
    .filter(project => {
      const archived = (project.status || 'active') === 'archived';
      if (filter === 'archived') return archived;
      if (archived) return false;
      if (filter === 'mine')
        return Boolean(project.created_by && userIds.includes(project.created_by));
      return true;
    })
    .sort(
      (left, right) =>
        new Date(right.updated_at || 0).getTime() - new Date(left.updated_at || 0).getTime()
    );
}

/** "3 files · brand_tracker_w4.sav", or "No data yet". */
export function filesLine(files: ShellDataset[]): string {
  if (files.length === 0) return 'No data yet';
  const first = files.find(row => !row.parent_dataset_id) || files[0];
  const count = `${files.length} file${files.length === 1 ? '' : 's'}`;
  return first.original_filename ? `${count} · ${first.original_filename}` : count;
}

export function FolderView({
  folder,
  projects,
  members,
  datasets,
  onNewProject,
  onChanged,
}: {
  folder: { id: string; name: string };
  projects: FlowProject[];
  members: Record<string, string[]>;
  datasets: ShellDataset[];
  onNewProject: () => void;
  onChanged: () => Promise<void>;
}) {
  const { user } = useAuth();
  const userIds = [user?.userId, user?.id].filter((id): id is string => Boolean(id));
  const [mode, setMode] = useState<'cards' | 'table'>('cards');
  const [filter, setFilter] = useState<FolderFilter>('active');
  const [archived, setArchived] = useState<FlowProject[] | null>(null);
  const [archivedPhase, setArchivedPhase] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    'idle'
  );
  const [error, setError] = useState('');

  const loadArchived = () => {
    setArchivedPhase('loading');
    return flowJson<{ projects?: FlowProject[] }>('/api/projects?status=archived&limit=100')
      .then(page => {
        setArchived(page.projects || []);
        setArchivedPhase('ready');
      })
      .catch(() => setArchivedPhase('error'));
  };

  const restore = (project: FlowProject) => {
    setError('');
    void flowJson(`/api/projects/${project.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'active' }),
    })
      .then(() => Promise.all([loadArchived(), onChanged()]))
      .catch(err => setError(err instanceof Error ? err.message : 'The project did not restore.'));
  };

  const active = folderProjects(projects, folder.name, 'active', userIds);
  const source = filter === 'archived' ? archived || [] : projects;
  const shown = folderProjects(source, folder.name, filter, userIds);
  const filesFor = (projectId: string) => datasets.filter(row => row.project_id === projectId);
  const loading = filter === 'archived' && archivedPhase === 'loading';

  const status = (project: FlowProject, files: ShellDataset[]) =>
    (project.status || 'active') === 'archived' ? (
      <Badge tone="draft">Archived</Badge>
    ) : files.length === 0 ? (
      <Badge tone="draft">Draft</Badge>
    ) : (
      <Badge tone="active">Active</Badge>
    );

  const avatars = (projectId: string) => (
    <div className="fv-avatars">
      {(members[projectId] || []).slice(0, 4).map((label, index) => (
        <span key={`${label}-${index}`} className="fv-avatar" data-tone={index % 2} title={label}>
          {memberInitials(label)}
        </span>
      ))}
    </div>
  );

  return (
    <div className="fv-page">
      <div className="fv-head">
        <div className="fv-titles">
          <div className="fv-crumb">
            <Link href="/flow">Projects</Link> › Folder
          </div>
          <div className="fv-title-row">
            <span className="fv-swatch" aria-hidden />
            <h1 className="fv-title">{folder.name}</h1>
          </div>
          <div className="fv-sub">
            {active.length} project{active.length === 1 ? '' : 's'}
          </div>
        </div>
        <div className="fv-head-actions">
          <Button className="fv-primary" type="button" onClick={onNewProject}>
            + New project here
          </Button>
        </div>
      </div>

      <div className="fv-filters">
        <Segmented
          className="fv-segment"
          aria-label="Project layout"
          value={mode}
          onValueChange={setMode}
          options={[
            { value: 'cards', label: 'Cards' },
            { value: 'table', label: 'Table' },
          ]}
        />
        <span className="fv-gap" />
        {(['active', 'mine', 'archived'] as const).map(item => (
          <Button
            key={item}
            className="fv-filter"
            type="button"
            data-active={filter === item}
            aria-pressed={filter === item}
            onClick={() => {
              setFilter(item);
              if (item === 'archived' && archivedPhase === 'idle') void loadArchived();
            }}
          >
            {item[0].toUpperCase() + item.slice(1)}
          </Button>
        ))}
      </div>

      {error ? <p className="fv-error">{error}</p> : null}

      {loading ? (
        mode === 'cards' ? (
          <div className="fv-grid" aria-busy="true">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="fv-card-skeleton" />
            ))}
          </div>
        ) : (
          <div className="fv-table-wrap" aria-busy="true">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="fv-row-skeleton" />
            ))}
          </div>
        )
      ) : filter === 'archived' && archivedPhase === 'error' ? (
        <div className="fv-empty">
          <strong>We couldn’t load archived projects</strong>
          <Button className="fv-secondary" type="button" onClick={() => void loadArchived()}>
            Try again
          </Button>
        </div>
      ) : mode === 'cards' ? (
        <div className="fv-grid">
          {shown.map(project => {
            const files = filesFor(project.id);
            const inner = (
              <>
                <div className="fv-card-top">
                  <span className="fv-folder">
                    <span className="fv-dot" aria-hidden />
                    {folder.name}
                  </span>
                  {status(project, files)}
                </div>
                <div className="fv-card-body">
                  <div className="fv-card-title">{project.name}</div>
                  <div className="fv-card-sub">{filesLine(files)}</div>
                </div>
              </>
            );
            if ((project.status || 'active') === 'archived') {
              return (
                <div key={project.id} className="fv-card">
                  {inner}
                  <div className="fv-card-foot">
                    {avatars(project.id)}
                    <Button className="fv-secondary" type="button" onClick={() => restore(project)}>
                      Restore
                    </Button>
                  </div>
                </div>
              );
            }
            return (
              <Link key={project.id} className="fv-card" href={`/flow/p/${project.id}/chat`}>
                {inner}
                <div className="fv-card-foot">
                  {avatars(project.id)}
                  <span className="fv-edited">
                    Edited {lowerWhen(relativeWhen(project.updated_at))}
                  </span>
                </div>
              </Link>
            );
          })}
          {filter !== 'archived' ? (
            <Button className="fv-card fv-card-new" type="button" onClick={onNewProject}>
              <span className="fv-plus">+</span>
              <span className="fv-new-title">New project</span>
              <span className="fv-card-sub">Drop in a .sav, .dta, CSV or Excel file</span>
            </Button>
          ) : shown.length === 0 ? (
            <div className="fv-empty fv-empty-wide">
              <strong>No archived projects in {folder.name}</strong>
            </div>
          ) : null}
        </div>
      ) : shown.length === 0 ? (
        <div className="fv-empty">
          <strong>
            {filter === 'archived'
              ? `No archived projects in ${folder.name}`
              : filter === 'mine'
                ? 'You haven’t started a project here yet'
                : 'No projects in this folder yet'}
          </strong>
          {filter !== 'archived' ? (
            <Button className="fv-secondary" type="button" onClick={onNewProject}>
              + New project here
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="fv-table-wrap">
          <Table className="fv-table">
            <thead>
              <tr>
                <th>Project</th>
                <th className="fv-col-status">Status</th>
                <th className="fv-col-people">People</th>
                <th className="fv-col-edited">Edited</th>
                {filter === 'archived' ? (
                  <th className="fv-col-action" aria-label="Actions" />
                ) : null}
              </tr>
            </thead>
            <tbody>
              {shown.map(project => {
                const files = filesFor(project.id);
                return (
                  <tr key={project.id}>
                    <td>
                      <Link className="fv-row-name" href={`/flow/p/${project.id}/chat`}>
                        {project.name}
                      </Link>
                      <div className="fv-card-sub">{filesLine(files)}</div>
                    </td>
                    <td className="fv-col-status">{status(project, files)}</td>
                    <td className="fv-col-people">{avatars(project.id)}</td>
                    <td className="fv-col-edited">{relativeWhen(project.updated_at)}</td>
                    {filter === 'archived' ? (
                      <td className="fv-col-action">
                        <Button
                          className="fv-secondary"
                          type="button"
                          onClick={() => restore(project)}
                        >
                          Restore
                        </Button>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  );
}
