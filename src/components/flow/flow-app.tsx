'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SubscriptionGate } from '@/components/templates/subscription-gate';
import { useAuth } from '@/hooks/api/use-auth';
import { flowFetch, flowJson, type FlowProject } from '@/lib/flow-api';
import { dependentColumns, type FlowColumn } from '@/lib/flow-columns';
import {
  downloadsFromToolResults,
  openSignedDownload,
  type ExportDownload,
} from '@/lib/excel-download';
import { runAgentLoop, type AgentLoopResponse } from '@/lib/run-agent-loop';
import { AnalysisSetupHost } from '@/components/templates/analysis/analysis-setup-provider';
import {
  getAnalysisOpForMenuName,
  isDialogMenuItem,
} from '@/configs/analysis-config/menu-registry';
import { getAllAnalysisItems, type AnalysisItem } from '@/configs/analysis-config/utils';
import { useAnalysisSetupStore } from '@/stores/analysis-setup-store';
import { useTabsStore, ViewType } from '@/stores/tabs-store';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ChoiceSelect } from '@/components/ui/select';
import { Segmented } from '@/components/ui/segmented';
import { Table } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea, Skeleton } from '@/components/ui/rest';
import { CodeFrameRail } from '@/components/flow/code-frame-rail';
import { ColumnSpark, valueCounts } from '@/components/flow/column-spark';
import { AddToProjectButton } from '@/components/flow/move-dataset';
import {
  CodeFramePanel,
  datasetRowId,
  downloadExport,
  EvidencePanel,
  fileToBase64,
  setSurveyCell,
  useEvidenceSheet,
  TablesBuilder,
  ThemesPanel,
  useSurveyCell,
  WeightPanel,
} from '@/components/flow/survey-screens';
type DatasetRow = {
  dataset_id?: string;
  id?: string;
  original_filename?: string;
  n_rows?: number;
  project_id?: string;
  updated_at?: string;
};

function LogoMark() {
  return (
    <span className="flow-logo" aria-hidden="true">
      <svg width="15" height="15" viewBox="0 0 48 48">
        <rect x="4" y="5" width="12" height="12" rx="2.5" fill="#FFFFFF" />
        <rect x="18" y="5" width="12" height="12" rx="2.5" fill="#FFFFFF" />
        <rect x="32" y="5" width="12" height="12" rx="2.5" fill="#6FC2A6" />
        <rect x="18" y="19" width="12" height="12" rx="2.5" fill="#FFFFFF" />
        <rect x="18" y="33" width="12" height="12" rx="2.5" fill="#FFFFFF" />
      </svg>
    </span>
  );
}

function editedAgo(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return 'Edited just now';
  if (minutes < 60) return `Edited ${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 36) return hours < 24 ? `Edited ${hours}h ago` : 'Edited yesterday';
  const days = Math.round(hours / 24);
  if (days < 14) return `Edited ${days} days ago`;
  return `Edited ${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
}

function editedLabel(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const PROJECT_TABS = [
  ['chat', 'Chat'],
  ['details', 'Details'],
  ['sources', 'Sources'],
  ['responses', 'Responses'],
  ['tables', 'Tables'],
  ['report', 'Report'],
  ['clips', 'Clips'],
] as const;

export function FlowApp({ slug }: { slug: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthReady, isAuthenticated } = useAuth();
  const [palette, setPalette] = useState(false);
  const [pendingAsk, setPendingAsk] = useState<string | null>(null);
  const [projects, setProjects] = useState<FlowProject[]>([]);
  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [datasets, setDatasets] = useState<DatasetRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [account, setAccount] = useState('');
  const [orgName, setOrgName] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [workspacePhase, setWorkspacePhase] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    if (!isAuthReady) return;
    if (!isAuthenticated) {
      router.replace(`/login?returnTo=${encodeURIComponent(pathname || '/flow')}`);
    }
  }, [isAuthReady, isAuthenticated, pathname, router]);

  const reload = useCallback(async () => {
    try {
      const [projectPage, folderPage, filePage] = await Promise.all([
        flowJson<{ projects?: FlowProject[] }>('/api/projects'),
        flowJson<{ folders?: { id: string; name: string }[] }>('/api/project-folders'),
        flowJson<DatasetRow[] | { datasets?: DatasetRow[] }>('/datasets/?scope=all'),
      ]);
      setProjects(projectPage.projects || []);
      setFolders(folderPage.folders || []);
      setDatasets(Array.isArray(filePage) ? filePage : filePage.datasets || []);
      setError(null);
      setWorkspacePhase('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the workspace');
      setWorkspacePhase('error');
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) void reload();
  }, [isAuthenticated, reload]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void flowJson<{
      email?: string;
      user?: { email?: string; name?: string };
      active_organization?: { name?: string };
    }>('/me')
      .then(page => {
        setAccount(page.user?.name || page.user?.email || page.email || '');
        setOrgName(page.active_organization?.name || '');
      })
      .catch(() => undefined);
  }, [isAuthenticated]);

  useEffect(() => {
    window.localStorage.removeItem('tensr-classic');
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPalette(open => !open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const section = slug[0] === 'p' ? slug[2] || 'chat' : slug[0] || 'projects';
  const projectId = slug[0] === 'p' ? slug[1] : '';
  const project = projects.find(item => item.id === projectId);
  const openDataset =
    datasets.find(
      row => row.project_id === project?.id && datasetRowId(row) === project?.active_dataset_id
    ) ||
    datasets.find(row => row.project_id === project?.id) ||
    datasets[0];
  const openDatasetId =
    project?.active_dataset_id || (openDataset ? datasetRowId(openDataset) : '');

  useEffect(() => {
    if (!openDatasetId) return;
    const store = useTabsStore.getState();
    const existing = store.tabs.find(
      tab => tab.type === ViewType.SPREADSHEET && tab.data?.datasetId === openDatasetId
    );
    if (existing) {
      if (store.activeTabId !== existing.id) store.setActiveTab(existing.id);
      return;
    }
    store.addTab({
      name: openDataset?.original_filename || 'Dataset',
      content: '',
      isDirty: false,
      type: ViewType.SPREADSHEET,
      path: openDatasetId,
      data: { datasetId: openDatasetId, initialColumns: [], initialData: [] },
    });
  }, [openDatasetId, openDataset?.original_filename]);

  const displayName = account.includes('@') ? account.split('@')[0] : account;
  const initials = (displayName || account)
    .split(/[\s._-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('');

  return (
    <SubscriptionGate>
      <div className={projectId ? 'flow flow-project' : 'flow flow-home'}>
        {projectId ? null : (
          <aside className="flow-side">
            <div className="flow-brand">
              <LogoMark />
              <div className="flow-brand-name">
                <strong>Tensr</strong>
                <em>
                  {orgName
                    ? ` · ${account && orgName.startsWith(account) ? orgName.slice(account.length).trim() || 'Workspace' : orgName}`
                    : ''}
                </em>
              </div>
            </div>
            <nav className="flow-nav">
              <Button
                className="flow-new"
                type="button"
                onClick={() => {
                  void flowJson<{ project?: { id?: string } }>('/api/projects', {
                    method: 'POST',
                    body: JSON.stringify({ name: 'Untitled' }),
                  }).then(page => {
                    const id = page.project?.id;
                    if (id) router.push(`/flow/p/${id}/chat`);
                    return reload();
                  });
                }}
              >
                <span className="nav-label">
                  <NavIcon kind="plus" /> New project
                </span>
                <span className="flow-k">⌘N</span>
              </Button>
              <Button type="button" onClick={() => setPalette(true)}>
                <span className="nav-label">
                  <NavIcon kind="search" /> Search
                </span>
                <span className="flow-k">⌘K</span>
              </Button>
              <Link href="/flow" data-active={section === 'projects'}>
                <span className="nav-label">
                  <NavIcon kind="home" /> Home
                </span>
              </Link>
              <Link href="/flow" data-active="false">
                <span className="nav-label">
                  <NavIcon kind="data" /> Datasets
                </span>
                <span className="flow-k">{datasets.length}</span>
              </Link>
              <Link href="/flow/plugins" data-active={section === 'plugins'}>
                <span className="nav-label">
                  <NavIcon kind="plugin" /> Plugins
                </span>
              </Link>
            </nav>
            <div className="flow-folders">
              <div className="folder-head">
                <h2>Folders</h2>
                <FolderCreate onCreated={reload} />
              </div>
              {folders.map((folder, index) => (
                <Button
                  key={folder.id}
                  type="button"
                  data-active={folderName === folder.name}
                  onClick={() => {
                    setFolderName(folder.name);
                    router.push('/flow');
                  }}
                >
                  <i data-tone={index === 0 ? 'accent' : 'mute'} />
                  {folder.name}
                </Button>
              ))}
            </div>
            <div className="flow-user">
              <span className="flow-avatar">{initials || '·'}</span>
              <div>
                <strong>{displayName || 'Signed in'}</strong>
                <span>
                  {orgName && account && orgName.startsWith(account)
                    ? orgName.slice(account.length).trim() || 'Workspace'
                    : orgName || 'Workspace'}
                </span>
              </div>
              <Button
                className="flow-btn"
                type="button"
                aria-label="Classic workspace"
                onClick={() => {
                  window.localStorage.setItem('tensr-classic', '1');
                  router.push('/dashboard?classic=1');
                }}
              >
                ···
              </Button>
            </div>
          </aside>
        )}
        <div className="flow-main">
          {projectId ? (
            <>
              <header className="proj-bar">
                <div className="proj-brand">
                  <Link href="/flow" aria-label="Projects">
                    <LogoMark />
                  </Link>
                  <span className="proj-slash">/</span>
                  <div className="proj-name">
                    <i />
                    <strong>{project?.name || 'Project'}</strong>
                  </div>
                </div>
                <Button className="proj-search" type="button" onClick={() => setPalette(true)}>
                  Search analyses <span className="flow-k">⌘K</span>
                </Button>
                <div className="proj-actions">
                  <Badge tone="soon">Fielding coming soon</Badge>
                  <Button className="flow-btn" type="button" onClick={() => setShareOpen(true)}>
                    Share
                  </Button>
                  <Link className="flow-btn primary" href={`/flow/p/${projectId}/report`}>
                    Export
                  </Link>
                </div>
              </header>
              <nav className="proj-tabs">
                {PROJECT_TABS.map(([key, label]) => (
                  <Link
                    key={key}
                    href={`/flow/p/${projectId}/${key}`}
                    data-active={section === key}
                  >
                    {label}
                  </Link>
                ))}
              </nav>
            </>
          ) : null}
          <div className="flow-body">
            {workspacePhase === 'error' && section !== 'projects' && projectId ? (
              <p className="flow-error">{error}</p>
            ) : null}
            {section === 'plugins' ? (
              <PluginsScreen />
            ) : section === 'projects' || !projectId ? (
              <ProjectsScreen
                phase={workspacePhase}
                error={error}
                projects={projects}
                datasets={datasets}
                folders={folders}
                folderName={folderName}
                workspace={orgName}
                onFolder={name => setFolderName(name)}
                onCreated={reload}
                onCreate={() => {
                  void flowJson<{ project?: { id?: string } }>('/api/projects', {
                    method: 'POST',
                    body: JSON.stringify({ name: 'Untitled' }),
                  }).then(page => {
                    const id = page.project?.id;
                    if (id) router.push(`/flow/p/${id}/chat`);
                    return reload();
                  });
                }}
              />
            ) : section === 'details' ? (
              <DetailsScreen project={project} />
            ) : section === 'sources' ? (
              <SourcesScreen projectId={projectId} datasets={datasets} onChanged={reload} />
            ) : section === 'responses' ? (
              <ResponsesScreen project={project} datasets={datasets} />
            ) : section === 'tables' ? (
              <TablesScreen project={project} datasets={datasets} />
            ) : section === 'report' ? (
              <ReportScreen projectId={projectId} project={project} datasets={datasets} />
            ) : section === 'interviews' ? (
              <InterviewsScreen projectId={projectId} project={project} datasets={datasets} />
            ) : section === 'clips' ? (
              <section className="flow-panel">
                <h2>Clips</h2>
                <p className="flow-soon">Coming soon</p>
                <p className="flow-muted">
                  Interview audio and clip reels are not available. Transcripts are on Interviews.
                </p>
                <Link href={`/flow/p/${projectId}/interviews`}>Open interviews</Link>
              </section>
            ) : (
              <ChatScreen
                project={project}
                datasets={datasets}
                pendingAsk={pendingAsk}
                onAsked={() => setPendingAsk(null)}
              />
            )}
          </div>
        </div>
        {palette ? (
          <Palette
            datasetId={openDatasetId}
            onClose={() => setPalette(false)}
            onAsk={name => {
              setPalette(false);
              setPendingAsk(name);
              if (projectId) router.push(`/flow/p/${projectId}/chat`);
            }}
          />
        ) : null}
        {shareOpen && projectId ? (
          <ShareModal projectId={projectId} onClose={() => setShareOpen(false)} />
        ) : null}
        <AnalysisSetupHost />
      </div>
    </SubscriptionGate>
  );
}

function FolderCreate({ onCreated }: { onCreated: () => Promise<void> }) {
  return (
    <Button
      type="button"
      aria-label="New folder"
      onClick={() => {
        void flowJson('/api/project-folders', {
          method: 'POST',
          body: JSON.stringify({ name: 'New folder' }),
        }).then(() => onCreated());
      }}
    >
      +
    </Button>
  );
}

function NavIcon({ kind }: { kind: 'plus' | 'search' | 'home' | 'data' | 'plugin' }) {
  if (kind === 'plus') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <path
          d="M8 3.5v9M3.5 8h9"
          fill="none"
          stroke="#1B1C1A"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (kind === 'search') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="7" cy="7" r="4.5" fill="none" stroke="#6A6B66" strokeWidth="1.4" />
        <path
          d="M10.5 10.5L13.5 13.5"
          fill="none"
          stroke="#6A6B66"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (kind === 'home') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <rect
          x="2.5"
          y="2.5"
          width="11"
          height="11"
          rx="2"
          fill="none"
          stroke="#6A6B66"
          strokeWidth="1.4"
        />
        <path d="M2.5 6.5h11M6.5 6.5v7" fill="none" stroke="#6A6B66" strokeWidth="1.4" />
      </svg>
    );
  }
  if (kind === 'data') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <ellipse cx="8" cy="4" rx="5" ry="1.8" fill="none" stroke="#6A6B66" strokeWidth="1.2" />
        <path
          d="M3 4v8c0 1 2.2 1.8 5 1.8s5-.8 5-1.8V4M3 8c0 1 2.2 1.8 5 1.8s5-.8 5-1.8"
          fill="none"
          stroke="#6A6B66"
          strokeWidth="1.2"
        />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M6 2.5h4v2a1.3 1.3 0 102.6 0h.9v4h-2a1.3 1.3 0 100 2.6h2v2.4H2.5V10.5h2a1.3 1.3 0 100-2.6h-2V4.5H6z"
        fill="none"
        stroke="#6A6B66"
        strokeWidth="1.2"
      />
    </svg>
  );
}

function ProjectsScreen({
  phase,
  error,
  projects,
  datasets,
  folders,
  folderName,
  workspace,
  onFolder,
  onCreated,
  onCreate,
}: {
  phase: 'loading' | 'ready' | 'error';
  error: string | null;
  projects: FlowProject[];
  datasets: DatasetRow[];
  folders: { id: string; name: string }[];
  folderName: string | null;
  workspace: string;
  onFolder: (name: string | null) => void;
  onCreated: () => Promise<void>;
  onCreate: () => void;
}) {
  const [mode, setMode] = useState<'cards' | 'table'>('cards');
  const [filter, setFilter] = useState<'active' | 'mine' | 'archived'>('active');
  const [query, setQuery] = useState('');
  const shown = projects.filter(project => {
    const status = project.status || 'active';
    if (folderName && (project.folder || '') !== folderName) return false;
    if (filter === 'archived') return status === 'archived';
    if (status === 'archived') return false;
    if (query && !project.name.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });
  return (
    <div className="home-page">
      <div className="home-head">
        <div>
          <div className="flow-muted">{workspace ? `${workspace} workspace` : 'Workspace'}</div>
          <h1 className="flow-page-title">{folderName || 'Projects'}</h1>
        </div>
        <div className="home-head-actions">
          <label className="home-search">
            <Input
              value={query}
              placeholder="Search projects"
              onChange={event => setQuery(event.target.value)}
            />
          </label>
          <Button className="home-new" type="button" onClick={onCreate}>
            + New project
          </Button>
        </div>
      </div>
      <div className="home-filters">
        <Segmented
          className="home-segment"
          aria-label="Project layout"
          value={mode}
          onValueChange={setMode}
          options={[
            { value: 'cards', label: 'Cards' },
            { value: 'table', label: 'Table' },
          ]}
        />
        <ChoiceSelect
          className="home-folder"
          aria-label="Folder"
          value={folderName || ''}
          onValueChange={value => onFolder(value || null)}
          options={[
            { value: '', label: 'All folders' },
            ...folders.map(folder => ({ value: folder.name, label: folder.name })),
          ]}
        />
        <span className="home-filters-gap" />
        {(['active', 'mine', 'archived'] as const).map(item => (
          <Button
            key={item}
            className="home-filter"
            type="button"
            data-active={filter === item}
            onClick={() => setFilter(item)}
          >
            {item[0].toUpperCase() + item.slice(1)}
          </Button>
        ))}
      </div>
      {phase === 'loading' ? (
        <div className="flow-grid" aria-busy="true">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="flow-card-skeleton" />
          ))}
        </div>
      ) : phase === 'error' ? (
        <p className="flow-error">{error || 'Could not load projects.'}</p>
      ) : mode === 'cards' ? (
        <div className="flow-grid">
          {shown.map(project => (
            <ProjectCard key={project.id} project={project} datasets={datasets} />
          ))}
          <Button className="flow-card flow-card-new" type="button" onClick={onCreate}>
            <span className="home-plus">+</span>
            <strong>New project</strong>
            <span className="flow-muted">
              Recruit on Prolific, sync Qualtrics or drop in a .sav
            </span>
          </Button>
        </div>
      ) : (
        <Table className="flow-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Folder</th>
              <th>Edited</th>
              <th>People</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {shown.map(project => (
              <tr key={project.id}>
                <td>
                  <Link href={`/flow/p/${project.id}/chat`}>{project.name}</Link>
                </td>
                <td>{project.folder || '—'}</td>
                <td>{project.updated_at || '—'}</td>
                <td>
                  <Members projectId={project.id} />
                </td>
                <td>
                  {project.status || 'active'}
                  <Button
                    className="flow-btn"
                    type="button"
                    onClick={() => {
                      void flowJson(`/api/projects/${project.id}`, {
                        method: 'PATCH',
                        body: JSON.stringify({
                          status: project.status === 'archived' ? 'active' : 'archived',
                        }),
                      }).then(() => onCreated());
                    }}
                  >
                    {project.status === 'archived' ? 'Restore' : 'Archive'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}

function ProjectCard({ project, datasets }: { project: FlowProject; datasets: DatasetRow[] }) {
  const count = datasets.filter(row => row.project_id === project.id).length;
  const status = project.status || 'active';
  const draft = count === 0;
  return (
    <Card asChild>
      <Link href={`/flow/p/${project.id}/chat`} className="flow-card">
        <div className="card-top">
          <span className="card-folder">
            <i />
            {project.folder || 'No folder'}
          </span>
          <Badge tone={status === 'archived' || draft ? 'draft' : 'active'}>
            {status === 'archived' ? 'Archived' : draft ? 'Draft' : 'Active'}
          </Badge>
        </div>
        <div>
          <h2>{project.name}</h2>
          <div className="flow-muted">
            {count} dataset{count === 1 ? '' : 's'}
          </div>
        </div>
        <div className="card-chips">
          <Badge>{count === 0 ? 'Not fielded' : `${count} file${count === 1 ? '' : 's'}`}</Badge>
          <Badge tone="soon">Fielding coming soon</Badge>
        </div>
        <div className="card-foot">
          <Members projectId={project.id} />
          <span className="flow-muted">{editedAgo(project.updated_at)}</span>
        </div>
      </Link>
    </Card>
  );
}

function DetailsScreen({ project }: { project?: FlowProject }) {
  return (
    <section className="flow-panel">
      <h2>{project?.name || 'Project'}</h2>
      <p className="flow-muted">Folder {project?.folder || 'None'}</p>
      <p className="flow-muted">Status {project?.status || 'active'}</p>
      <p className="flow-muted">Edited {project?.updated_at || '—'}</p>
      {project ? <Members projectId={project.id} /> : null}
    </section>
  );
}

function ShareModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [note, setNote] = useState('');
  const link =
    typeof window === 'undefined' ? '' : `${window.location.origin}/flow/p/${projectId}/chat`;
  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share</DialogTitle>
          <DialogDescription>
            Anyone in this workspace with the project can open it. Public links are coming soon.
          </DialogDescription>
        </DialogHeader>
        <Input readOnly value={link} aria-label="Project link" />
        <div className="flow-row">
          <Button
            className="flow-btn primary"
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(link).then(() => setNote('Copied'));
            }}
          >
            Copy link
          </Button>
          <Button className="flow-btn" type="button" onClick={onClose}>
            Close
          </Button>
        </div>
        {note ? <p>{note}</p> : null}
      </DialogContent>
    </Dialog>
  );
}

function memberMark(id: string): string {
  const letters = id.replace(/[^a-z]/gi, '');
  return (letters.slice(0, 2) || '·').toUpperCase();
}

function Members({ projectId }: { projectId: string }) {
  const [ids, setIds] = useState<string[] | null>(null);
  useEffect(() => {
    void flowJson<{ members?: { user_id: string }[] }>(`/api/projects/${projectId}/members`)
      .then(page => setIds((page.members || []).map(item => item.user_id).filter(Boolean)))
      .catch(() => setIds([]));
  }, [projectId]);
  if (ids === null) return <Skeleton className="h-6 w-12" />;
  if (!ids.length) return <span className="flow-muted">—</span>;
  return (
    <span className="avatars">
      {ids.slice(0, 3).map(id => (
        <Avatar key={id} className="size-6">
          <AvatarFallback className="bg-accent text-[10px] font-medium text-accent-foreground">
            {memberMark(id)}
          </AvatarFallback>
        </Avatar>
      ))}
    </span>
  );
}

function PluginsScreen() {
  const [rows, setRows] = useState<{ id?: string; name?: string; summary?: string }[]>([]);
  const [query, setQuery] = useState('');
  useEffect(() => {
    void flowJson<{
      plugins?: { id?: string; name?: string; summary?: string }[];
      items?: { id?: string; name?: string; summary?: string }[];
    }>('/plugins')
      .then(page => setRows(page.plugins || page.items || []))
      .catch(() => setRows([]));
  }, []);
  const shown = rows.filter(row => (row.name || '').toLowerCase().includes(query.toLowerCase()));
  return (
    <div>
      <Input
        className="flow-input"
        style={{ maxWidth: 280, marginBottom: 16 }}
        value={query}
        placeholder="Search plugins"
        onChange={event => setQuery(event.target.value)}
      />
      <div className="flow-grid">
        {shown.map(row => (
          <Card key={row.id || row.name} className="flow-card">
            <h2>{row.name}</h2>
            <p className="flow-muted">{row.summary || 'Installed from the plugin catalog.'}</p>
            <Badge tone="soon">Ratings coming soon</Badge>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Palette({
  datasetId,
  onClose,
  onAsk,
}: {
  datasetId?: string;
  onClose: () => void;
  onAsk: (name: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const analyses = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return getAllAnalysisItems()
      .filter(item => !needle || item.name.toLowerCase().includes(needle))
      .slice(0, 12);
  }, [query]);
  const chosen = analyses[Math.min(index, Math.max(analyses.length - 1, 0))];

  const openSetup = (item: AnalysisItem) => {
    onClose();
    const store = useAnalysisSetupStore.getState();
    if (isDialogMenuItem(item.name)) {
      store.openDialog(item.name);
      return;
    }
    const op = getAnalysisOpForMenuName(item.name);
    if (op) store.openSetupFromPalette(op);
    else store.openUnavailable(item.name);
  };

  return (
    <div className="flow-palette" onClick={onClose}>
      <Command
        shouldFilter={false}
        className="rounded-[16px] border border-border bg-popover"
        onClick={event => event.stopPropagation()}
        onKeyDown={event => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setIndex(current => Math.min(current + 1, analyses.length - 1));
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setIndex(current => Math.max(current - 1, 0));
          } else if (event.key === 'Enter' && chosen) {
            event.preventDefault();
            if (event.metaKey || event.ctrlKey) onAsk(chosen.name);
            else openSetup(chosen);
          } else if (event.key === 'Escape') {
            onClose();
          }
        }}
      >
        <CommandInput
          autoFocus
          value={query}
          placeholder="Search analyses"
          onValueChange={value => {
            setQuery(value);
            setIndex(0);
          }}
        />
        <CommandList>
          <CommandEmpty>No analyses</CommandEmpty>
          {analyses.map((item, itemIndex) => (
            <CommandItem
              key={`${item.section}-${item.name}`}
              value={item.name}
              data-active={item.name === chosen?.name && itemIndex === index}
              onSelect={() => openSetup(item)}
            >
              {item.name}
              <span className="flow-muted"> {item.section}</span>
            </CommandItem>
          ))}
        </CommandList>
        <p className="flow-muted">
          {datasetId ? 'Dataset open' : 'No dataset open'} · Enter opens setup. ⌘Enter asks the
          agent.
        </p>
      </Command>
    </div>
  );
}

function replyLines(result: AgentLoopResponse): string[] {
  const summary = result.execution_summary?.trim();
  if (summary) {
    return summary
      .split('\n')
      .map(line => line.replace(/^[\s\-*•]+/, '').trim())
      .filter(Boolean);
  }
  return (result.tool_trace || [])
    .map(item => {
      const message = item.message || item.summary;
      if (typeof message === 'string' && message.trim()) return message.trim();
      const name = item.name || item.tool;
      return typeof name === 'string' ? name.replaceAll('_', ' ') : '';
    })
    .filter(Boolean);
}

function replyTitle(answer: string): string {
  const lines = answer
    .split('\n')
    .map(row =>
      row
        .replace(/^#+\s*/, '')
        .replace(/[*_`]/g, '')
        .trim()
    )
    .filter(Boolean);
  if (lines.length < 2) return 'Result';
  return lines[0].slice(0, 90);
}

function replyLead(answer: string): string {
  const block = answer.split(/\n\s*\n/)[0] || answer;
  return block.replace(/[#*`]/g, '').trim();
}

function replyStat(answer: string): string | null {
  const line = answer.split('\n').find(row => /p\s*[<=>]|F\s*\(|χ|chi-square|η²|eta/.test(row));
  return line ? line.replace(/[#*`]/g, '').trim() : null;
}

function replyKind(result: AgentLoopResponse | null): string {
  for (const item of result?.tool_results || []) {
    const args = item.args || {};
    const nested = item.result || {};
    const type = args.analysis_type || nested.analysis_type || item.name;
    if (typeof type === 'string' && type.trim()) {
      const label = type.replaceAll('_', ' ');
      if (!['run analysis', 'finish', 'count'].includes(label)) return label;
    }
  }
  return 'Output';
}

function ChatScreen({
  project,
  datasets,
  pendingAsk,
  onAsked,
}: {
  project?: FlowProject;
  datasets: DatasetRow[];
  pendingAsk?: string | null;
  onAsked?: () => void;
}) {
  const datasetId =
    project?.active_dataset_id || datasets.find(row => row.project_id === project?.id)?.dataset_id;
  const [question, setQuestion] = useState('');
  const [sent, setSent] = useState('');
  const [mode, setMode] = useState<'ask' | 'plan' | 'agent'>('agent');
  const [answer, setAnswer] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [downloads, setDownloads] = useState<ExportDownload[]>([]);
  const [plan, setPlan] = useState<AgentLoopResponse | null>(null);
  const [turn, setTurn] = useState<AgentLoopResponse | null>(null);
  const [steps, setSteps] = useState<string[]>([]);
  const askedRef = useRef<string | null>(null);
  const [sessions, setSessions] = useState<{ session_id: string }[] | null>(null);
  const [recipes, setRecipes] = useState<{ name?: string; recipe_id?: string }[] | null>(null);

  useEffect(() => {
    if (!project) return;
    void flowJson<{ sessions?: { session_id: string }[] }>(`/api/projects/${project.id}/sessions`)
      .then(page => setSessions(page.sessions || []))
      .catch(() => setSessions([]));
    void flowJson<{ recipes?: { name?: string; recipe_id?: string }[] }>(
      `/datasets/recipes?project_id=${project.id}`
    )
      .then(page => setRecipes(page.recipes || []))
      .catch(() => setRecipes([]));
  }, [project]);

  const sendText = useCallback(
    async (text: string, nextMode: 'ask' | 'plan' | 'agent' = mode) => {
      if (!text.trim() || status === 'Warming up') return;
      setSent(text);
      setQuestion('');
      setMode(nextMode);
      setPlan(null);
      setTurn(null);
      setSteps([]);
      setDownloads([]);
      setStatus('Warming up');
      setAnswer('');
      let draft = '';
      try {
        const result = await runAgentLoop({
          message: text,
          mode: nextMode,
          datasetId: datasetId || null,
          agentVersion: 'v2',
          signal: AbortSignal.timeout(120_000),
          onProgress: progress => {
            const line = progress.message || progress.step;
            if (!line) return;
            setSteps(current => (current.includes(line) ? current : [...current, line]));
          },
          onDelta: chunk => {
            draft += chunk;
            setAnswer(draft);
            setStatus(null);
          },
          onReplace: next => {
            draft = next;
            setAnswer(next);
            setStatus(null);
          },
        });
        setAnswer(result.answer_markdown || '');
        setPlan(result.status === 'awaiting_approval' ? result : null);
        setTurn(result.status === 'awaiting_approval' ? null : result);
        const traced = replyLines(result);
        if (traced.length) setSteps(traced);
        const entries = (result.tool_results || []).flatMap(item => {
          const nested =
            item.result && typeof item.result === 'object'
              ? [item.result as Record<string, unknown>]
              : [];
          return [item as unknown as Record<string, unknown>, ...nested];
        });
        setDownloads(downloadsFromToolResults(entries));
        setStatus(null);
      } catch (err) {
        setStatus(err instanceof Error ? err.message : 'The reply did not finish. Ask again.');
      }
    },
    [datasetId, mode, status]
  );

  useEffect(() => {
    if (!pendingAsk || askedRef.current === pendingAsk) return;
    const text = pendingAsk;
    const handle = window.setTimeout(() => {
      askedRef.current = text;
      onAsked?.();
      void sendText(text, 'agent');
    }, 0);
    return () => window.clearTimeout(handle);
  }, [pendingAsk, onAsked, sendText]);

  const send = () => void sendText(question);

  const approve = () => {
    if (!plan || !sent) return;
    const batch =
      plan.pending_approvals && !Array.isArray(plan.pending_approvals)
        ? plan.pending_approvals
        : null;
    const calls = Array.isArray(plan.pending_approvals) ? plan.pending_approvals : null;
    setStatus('Warming up');
    void runAgentLoop({
      message: sent,
      mode,
      datasetId: datasetId || null,
      agentVersion: 'v2',
      sessionId: plan.session_id,
      approvedToolCalls: calls,
      approvedBatch:
        batch && typeof batch.mac === 'string' ? { batch: batch.batch, mac: batch.mac } : null,
      signal: AbortSignal.timeout(120_000),
      onDelta: chunk => {
        setAnswer(current => current + chunk);
        setStatus(null);
      },
    })
      .then(result => {
        setAnswer(result.answer_markdown || '');
        setPlan(result.status === 'awaiting_approval' ? result : null);
        setTurn(result.status === 'awaiting_approval' ? null : result);
        const traced = replyLines(result);
        if (traced.length) setSteps(traced);
        const entries = (result.tool_results || []).flatMap(item => {
          const nested =
            item.result && typeof item.result === 'object'
              ? [item.result as Record<string, unknown>]
              : [];
          return [item as unknown as Record<string, unknown>, ...nested];
        });
        setDownloads(downloadsFromToolResults(entries));
        setStatus(null);
      })
      .catch(err => {
        setStatus(err instanceof Error ? err.message : 'The plan did not run.');
      });
  };

  const clearChat = () => {
    setSent('');
    setAnswer('');
    setQuestion('');
    setPlan(null);
    setTurn(null);
    setSteps([]);
    setDownloads([]);
    setStatus(null);
  };

  const title = replyTitle(answer);
  const kind = replyKind(turn);
  const stat = replyStat(answer);
  const projectHref = project ? `/flow/p/${project.id}` : '/flow';

  return (
    <div className="flow-split">
      <aside className="flow-rail">
        <Button className="chat-new" type="button" onClick={clearChat}>
          + New chat
        </Button>
        <div className="flow-muted chat-label">Today</div>
        {sessions === null ? (
          <Skeleton className="h-8 w-full" />
        ) : sessions.length === 0 ? (
          <p className="flow-muted">No saved chats yet</p>
        ) : (
          sessions.map(session => (
            <div key={session.session_id} className="chat-item">
              {session.session_id.slice(0, 8)}
            </div>
          ))
        )}
        <div className="flow-muted chat-label">Recipes</div>
        {recipes === null ? (
          <Skeleton className="h-8 w-full" />
        ) : recipes.length === 0 ? (
          <p className="flow-muted">Save any run as a recipe</p>
        ) : (
          recipes.map(recipe => (
            <div key={recipe.recipe_id} className="chat-item">
              {recipe.name}
            </div>
          ))
        )}
      </aside>
      <section className="flow-thread">
        <div className="chat-column">
          <div className="chat-scroll">
            {sent ? <div className="chat-bubble">{sent}</div> : null}
            {steps.length > 0 ? (
              <div className="chat-steps">
                <div>
                  Ran {steps.length} {steps.length === 1 ? 'step' : 'steps'}
                </div>
                {steps.map(step => (
                  <div key={step}>{step}</div>
                ))}
              </div>
            ) : null}
            {answer && !plan ? (
              <article className="chat-prose" dangerouslySetInnerHTML={{ __html: plain(answer) }} />
            ) : null}
            {plan ? (
              <div className="chat-plan">
                <strong>Waiting for approval · Plan</strong>
                <div dangerouslySetInnerHTML={{ __html: plain(answer) }} />
                <div className="flow-row">
                  <Button className="flow-btn primary" type="button" onClick={approve}>
                    Approve
                  </Button>
                  <Button className="flow-btn" type="button" onClick={() => setPlan(null)}>
                    Edit plan
                  </Button>
                </div>
              </div>
            ) : null}
            {answer && !plan ? (
              <div className="chat-result">
                <div className="chat-result-top">
                  <div>
                    <strong>{title}</strong>
                    <div className="flow-muted">{kind} · Output</div>
                  </div>
                  <span className="chat-viewing">Viewing</span>
                </div>
                <div className="chat-result-actions">
                  <Link className="flow-btn primary" href={`${projectHref}/tables`}>
                    Open
                  </Link>
                  <Link className="flow-btn" href={`${projectHref}/report`}>
                    Add to report
                  </Link>
                  {downloads[0] ? (
                    <Button
                      className="flow-btn"
                      type="button"
                      onClick={() => void openSignedDownload(downloads[0])}
                    >
                      Download {downloads[0].filename}
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
            {status === 'Warming up' ? <p className="flow-status">Warming up</p> : null}
            {status && status !== 'Warming up' ? <p className="flow-error">{status}</p> : null}
          </div>
          <div className="flow-composer">
            <Textarea
              className="flow-text"
              value={question}
              onChange={event => setQuestion(event.target.value)}
              placeholder="Ask a follow-up..."
              onKeyDown={event => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void send();
                }
              }}
            />
            <Segmented
              className="mode-switch"
              aria-label="Chat mode"
              value={mode}
              onValueChange={setMode}
              options={[
                { value: 'ask', label: 'Ask' },
                { value: 'plan', label: 'Plan' },
                { value: 'agent', label: '● Agent' },
              ]}
            />
            <Button
              className="chat-send"
              type="button"
              aria-label="Send"
              disabled={status === 'Warming up'}
              onClick={() => void send()}
            >
              ↑
            </Button>
          </div>
        </div>
      </section>
      <aside className="flow-output">
        {answer && !plan ? (
          <>
            <div className="output-body">
              <div className="output-kicker">
                <span className="output-badge">{kind}</span>
                <span className="flow-muted">Agent chat</span>
              </div>
              <h2>{title}</h2>
              <div className="output-takeaway">{replyLead(answer)}</div>
              {stat ? (
                <div>
                  <div className="flow-muted">Key stat</div>
                  <div>{stat}</div>
                </div>
              ) : null}
              <div>
                <div className="flow-muted">Used in</div>
                <span className="output-badge">This chat · not in the report yet</span>
              </div>
              {downloads.length > 0 ? (
                <div>
                  <div className="flow-muted">Export</div>
                  <div className="flow-row">
                    {downloads.map(file => (
                      <Button
                        key={file.key}
                        className="flow-btn"
                        type="button"
                        onClick={() => void openSignedDownload(file)}
                      >
                        {file.filename}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="output-foot">
              <Button
                className="flow-btn"
                type="button"
                onClick={() => setStatus('This run has no replayable steps to save as a recipe.')}
              >
                Save
              </Button>
              <Link className="flow-btn" href={`${projectHref}/report`}>
                Add to report
              </Link>
              <Link className="flow-btn primary output-open" href={`${projectHref}/tables`}>
                Open
              </Link>
            </div>
          </>
        ) : (
          <p className="flow-muted output-empty">An output from this chat lands here.</p>
        )}
      </aside>
    </div>
  );
}

function SidePanel({ datasetId }: { datasetId?: string }) {
  const [question, setQuestion] = useState('');
  const [phase, setPhase] = useState<'idle' | 'warming' | 'error' | 'done'>('idle');
  const [note, setNote] = useState('');
  const ask = async () => {
    if (phase === 'warming' || !question.trim()) return;
    const text = question;
    setPhase('warming');
    setNote('Warming up');
    try {
      await runAgentLoop({
        message: text,
        mode: 'ask',
        datasetId: datasetId || null,
        agentVersion: 'v2',
      });
      setPhase('done');
      setNote('');
    } catch (err) {
      setPhase('error');
      setNote(
        err instanceof Error
          ? err.message
          : 'The side panel could not finish. The question is still here.'
      );
    }
  };
  return (
    <aside className="flow-output">
      <h2>Ask</h2>
      <Textarea
        className="flow-text"
        value={question}
        onChange={event => setQuestion(event.target.value)}
      />
      <Button
        className="flow-btn"
        type="button"
        disabled={phase === 'warming'}
        onClick={() => void ask()}
      >
        Ask about the open table
      </Button>
      {phase === 'warming' ? <p>Warming up</p> : null}
      {phase === 'error' ? <p className="flow-error">{note}</p> : null}
    </aside>
  );
}

function SourcesScreen({
  projectId,
  datasets,
  onChanged,
}: {
  projectId: string;
  datasets: DatasetRow[];
  onChanged: () => void;
}) {
  const [docs, setDocs] = useState<{ id: string; name: string }[]>([]);
  const [name, setName] = useState('Brief');
  const [text, setText] = useState('');
  const mine = datasets.filter(row => row.project_id === projectId);
  useEffect(() => {
    void flowJson<{ docs?: { id: string; name: string }[] }>(
      `/api/projects/${projectId}/context-docs`
    )
      .then(page => setDocs(page.docs || []))
      .catch(() => setDocs([]));
  }, [projectId]);
  return (
    <div className="flow-grid">
      <section className="flow-panel">
        <h2>Upload</h2>
        <p>
          Drop in a .sav, .csv, or .xlsx from Datasets. {mine.length} files are in this project.
        </p>
        <p>
          <span className="flow-soon">Prolific coming soon</span>{' '}
          <span className="flow-soon">Qualtrics live sync coming soon</span>{' '}
          <span className="flow-soon">Decipher coming soon</span>{' '}
          <span className="flow-soon">Alchemer coming soon</span>
        </p>
      </section>
      <section className="flow-panel">
        <h2>Context docs</h2>
        {docs.map(doc => (
          <div key={doc.id}>{doc.name}</div>
        ))}
        <Input
          className="flow-input"
          value={name}
          onChange={event => setName(event.target.value)}
        />
        <Textarea
          className="flow-text"
          value={text}
          onChange={event => setText(event.target.value)}
          placeholder="Questionnaire or brief"
        />
        <Button
          className="flow-btn primary"
          type="button"
          onClick={() => {
            void flowJson(`/api/projects/${projectId}/context-docs`, {
              method: 'POST',
              body: JSON.stringify({ name, text, kind: 'brief' }),
            })
              .then(() =>
                flowJson<{ docs?: { id: string; name: string }[] }>(
                  `/api/projects/${projectId}/context-docs`
                )
              )
              .then(page => setDocs(page.docs || []));
          }}
        >
          Save for the agent
        </Button>
      </section>
      <section className="flow-panel">
        <h2>Stack waves</h2>
        <Link href={`/flow/p/${projectId}/sources`}>Review mapping is on the stack screen.</Link>
        <StackScreen projectId={projectId} datasets={datasets} embedded onChanged={onChanged} />
      </section>
    </div>
  );
}

function StackScreen({
  projectId,
  datasets,
  embedded,
  onChanged,
}: {
  projectId: string;
  datasets: DatasetRow[];
  embedded?: boolean;
  onChanged?: () => void;
}) {
  const router = useRouter();
  const mine = datasets.filter(row => row.project_id === projectId);
  const [picked, setPicked] = useState<string[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [decisions, setDecisions] = useState<Record<string, 'accept' | 'override' | 'skip'>>({});
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const firstId = picked[0] || (mine[0] ? datasetRowId(mine[0]) : '');

  useEffect(() => {
    if (!firstId) return;
    void flowJson<{ columns?: { name?: string }[] }>(`/datasets/${firstId}/metadata`)
      .then(meta => {
        const names = (meta.columns || []).map(column => column.name || '').filter(Boolean);
        setColumns(names);
        setDecisions(current => {
          const next = { ...current };
          for (const name of names) if (!next[name]) next[name] = 'accept';
          return next;
        });
      })
      .catch(() => setColumns([]));
  }, [firstId]);

  const save = () => {
    const ids = (picked.length ? picked : mine.map(datasetRowId)).filter(Boolean);
    if (ids.length < 2) {
      setError('Pick at least two datasets to stack.');
      return;
    }
    setError('');
    const mappings = columns.map(column => ({
      source_column: column,
      target_column: decisions[column] === 'override' ? overrides[column] || column : column,
      decision: decisions[column] || 'accept',
      note: '',
    }));
    void flowJson(`/api/projects/${projectId}/wave-maps`, {
      method: 'POST',
      body: JSON.stringify({ sources: ids, mappings }),
    })
      .then(() =>
        flowJson<{ dataset_id?: string; derived_dataset_id?: string }>(
          '/datasets/intake/fuse-datasets',
          {
            method: 'POST',
            body: JSON.stringify({
              dataset_ids: ids,
              wave_names: ids.map((_, index) => `wave_${index + 1}`),
              mappings,
            }),
          }
        )
      )
      .then(fused => {
        const nextId = fused.derived_dataset_id || fused.dataset_id || '';
        if (!nextId) throw new Error('The stack did not return a dataset.');
        return flowJson(`/api/projects/${projectId}`, {
          method: 'PATCH',
          body: JSON.stringify({ active_dataset_id: nextId }),
        }).then(() => nextId);
      })
      .then(nextId => {
        setNote(`Stacked dataset ${nextId}`);
        router.push(`/flow/p/${projectId}/responses`);
      })
      .catch(err => setError(err instanceof Error ? err.message : 'The stack did not save'));
  };

  return (
    <div className={embedded ? '' : 'flow-panel'}>
      {!embedded ? <h2>Stack waves</h2> : <h2>Stack waves</h2>}
      <p className="flow-muted">
        Accept, override, or skip each column. Save runs the fuse and opens the stacked dataset.
      </p>
      <AddToProjectButton projectId={projectId} datasets={datasets} onAdded={onChanged} />
      {mine.map(row => {
        const id = datasetRowId(row);
        return (
          <label key={id} className="flow-row">
            <Checkbox
              checked={picked.includes(id)}
              onCheckedChange={checked => {
                setPicked(current =>
                  checked === true ? [...current, id] : current.filter(item => item !== id)
                );
              }}
            />
            {row.original_filename || id}
          </label>
        );
      })}
      {columns.map(column => (
        <div key={column} className="flow-row">
          <span>{column}</span>
          <ChoiceSelect
            className="flow-input"
            aria-label={`Decision for ${column}`}
            value={decisions[column] || 'accept'}
            onValueChange={value =>
              setDecisions(current => ({
                ...current,
                [column]: value as 'accept' | 'override' | 'skip',
              }))
            }
            options={[
              { value: 'accept', label: 'Accept' },
              { value: 'override', label: 'Override' },
              { value: 'skip', label: 'Skip' },
            ]}
          />
          {decisions[column] === 'override' ? (
            <Input
              className="flow-input"
              aria-label={`Override ${column}`}
              value={overrides[column] || ''}
              onChange={event =>
                setOverrides(current => ({ ...current, [column]: event.target.value }))
              }
            />
          ) : null}
        </div>
      ))}
      {error ? <p className="flow-error">{error}</p> : null}
      {note ? <p>{note}</p> : null}
      <Button className="flow-btn primary" type="button" onClick={save}>
        Save
      </Button>
    </div>
  );
}

function ResponsesScreen({ project, datasets }: { project?: FlowProject; datasets: DatasetRow[] }) {
  const router = useRouter();
  const [chosenId, setChosenId] = useState<string | null>(null);
  const fallback = datasets.find(row => row.project_id === project?.id) || datasets[0];
  const datasetId =
    chosenId || project?.active_dataset_id || (fallback ? datasetRowId(fallback) : '');
  const [tab, setTab] = useState<'sheet' | 'notebook' | 'evidence' | 'themes'>('sheet');
  const [columns, setColumns] = useState<FlowColumn[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [preview, setPreview] = useState<unknown[][]>([]);
  const [pageOffset, setPageOffset] = useState(0);
  const [rowTotal, setRowTotal] = useState(0);
  const pageSize = 50;
  const [query, setQuery] = useState('');
  const [sessions, setSessions] = useState<{ session_id: string }[] | null>(null);
  const [specs, setSpecs] = useState<{ id: string; label: string }[] | null>(null);
  const [sheetPhase, setSheetPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [selectedCol, setSelectedCol] = useState(0);
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [side, setSide] = useState<'agent' | 'variable' | 'evidence'>('variable');
  const [showStats, setShowStats] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [valueFilter, setValueFilter] = useState<string | null>(null);
  const [agentText, setAgentText] = useState('');
  const [agentAnswer, setAgentAnswer] = useState('');
  const [agentStatus, setAgentStatus] = useState<string | null>(null);
  const [anovaOpen, setAnovaOpen] = useState(false);
  const [weightOpen, setWeightOpen] = useState(false);
  const [descError, setDescError] = useState<string | null>(null);
  const surveyCell = useSurveyCell();
  const evidenceSheet = useEvidenceSheet();
  const sheetRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (surveyCell) setSide('evidence');
  }, [surveyCell]);
  useEffect(() => {
    if (!evidenceSheet.focus) return;
    sheetRef.current?.querySelector('[data-evidence="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [evidenceSheet.focus]);
  useEffect(() => {
    if (!datasetId) {
      setSheetPhase('error');
      return;
    }
    setSheetPhase('loading');
    void flowJson<{ columns?: FlowColumn[] }>(`/datasets/${datasetId}/metadata`)
      .then(meta => {
        const rows = meta.columns || [];
        setColumns(rows);
      })
      .catch(() => setColumns([]));
    void flowJson<{ rows?: unknown[][]; headers?: string[]; n_rows?: number }>(
      `/datasets/${datasetId}/preview?limit=${pageSize}&offset=${pageOffset}`
    )
      .then(page => {
        setHeaders(page.headers || []);
        setPreview(page.rows || []);
        setRowTotal(page.n_rows || 0);
        setSheetPhase('ready');
      })
      .catch(() => {
        setPreview([]);
        setHeaders([]);
        setSheetPhase('error');
      });
  }, [datasetId, pageOffset]);
  useEffect(() => {
    if (!project) return;
    void flowJson<{ sessions?: { session_id: string }[] }>(`/api/projects/${project.id}/sessions`)
      .then(page => setSessions(page.sessions || []))
      .catch(() => setSessions([]));
  }, [project]);
  useEffect(() => {
    if (!datasetId) return;
    void flowJson<{ specs?: { spec_id?: string; id?: string; label?: string; name?: string }[] }>(
      `/datasets/${datasetId}/tables`
    )
      .then(page =>
        setSpecs(
          (page.specs || [])
            .map(row => ({
              id: row.spec_id || row.id || '',
              label: row.label || row.name || row.spec_id || 'Saved table',
            }))
            .filter(row => row.id)
        )
      )
      .catch(() => setSpecs([]));
  }, [datasetId]);

  const names = headers.length ? headers : columns.map(column => column.label || column.name);
  const needle = query.trim().toLowerCase();
  const headerHits = names
    .map((name, index) => ({ name, index }))
    .filter(column => !needle || column.name.toLowerCase().includes(needle));
  const shownCols = headerHits.length ? headerHits : names.map((name, index) => ({ name, index }));
  const activeIndex = shownCols[selectedCol]?.index ?? shownCols[0]?.index ?? 0;
  const shownRows = preview
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => {
      if (valueFilter != null) {
        const cell = row[activeIndex];
        const text = cell == null || cell === 'null' ? '' : String(cell);
        if (text !== valueFilter) return false;
      }
      if (!needle || headerHits.length > 0) return true;
      return row.some(cell =>
        String(cell ?? '')
          .toLowerCase()
          .includes(needle)
      );
    });
  const activeName = names[activeIndex] || 'Variable';
  const codedColumn = columns.find(column => {
    const matches = column.name === activeName || column.label === activeName;
    const coded =
      column.name.endsWith('_codes') || String(column.label || '').startsWith('Codes for');
    return matches && coded;
  });
  const activeValues = preview.map(row =>
    row[activeIndex] == null || row[activeIndex] === 'null' ? '' : String(row[activeIndex])
  );
  const counts = valueCounts(activeValues);
  const countTotal = activeValues.length || 1;
  const projectDatasets = datasets.filter(row => !project || row.project_id === project.id);
  const uidIndex = names.indexOf('_row_uid');
  const idIndex = names.findIndex(name =>
    ['id', 'respondent_id', 'respid', 'respondentid'].includes(name.toLowerCase())
  );
  const evidenceIds = new Set(evidenceSheet.ids);
  const evidenceColumn = surveyCell?.textColumn || '';
  const columnMarked = (name: string, index: number) =>
    evidenceColumn ? name === evidenceColumn : index === activeIndex;

  const askAboutColumn = () => {
    const text = agentText.trim();
    if (!text || !datasetId) return;
    setAgentStatus('Warming up');
    setAgentAnswer('');
    void runAgentLoop({
      message: text,
      mode: 'ask',
      datasetId,
      agentVersion: 'v2',
      signal: AbortSignal.timeout(120_000),
    })
      .then(result => {
        setAgentAnswer(result.answer_markdown || '');
        setAgentStatus(null);
      })
      .catch(err => {
        setAgentStatus(err instanceof Error ? err.message : 'The reply did not finish.');
      });
  };

  return (
    <div className="responses-layout">
      <aside className="responses-rail">
        <Input
          value={query}
          placeholder="Search this project"
          aria-label="Search this project"
          onChange={event => setQuery(event.target.value)}
        />
        <div>
          <div className="flow-muted">Chats</div>
          {sessions === null ? (
            <Skeleton className="h-8 w-full" />
          ) : sessions.length === 0 ? (
            <p className="flow-muted">No saved chats yet</p>
          ) : (
            sessions.slice(0, 6).map(session => (
              <div key={session.session_id} className="chat-item">
                {session.session_id.slice(0, 8)}
              </div>
            ))
          )}
        </div>
        <div>
          <div className="flow-muted">Saved analyses {specs?.length || ''}</div>
          {specs === null ? (
            <Skeleton className="h-8 w-full" />
          ) : specs.length === 0 ? (
            <p className="flow-muted">No saved tables yet</p>
          ) : (
            specs.slice(0, 8).map(spec => (
              <Link key={spec.id} href={`/flow/p/${project?.id}/tables`}>
                {spec.label}
              </Link>
            ))
          )}
        </div>
      </aside>
      <section className="responses-sheet">
        <div className="sheet-toolbar">
          <ChoiceSelect
            className="w-[180px] shrink-0"
            aria-label="Dataset"
            value={datasetId || ''}
            onValueChange={nextId => {
              if (!nextId) return;
              setChosenId(nextId);
              setPageOffset(0);
              if (!project) return;
              void flowJson(`/api/projects/${project.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ active_dataset_id: nextId }),
              });
            }}
            options={projectDatasets.map(row => ({
              value: datasetRowId(row),
              label: row.original_filename || datasetRowId(row),
            }))}
          />
          <Segmented
            className="home-segment"
            aria-label="Response view"
            value={tab === 'notebook' ? 'notebook' : tab === 'themes' ? 'themes' : 'sheet'}
            onValueChange={setTab}
            options={[
              { value: 'sheet', label: 'Sheet' },
              { value: 'notebook', label: 'Notebook' },
              { value: 'themes', label: 'Themes' },
            ]}
          />
          <Button
            className="flow-btn"
            type="button"
            data-active={showStats}
            onClick={() => setShowStats(current => !current)}
          >
            Stats
          </Button>
          <Button
            className="flow-btn"
            type="button"
            data-active={showFilters}
            onClick={() => setShowFilters(current => !current)}
          >
            Filters{needle || valueFilter != null ? ' 1' : ''}
          </Button>
          {surveyCell ? (
            <>
              <Button
                className="flow-btn"
                type="button"
                data-active
                onClick={() => setSurveyCell(null)}
              >
                Evidence · {surveyCell.textColumn} · {surveyCell.n || evidenceSheet.ids.length} rows
                ×
              </Button>
              <Button className="flow-btn" type="button" onClick={() => setSurveyCell(null)}>
                Back to all
              </Button>
            </>
          ) : null}
          <span className="sheet-spacer" />
          <Button className="flow-btn" type="button" onClick={() => setWeightOpen(true)}>
            Weight
          </Button>
          <Button className="flow-btn" type="button" onClick={() => setAnovaOpen(true)}>
            ANOVA
          </Button>
          <Button
            className="flow-btn"
            type="button"
            onClick={() => {
              if (!datasetId) return;
              setDescError(null);
              void flowFetch(`/datasets/${datasetId}/analyze/descriptives`, {
                method: 'POST',
                body: JSON.stringify({ columns: dependentColumns(columns).slice(0, 1) }),
              }).then(async response => {
                if (!response.ok) setDescError(await response.text());
                else setDescError(null);
              });
            }}
          >
            Descriptives
          </Button>
        </div>
        {descError ? <p className="flow-error">{descError}</p> : null}
        {showFilters ? (
          <div className="sheet-toolbar">
            <span className="flow-muted">
              {valueFilter != null
                ? `${activeName} is ${valueFilter || 'blank'} on this page`
                : needle
                  ? 'Search matches column names, or rows on this page when no column matches.'
                  : 'Search the rail, or click a code in the variable panel.'}
            </span>
            {needle || valueFilter != null ? (
              <Button
                className="flow-btn"
                type="button"
                onClick={() => {
                  setQuery('');
                  setValueFilter(null);
                  setShowFilters(false);
                }}
              >
                Clear
              </Button>
            ) : null}
          </div>
        ) : null}
        {tab === 'notebook' ? <Notebook datasetId={datasetId} /> : null}
        {tab === 'themes' ? (
          <ThemesPanel
            datasetId={datasetId}
            projectId={project?.id}
            onSelectCell={cell => {
              setSurveyCell(cell);
              setSide('evidence');
            }}
            onEditFrame={column => {
              const match = columns.find(item => item.name === column);
              const header = match?.label || column;
              const position = shownCols.findIndex(
                item => item.name === header || item.name === column
              );
              if (position >= 0) setSelectedCol(position);
              setSide('variable');
            }}
          />
        ) : null}
        {tab === 'sheet' || tab === 'evidence' ? (
          sheetPhase === 'loading' ? (
            <div className="sheet-scroll" aria-busy="true">
              {Array.from({ length: 8 }, (_, index) => (
                <Skeleton key={index} className="mb-2 h-8 w-full" />
              ))}
            </div>
          ) : sheetPhase === 'error' ? (
            <p className="flow-error">Could not load this sheet.</p>
          ) : (
            <>
              <div ref={sheetRef} className="sheet-scroll">
                <ScrollArea className="sheet-scroll">
                  <Table className="flow-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        {shownCols.map((column, position) => (
                          <th key={`${column.name}-${column.index}`}>
                            <Button
                              type="button"
                              className="sheet-col"
                              data-active={columnMarked(column.name, column.index)}
                              onClick={() => {
                                setSelectedCol(position);
                                if (!surveyCell) setSide('variable');
                              }}
                            >
                              {column.name}
                              {showStats ? (
                                <ColumnSpark
                                  values={shownRows.map(({ row }) =>
                                    String(row[column.index] ?? '')
                                  )}
                                />
                              ) : null}
                            </Button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {shownRows.map(({ row, index }) => {
                        const inEvidence =
                          (uidIndex >= 0 && evidenceIds.has(String(row[uidIndex] ?? ''))) ||
                          (idIndex >= 0 && evidenceIds.has(String(row[idIndex] ?? '')));
                        return (
                          <tr
                            key={index}
                            data-active={selectedRow === index}
                            data-evidence={inEvidence || undefined}
                            onClick={() => setSelectedRow(index)}
                          >
                            <td>
                              <Button type="button" onClick={() => setSelectedRow(index)}>
                                {pageOffset + index + 1}
                              </Button>
                            </td>
                            {shownCols.map(column => (
                              <td
                                key={column.index}
                                className="sheet-cell"
                                data-active={columnMarked(column.name, column.index)}
                              >
                                {row[column.index] == null || row[column.index] === 'null'
                                  ? ''
                                  : String(row[column.index])}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </ScrollArea>
              </div>
              <div className="sheet-foot">
                <span>
                  {rowTotal} respondent{rowTotal === 1 ? '' : 's'}
                </span>
                <span>
                  {selectedRow == null
                    ? 'No row selected'
                    : `Row ${pageOffset + selectedRow + 1} selected`}
                </span>
                <span>
                  <Button
                    className="flow-btn"
                    type="button"
                    disabled={pageOffset === 0}
                    onClick={() => setPageOffset(current => Math.max(0, current - pageSize))}
                  >
                    Previous
                  </Button>
                  <Button
                    className="flow-btn"
                    type="button"
                    disabled={pageOffset + pageSize >= rowTotal}
                    onClick={() => setPageOffset(current => current + pageSize)}
                  >
                    Next
                  </Button>
                </span>
              </div>
            </>
          )
        ) : null}
      </section>
      <aside className="responses-side">
        <div className="sheet-toolbar">
          <Segmented
            className="home-segment"
            aria-label="Response panel"
            value={side}
            onValueChange={setSide}
            options={[
              { value: 'agent', label: 'Agent' },
              { value: 'variable', label: 'Variable' },
              { value: 'evidence', label: 'Evidence' },
            ]}
          />
        </div>
        {side === 'evidence' ? (
          <EvidencePanel datasetId={datasetId} projectId={project?.id} />
        ) : (
          <ScrollArea className="sheet-scroll">
            {side === 'variable' && codedColumn ? (
              <CodeFrameRail
                datasetId={datasetId}
                column={codedColumn.name}
                title={codedColumn.label || codedColumn.name}
                values={activeValues}
                onFilter={value => {
                  setValueFilter(value);
                  setShowFilters(true);
                }}
                onUseAsBanner={() => {
                  if (project?.id) router.push(`/flow/p/${project.id}/tables`);
                }}
              />
            ) : null}
            {side === 'variable' && !codedColumn ? (
              <div className="output-body">
                <div className="flow-muted">On this page</div>
                <h2>{activeName}</h2>
                <div className="flow-muted">{counts.length} values in the loaded rows</div>
                {counts.map(item => (
                  <Button
                    key={item.label}
                    type="button"
                    className="value-row"
                    data-active={valueFilter === (item.label === '—' ? '' : item.label)}
                    onClick={() => {
                      setValueFilter(item.label === '—' ? '' : item.label);
                      setShowFilters(true);
                    }}
                  >
                    <span className="value-row-grid">
                      <span>{item.label}</span>
                      <span className="value-track">
                        <i style={{ width: `${Math.round((item.count / countTotal) * 100)}%` }} />
                      </span>
                      <span>{item.count}</span>
                    </span>
                  </Button>
                ))}
              </div>
            ) : null}
            {side === 'agent' ? (
              <div className="output-body">
                <Textarea
                  value={agentText}
                  placeholder={`Ask about ${activeName}`}
                  onChange={event => setAgentText(event.target.value)}
                />
                <Button className="flow-btn primary" type="button" onClick={askAboutColumn}>
                  Ask
                </Button>
                {agentStatus ? <p className="flow-status">{agentStatus}</p> : null}
                {agentAnswer ? (
                  <article dangerouslySetInnerHTML={{ __html: plain(agentAnswer) }} />
                ) : null}
              </div>
            ) : null}
          </ScrollArea>
        )}
      </aside>
      {anovaOpen ? (
        <AnovaModal columns={columns} datasetId={datasetId} onClose={() => setAnovaOpen(false)} />
      ) : null}
      {weightOpen ? (
        <WeightPanel
          datasetId={datasetId}
          datasets={projectDatasets}
          onClose={() => setWeightOpen(false)}
          onAdopted={nextId => {
            if (!project) return;
            void flowJson(`/api/projects/${project.id}`, {
              method: 'PATCH',
              body: JSON.stringify({ active_dataset_id: nextId }),
            });
          }}
        />
      ) : null}
    </div>
  );
}

function notebookText(result: {
  stdout?: string | null;
  output?: unknown;
  error?: string | null;
}): string {
  if (typeof result.error === 'string' && result.error) return result.error;
  if (typeof result.stdout === 'string' && result.stdout) return result.stdout;
  if (typeof result.output === 'string') return result.output;
  if (result.output == null) return '';
  try {
    return JSON.stringify(result.output, null, 2);
  } catch {
    return 'The notebook returned a value that could not be shown.';
  }
}

function Notebook({ datasetId }: { datasetId?: string }) {
  const [code, setCode] = useState('df.head()');
  const [output, setOutput] = useState('');
  return (
    <div className="flow-panel">
      <h2>Notebook</h2>
      <p className="flow-muted">
        Read-only on the open dataset. Publishing a table is the only write-back.
      </p>
      <Textarea
        className="flow-text"
        value={code}
        onChange={event => setCode(event.target.value)}
      />
      <Button
        className="flow-btn"
        type="button"
        onClick={() => {
          void flowJson<{ stdout?: string | null; output?: unknown; error?: string | null }>(
            '/api/execute/python',
            {
              method: 'POST',
              body: JSON.stringify({ code, dataset_id: datasetId, save_as_dataset: false }),
            }
          )
            .then(result => setOutput(notebookText(result)))
            .catch(err =>
              setOutput(err instanceof Error ? err.message : 'The notebook could not run')
            );
        }}
      >
        Run
      </Button>
      <pre>{output}</pre>
    </div>
  );
}

function AnovaModal({
  columns,
  datasetId,
  onClose,
}: {
  columns: FlowColumn[];
  datasetId?: string;
  onClose: () => void;
}) {
  const options = useMemo(() => dependentColumns(columns), [columns]);
  const groups = columns.map(column => column.name).filter(name => name && !options.includes(name));
  const [dependent, setDependent] = useState(options[0] || '');
  const [group, setGroup] = useState(groups[0] || '');
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div className="flow-palette" onClick={onClose}>
      <div onClick={event => event.stopPropagation()}>
        <h2>ANOVA</h2>
        <label>
          Dependent
          <ChoiceSelect
            className="flow-input"
            value={dependent}
            onValueChange={setDependent}
            options={[...options.map(name => ({ value: name, label: name }))]}
          />
        </label>
        <label>
          Group
          <ChoiceSelect
            className="flow-input"
            value={group}
            onValueChange={setGroup}
            options={[...groups.map(name => ({ value: name, label: name }))]}
          />
        </label>
        <Button
          className="flow-btn primary"
          type="button"
          onClick={() => {
            if (!datasetId || !dependent || !group) {
              setMessage('Choose a dependent column and a group.');
              return;
            }
            void flowFetch(`/datasets/${datasetId}/analyze/anova_oneway`, {
              method: 'POST',
              body: JSON.stringify({ value_column: dependent, group_column: group }),
            }).then(async response =>
              setMessage(response.ok ? 'ANOVA ran.' : await response.text())
            );
          }}
        >
          Run
        </Button>
        {message ? <p>{message}</p> : null}
      </div>
    </div>
  );
}

function TablesScreen({ project, datasets }: { project?: FlowProject; datasets: DatasetRow[] }) {
  const datasetId =
    project?.active_dataset_id || datasets.find(row => row.project_id === project?.id)?.dataset_id;
  return <TablesBuilder datasetId={datasetId} projectId={project?.id} />;
}

function ReportScreen({
  projectId,
  project,
  datasets,
}: {
  projectId: string;
  project?: FlowProject;
  datasets: DatasetRow[];
}) {
  const datasetId =
    project?.active_dataset_id || datasets.find(row => row.project_id === projectId)?.dataset_id;
  const [specs, setSpecs] = useState<
    { id: string; label: string; spec: Record<string, unknown> }[]
  >([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [template, setTemplate] = useState<string>('');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!datasetId) return;
    void flowJson<{ specs?: { spec_id?: string; id?: string; label?: string; name?: string }[] }>(
      `/datasets/${datasetId}/tables`
    )
      .then(async page => {
        const rows = page.specs || [];
        const loaded = await Promise.all(
          rows.map(async row => {
            const id = row.spec_id || row.id || '';
            const detail = await flowJson<{ spec?: Record<string, unknown> }>(
              `/datasets/${datasetId}/tables/${id}`
            );
            return { id, label: row.label || row.name || id, spec: detail.spec || {} };
          })
        );
        setSpecs(loaded.filter(row => row.id));
        setPicked(loaded.map(row => row.id).filter(Boolean));
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Could not load saved tables'));
  }, [datasetId]);

  const selected = specs.filter(row => picked.includes(row.id));

  const deck = async () => {
    if (!datasetId || !selected.length) {
      setError('Save a table before building a deck.');
      return;
    }
    setError('');
    const created = await flowJson<{ export_id?: string; filename?: string }>(
      `/datasets/${datasetId}/export/deck`,
      {
        method: 'POST',
        body: JSON.stringify({
          spec_ids: selected.map(row => row.id),
          ...(template ? { template_base64: template } : {}),
        }),
      }
    );
    if (!created.export_id) throw new Error('The deck export did not return a file.');
    await downloadExport(`/exports/${created.export_id}`, created.filename || 'deck.pptx');
    setNote('Deck downloaded.');
  };

  const bannerBook = async () => {
    if (!datasetId || !selected.length) {
      setError('Save a table before building a banner book.');
      return;
    }
    setError('');
    const saved = await flowJson<{ book?: { id?: string } }>(
      `/datasets/${datasetId}/banner-books`,
      {
        method: 'POST',
        body: JSON.stringify({
          name: 'Banner book',
          specs: selected.map(row => row.spec).filter(spec => Object.keys(spec).length),
        }),
      }
    );
    const bookId = saved.book?.id;
    if (!bookId) throw new Error('The banner book was not saved.');
    await downloadExport(
      `/datasets/${datasetId}/banner-books/${bookId}/export.xlsx`,
      'banner-book.xlsx',
      {
        method: 'POST',
        body: JSON.stringify({ target_dataset_id: datasetId, mapping: {} }),
      }
    );
    setNote('Banner book downloaded.');
  };

  const topline = async () => {
    if (!datasetId || !selected[0]) {
      setError('Save a table before building a topline.');
      return;
    }
    setError('');
    await downloadExport(
      `/datasets/${datasetId}/tables/${selected[0].id}/export.docx`,
      'topline.docx'
    );
    setNote('Topline downloaded.');
  };

  return (
    <div className="report-page">
      <p className="flow-soon">Up to date · regenerates from saved tables</p>
      <h1>{project?.name || 'Report'}</h1>
      <p className="flow-muted">
        {selected.length} saved table{selected.length === 1 ? '' : 's'} · Fielding coming soon
      </p>
      <div className="report-head">
        <div>
          <h2>Deliverables</h2>
          <p className="flow-muted">Built from this project&apos;s saved tables.</p>
        </div>
      </div>
      {error ? <p className="flow-error">{error}</p> : null}
      {note ? <p>{note}</p> : null}
      <div className="report-cards">
        <Card>
          <Badge>PPTX</Badge>
          <strong>Client deck</strong>
          <p>From the saved tables</p>
          <label>
            Template
            <Input
              type="file"
              accept=".pptx"
              onChange={event => {
                const file = event.target.files?.[0];
                if (!file) {
                  setTemplate('');
                  return;
                }
                void fileToBase64(file).then(setTemplate);
              }}
            />
          </label>
          <Button
            type="button"
            onClick={() => void deck().catch(err => setError(String(err.message || err)))}
          >
            Download
          </Button>
        </Card>
        <Card>
          <Badge>XLSX</Badge>
          <strong>Banner book</strong>
          <p>Every saved table</p>
          <Button
            type="button"
            onClick={() => void bannerBook().catch(err => setError(String(err.message || err)))}
          >
            Download
          </Button>
        </Card>
        <Card>
          <Badge>DOCX</Badge>
          <strong>Topline summary</strong>
          <p>The first saved table</p>
          <Button
            type="button"
            onClick={() => void topline().catch(err => setError(String(err.message || err)))}
          >
            Download
          </Button>
        </Card>
      </div>
    </div>
  );
}

function InterviewsScreen({
  projectId,
  project,
  datasets,
}: {
  projectId: string;
  project?: FlowProject;
  datasets: DatasetRow[];
}) {
  const datasetId =
    project?.active_dataset_id || datasets.find(row => row.project_id === projectId)?.dataset_id;
  const [label, setLabel] = useState('');
  const [themes, setThemes] = useState<string[]>([]);
  const [theme, setTheme] = useState('');
  const [rows, setRows] = useState<
    {
      id: string;
      filename?: string;
      passage_count?: number;
      passages_index?: { passage_id: string; speaker?: string; start?: string; end?: string }[];
    }[]
  >([]);
  const [code, setCode] = useState('');
  const load = useCallback(() => {
    const query = theme ? `?theme=${encodeURIComponent(theme)}` : '';
    void flowJson<{
      interviews?: {
        id: string;
        filename?: string;
        passage_count?: number;
        passages_index?: { passage_id: string; speaker?: string; start?: string; end?: string }[];
      }[];
      themes?: string[];
      count_label?: string;
    }>(`/api/projects/${projectId}/interviews${query}`)
      .then(page => {
        setRows(page.interviews || []);
        setThemes(page.themes || []);
        setLabel(page.count_label || '');
      })
      .catch(err => setLabel(err instanceof Error ? err.message : 'Could not load interviews'));
  }, [projectId, theme]);
  useEffect(() => {
    load();
  }, [load]);
  return (
    <div className="flow-split">
      <div className="flow-panel">
        <h2>Interviews</h2>
        <p>{label}</p>
        <label>
          Theme
          <ChoiceSelect
            className="flow-input"
            value={theme}
            onValueChange={setTheme}
            options={[
              { value: '', label: 'All themes' },
              ...themes.map(item => ({ value: item, label: item })),
            ]}
          />
        </label>
        <p className="flow-muted">
          Counts only. These passages are not added to survey percentages. No audio.
        </p>
        <Input
          type="file"
          accept=".txt,.vtt,.docx"
          onChange={event => {
            const file = event.target.files?.[0];
            if (!file) return;
            const body = new FormData();
            body.append('upload', file);
            void flowFetch(`/api/projects/${projectId}/interviews`, { method: 'POST', body }).then(
              () => load()
            );
          }}
        />
        {rows.map(row => (
          <div key={row.id}>
            <div>
              {row.filename} · {row.passage_count} passages
            </div>
            {(row.passages_index || []).slice(0, 8).map(passage => (
              <form
                key={passage.passage_id}
                onSubmit={event => {
                  event.preventDefault();
                  if (!code.trim()) return;
                  void flowJson(`/api/projects/${projectId}/interviews/${row.id}/codes`, {
                    method: 'POST',
                    body: JSON.stringify({ passage_id: passage.passage_id, code }),
                  }).then(() => load());
                }}
              >
                <span>
                  {passage.speaker || 'Speaker'} {passage.start || ''}–{passage.end || ''}
                </span>
                <Input
                  className="flow-input"
                  value={code}
                  placeholder="Code"
                  onChange={event => setCode(event.target.value)}
                />
                <Button className="flow-btn" type="submit">
                  Code passage
                </Button>
              </form>
            ))}
          </div>
        ))}
      </div>
      <CodeFramePanel
        datasetId={datasetId}
        datasets={datasets.filter(row => row.project_id === projectId)}
      />
    </div>
  );
}

function plain(markdown: string): string {
  return markdown
    .replace(/[&<>]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char] || char)
    .replace(/\n/g, '<br/>');
}
