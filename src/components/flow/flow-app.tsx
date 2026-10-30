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
import { runAgentLoop } from '@/lib/run-agent-loop';
import { AnalysisSetupHost } from '@/components/templates/analysis/analysis-setup-provider';
import {
  getAnalysisOpForMenuName,
  isDialogMenuItem,
} from '@/configs/analysis-config/menu-registry';
import { getAllAnalysisItems, type AnalysisItem } from '@/configs/analysis-config/utils';
import { useAnalysisSetupStore } from '@/stores/analysis-setup-store';
import { useTabsStore, ViewType } from '@/stores/tabs-store';
import {
  CodeFramePanel,
  datasetRowId,
  downloadExport,
  EvidencePanel,
  fileToBase64,
  setSurveyCell,
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

const PROJECT_TABS = [
  ['chat', 'Chat'],
  ['sources', 'Sources'],
  ['responses', 'Responses'],
  ['tables', 'Tables'],
  ['report', 'Report'],
  ['interviews', 'Interviews'],
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the workspace');
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) void reload();
  }, [isAuthenticated, reload]);

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

  return (
    <SubscriptionGate>
      <div className="flow">
        <aside className="flow-side">
          <div className="flow-brand">
            <strong>Tensr</strong>
            <span>workspace</span>
          </div>
          <nav className="flow-nav">
            <button type="button" onClick={() => router.push('/flow')}>
              New project
            </button>
            <button type="button" onClick={() => setPalette(true)}>
              Search <span className="flow-muted">⌘K</span>
            </button>
            <Link href="/flow">Home</Link>
            <button type="button" data-active={section === 'projects'}>
              Datasets <span className="flow-muted">{datasets.length}</span>
            </button>
            <Link href="/flow/plugins">Plugins</Link>
          </nav>
          <div>
            <div className="flow-muted">Folders</div>
            {folders.map(folder => (
              <button
                key={folder.id}
                className="flow-folder"
                type="button"
                data-active={folderName === folder.name}
                onClick={() => {
                  setFolderName(folder.name);
                  router.push('/flow');
                }}
              >
                {folder.name}
              </button>
            ))}
            <FolderCreate onCreated={reload} />
          </div>
          <button
            type="button"
            className="flow-muted"
            onClick={() => {
              window.localStorage.setItem('tensr-classic', '1');
              router.push('/dashboard?classic=1');
            }}
          >
            Classic workspace
          </button>
        </aside>
        <div className="flow-main">
          <header className="flow-top">
            <div>
              <div className="flow-muted">{project ? 'Project' : 'Workspace'}</div>
              <h1>{project?.name || 'Projects'}</h1>
            </div>
            {projectId ? (
              <nav className="flow-tabs">
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
            ) : null}
          </header>
          <div className="flow-body">
            {error ? <p className="flow-error">{error}</p> : null}
            {section === 'plugins' ? (
              <PluginsScreen />
            ) : section === 'projects' || !projectId ? (
              <ProjectsScreen
                projects={projects}
                datasets={datasets}
                folderName={folderName}
                onCreated={reload}
              />
            ) : section === 'sources' ? (
              <SourcesScreen projectId={projectId} datasets={datasets} />
            ) : section === 'responses' ? (
              <ResponsesScreen project={project} datasets={datasets} />
            ) : section === 'tables' ? (
              <TablesScreen project={project} datasets={datasets} />
            ) : section === 'report' ? (
              <ReportScreen projectId={projectId} project={project} datasets={datasets} />
            ) : section === 'interviews' ? (
              <InterviewsScreen projectId={projectId} project={project} datasets={datasets} />
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
        <AnalysisSetupHost />
      </div>
    </SubscriptionGate>
  );
}

function FolderCreate({ onCreated }: { onCreated: () => Promise<void> }) {
  const [name, setName] = useState('');
  return (
    <form
      onSubmit={event => {
        event.preventDefault();
        if (!name.trim()) return;
        void flowJson('/api/project-folders', {
          method: 'POST',
          body: JSON.stringify({ name }),
        }).then(() => {
          setName('');
          return onCreated();
        });
      }}
    >
      <input
        className="flow-input"
        value={name}
        placeholder="New folder"
        onChange={event => setName(event.target.value)}
      />
    </form>
  );
}

function ProjectsScreen({
  projects,
  datasets,
  folderName,
  onCreated,
}: {
  projects: FlowProject[];
  datasets: DatasetRow[];
  folderName: string | null;
  onCreated: () => Promise<void>;
}) {
  const [mode, setMode] = useState<'cards' | 'table'>('cards');
  const [filter, setFilter] = useState<'active' | 'mine' | 'archived'>('active');
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const shown = projects.filter(project => {
    const status = project.status || 'active';
    if (folderName && (project.folder || '') !== folderName) return false;
    if (filter === 'archived') return status === 'archived';
    if (status === 'archived') return false;
    if (query && !project.name.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });
  return (
    <div>
      <div className="flow-tabs" style={{ marginBottom: 16 }}>
        <button
          className="flow-chip"
          type="button"
          data-active={mode === 'cards'}
          onClick={() => setMode('cards')}
        >
          Cards
        </button>
        <button
          className="flow-chip"
          type="button"
          data-active={mode === 'table'}
          onClick={() => setMode('table')}
        >
          Table
        </button>
        {(['active', 'mine', 'archived'] as const).map(item => (
          <button
            key={item}
            className="flow-chip"
            type="button"
            data-active={filter === item}
            onClick={() => setFilter(item)}
          >
            {item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}
        <input
          className="flow-input"
          style={{ maxWidth: 220 }}
          value={query}
          placeholder="Search projects"
          onChange={event => setQuery(event.target.value)}
        />
      </div>
      <form
        onSubmit={event => {
          event.preventDefault();
          void flowJson('/api/projects', {
            method: 'POST',
            body: JSON.stringify({ name: name || 'Untitled' }),
          }).then(() => {
            setName('');
            return onCreated();
          });
        }}
        style={{ marginBottom: 16, display: 'flex', gap: 8 }}
      >
        <input
          className="flow-input"
          value={name}
          placeholder="Project name"
          onChange={event => setName(event.target.value)}
        />
        <button className="flow-btn primary" type="submit">
          Create
        </button>
      </form>
      {mode === 'cards' ? (
        <div className="flow-grid">
          {shown.map(project => (
            <ProjectCard key={project.id} project={project} datasets={datasets} />
          ))}
        </div>
      ) : (
        <table className="flow-table">
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
                  <button
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
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="flow-muted">
        New projects start from a .sav, .csv, or .xlsx. Recruiting on Prolific and live Qualtrics
        sync are coming soon. Fielding targets are not shown.
      </p>
    </div>
  );
}

function ProjectCard({ project, datasets }: { project: FlowProject; datasets: DatasetRow[] }) {
  const count = datasets.filter(row => row.project_id === project.id).length;
  return (
    <Link href={`/flow/p/${project.id}/chat`} className="flow-card">
      <div className="flow-muted">{project.folder || 'No folder'}</div>
      <h2>{project.name}</h2>
      <div>{count} datasets</div>
      <div className="flow-muted">{project.status || 'active'}</div>
    </Link>
  );
}

function Members({ projectId }: { projectId: string }) {
  const [label, setLabel] = useState('…');
  useEffect(() => {
    void flowJson<{ members?: { user_id: string }[] }>(`/api/projects/${projectId}/members`)
      .then(page =>
        setLabel(
          (page.members || []).map(item => item.user_id.slice(0, 2).toUpperCase()).join(' ') || '—'
        )
      )
      .catch(() => setLabel('—'));
  }, [projectId]);
  return <span>{label}</span>;
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
      <input
        className="flow-input"
        style={{ maxWidth: 280, marginBottom: 16 }}
        value={query}
        placeholder="Search plugins"
        onChange={event => setQuery(event.target.value)}
      />
      <div className="flow-grid">
        {shown.map(row => (
          <article key={row.id || row.name} className="flow-card">
            <h2>{row.name}</h2>
            <p className="flow-muted">{row.summary || 'Installed from the plugin catalog.'}</p>
            <span className="flow-soon">Ratings coming soon</span>
          </article>
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
      <div onClick={event => event.stopPropagation()}>
        <input
          className="flow-input"
          autoFocus
          value={query}
          placeholder="Search analyses"
          onChange={event => {
            setQuery(event.target.value);
            setIndex(0);
          }}
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
        />
        {analyses.map((item, itemIndex) => (
          <button
            key={`${item.section}-${item.name}`}
            className="flow-pick"
            type="button"
            data-active={item.name === chosen?.name && itemIndex === index}
            onClick={() => openSetup(item)}
            onDoubleClick={() => onAsk(item.name)}
          >
            {item.name}
            <span className="flow-muted"> {item.section}</span>
          </button>
        ))}
        <p className="flow-muted">
          {datasetId ? 'Dataset open' : 'No dataset open'} · Enter opens setup. ⌘Enter asks the
          agent.
        </p>
      </div>
    </div>
  );
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
  const [answer, setAnswer] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [downloads, setDownloads] = useState<ExportDownload[]>([]);
  const askedRef = useRef<string | null>(null);
  const [sessions, setSessions] = useState<{ session_id: string }[]>([]);
  const [recipes, setRecipes] = useState<{ name?: string; recipe_id?: string }[]>([]);

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
    async (text: string) => {
      if (!text.trim() || status === 'Warming up') return;
      setQuestion(text);
      setStatus('Warming up');
      try {
        const result = await runAgentLoop({
          message: text,
          mode: 'agent',
          datasetId: datasetId || null,
          agentVersion: 'v2',
        });
        setAnswer(result.answer_markdown || '');
        const entries = (result.tool_results || []).flatMap(item => {
          const nested =
            item.result && typeof item.result === 'object'
              ? [item.result as Record<string, unknown>]
              : [];
          return [item as unknown as Record<string, unknown>, ...nested];
        });
        setDownloads(downloadsFromToolResults(entries));
        setQuestion('');
        setStatus(null);
      } catch (err) {
        setStatus(err instanceof Error ? err.message : 'The reply did not finish. Ask again.');
      }
    },
    [datasetId, status]
  );

  useEffect(() => {
    if (!pendingAsk || askedRef.current === pendingAsk) return;
    askedRef.current = pendingAsk;
    onAsked?.();
    void sendText(pendingAsk);
  }, [pendingAsk, onAsked, sendText]);

  const send = () => void sendText(question);

  return (
    <div className="flow-split">
      <section>
        <div className="flow-muted">Chats</div>
        {sessions.map(session => (
          <div key={session.session_id}>{session.session_id.slice(0, 8)}</div>
        ))}
        <div className="flow-muted">Recipes</div>
        {recipes.map(recipe => (
          <div key={recipe.recipe_id}>{recipe.name}</div>
        ))}
        {answer ? (
          <article className="flow-panel" dangerouslySetInnerHTML={{ __html: plain(answer) }} />
        ) : null}
        {downloads.map(file => (
          <button
            key={file.key}
            className="flow-btn"
            type="button"
            onClick={() => void openSignedDownload(file)}
          >
            {file.filename}
          </button>
        ))}
        {status ? <p className="flow-error">{status}</p> : null}
        <textarea
          className="flow-text"
          value={question}
          onChange={event => setQuestion(event.target.value)}
          placeholder="Ask about this project"
        />
        <button
          className="flow-btn primary"
          type="button"
          disabled={status === 'Warming up'}
          onClick={() => void send()}
        >
          Send
        </button>
      </section>
      <SidePanel datasetId={datasetId} />
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
    <aside className="flow-panel">
      <h2>Ask</h2>
      <textarea
        className="flow-text"
        value={question}
        onChange={event => setQuestion(event.target.value)}
      />
      <button
        className="flow-btn"
        type="button"
        disabled={phase === 'warming'}
        onClick={() => void ask()}
      >
        Ask about the open table
      </button>
      {phase === 'warming' ? <p>Warming up</p> : null}
      {phase === 'error' ? <p className="flow-error">{note}</p> : null}
    </aside>
  );
}

function SourcesScreen({ projectId, datasets }: { projectId: string; datasets: DatasetRow[] }) {
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
        <input
          className="flow-input"
          value={name}
          onChange={event => setName(event.target.value)}
        />
        <textarea
          className="flow-text"
          value={text}
          onChange={event => setText(event.target.value)}
          placeholder="Questionnaire or brief"
        />
        <button
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
        </button>
      </section>
      <section className="flow-panel">
        <h2>Stack waves</h2>
        <Link href={`/flow/p/${projectId}/sources`}>Review mapping is on the stack screen.</Link>
        <StackScreen projectId={projectId} datasets={datasets} embedded />
      </section>
    </div>
  );
}

function StackScreen({
  projectId,
  datasets,
  embedded,
}: {
  projectId: string;
  datasets: DatasetRow[];
  embedded?: boolean;
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
      {mine.map(row => {
        const id = datasetRowId(row);
        return (
          <label key={id} className="flow-row">
            <input
              type="checkbox"
              checked={picked.includes(id)}
              onChange={event => {
                setPicked(current =>
                  event.target.checked ? [...current, id] : current.filter(item => item !== id)
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
          <select
            className="flow-input"
            aria-label={`Decision for ${column}`}
            value={decisions[column] || 'accept'}
            onChange={event =>
              setDecisions(current => ({
                ...current,
                [column]: event.target.value as 'accept' | 'override' | 'skip',
              }))
            }
          >
            <option value="accept">Accept</option>
            <option value="override">Override</option>
            <option value="skip">Skip</option>
          </select>
          {decisions[column] === 'override' ? (
            <input
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
      <button className="flow-btn primary" type="button" onClick={save}>
        Save
      </button>
    </div>
  );
}

function ResponsesScreen({ project, datasets }: { project?: FlowProject; datasets: DatasetRow[] }) {
  const datasetId =
    project?.active_dataset_id ||
    datasets.find(row => row.project_id === project?.id)?.dataset_id ||
    datasets[0]?.dataset_id;
  const [tab, setTab] = useState<'sheet' | 'notebook' | 'evidence' | 'themes'>('sheet');
  const [columns, setColumns] = useState<FlowColumn[]>([]);
  const [preview, setPreview] = useState<string[][]>([]);
  const [anovaOpen, setAnovaOpen] = useState(false);
  const [weightOpen, setWeightOpen] = useState(false);
  const [descError, setDescError] = useState<string | null>(null);
  const surveyCell = useSurveyCell();
  useEffect(() => {
    if (surveyCell) setTab('evidence');
  }, [surveyCell]);
  useEffect(() => {
    if (!datasetId) return;
    void flowJson<{ columns?: FlowColumn[] }>(`/datasets/${datasetId}/metadata`)
      .then(meta => {
        const rows = meta.columns || [];
        setColumns(rows);
      })
      .catch(() => setColumns([]));
    void flowJson<{ rows?: string[][] }>(`/datasets/${datasetId}/preview`)
      .then(page => setPreview(page.rows || []))
      .catch(() => setPreview([]));
  }, [datasetId]);
  return (
    <div>
      <div className="flow-tabs" style={{ marginBottom: 12 }}>
        {(['sheet', 'notebook', 'evidence', 'themes'] as const).map(item => (
          <button
            key={item}
            className="flow-chip"
            type="button"
            data-active={tab === item}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
        <button className="flow-btn" type="button" onClick={() => setWeightOpen(true)}>
          Weight
        </button>
        <button className="flow-btn" type="button" onClick={() => setAnovaOpen(true)}>
          ANOVA
        </button>
      </div>
      {tab === 'sheet' ? (
        <div>
          <table className="flow-table">
            <tbody>
              {preview.slice(0, 8).map((row, index) => (
                <tr key={index}>
                  {row.slice(0, 6).map((cell, cellIndex) => (
                    <td key={cellIndex}>{String(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <button
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
              });
            }}
          >
            Descriptives
          </button>
          {descError ? <p className="flow-error">{descError}</p> : null}
        </div>
      ) : null}
      {tab === 'notebook' ? <Notebook datasetId={datasetId} /> : null}
      {tab === 'evidence' ? <EvidencePanel datasetId={datasetId} /> : null}
      {tab === 'themes' ? (
        <ThemesPanel
          datasetId={datasetId}
          onSelectCell={cell => {
            setSurveyCell(cell);
            setTab('evidence');
          }}
        />
      ) : null}
      {anovaOpen ? (
        <AnovaModal columns={columns} datasetId={datasetId} onClose={() => setAnovaOpen(false)} />
      ) : null}
      {weightOpen ? (
        <WeightPanel
          datasetId={datasetId}
          datasets={datasets.filter(row => !project || row.project_id === project.id)}
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

function Notebook({ datasetId }: { datasetId?: string }) {
  const [code, setCode] = useState('df.head()');
  const [output, setOutput] = useState('');
  return (
    <div className="flow-panel">
      <h2>Notebook</h2>
      <p className="flow-muted">
        Read-only on the open dataset. Publishing a table is the only write-back.
      </p>
      <textarea
        className="flow-text"
        value={code}
        onChange={event => setCode(event.target.value)}
      />
      <button
        className="flow-btn"
        type="button"
        onClick={() => {
          void flowJson<{ output?: string; error?: string }>('/api/execute/python', {
            method: 'POST',
            body: JSON.stringify({ code, dataset_id: datasetId, save_as_dataset: false }),
          })
            .then(result => setOutput(result.error || result.output || ''))
            .catch(err =>
              setOutput(err instanceof Error ? err.message : 'The notebook could not run')
            );
        }}
      >
        Run
      </button>
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
          <select
            className="flow-input"
            value={dependent}
            onChange={event => setDependent(event.target.value)}
          >
            {options.map(name => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
        <label>
          Group
          <select
            className="flow-input"
            value={group}
            onChange={event => setGroup(event.target.value)}
          >
            {groups.map(name => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
        <button
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
        </button>
        {message ? <p>{message}</p> : null}
      </div>
    </div>
  );
}

function TablesScreen({ project, datasets }: { project?: FlowProject; datasets: DatasetRow[] }) {
  const datasetId =
    project?.active_dataset_id || datasets.find(row => row.project_id === project?.id)?.dataset_id;
  return (
    <div className="flow-split">
      <TablesBuilder datasetId={datasetId} projectId={project?.id} />
      <SidePanel datasetId={datasetId} />
    </div>
  );
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
    <div className="flow-panel">
      <h2>Report</h2>
      <p className="flow-muted">Deck, banner book, and topline come from the saved tables.</p>
      {specs.map(row => (
        <label key={row.id} className="flow-row">
          <input
            type="checkbox"
            checked={picked.includes(row.id)}
            onChange={event =>
              setPicked(current =>
                event.target.checked ? [...current, row.id] : current.filter(id => id !== row.id)
              )
            }
          />
          {row.label}
        </label>
      ))}
      <label>
        PowerPoint template
        <input
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
      {error ? <p className="flow-error">{error}</p> : null}
      {note ? <p>{note}</p> : null}
      <div className="flow-row">
        <button
          className="flow-btn primary"
          type="button"
          onClick={() => void deck().catch(err => setError(String(err.message || err)))}
        >
          Deck
        </button>
        <button
          className="flow-btn"
          type="button"
          onClick={() => void bannerBook().catch(err => setError(String(err.message || err)))}
        >
          Banner book
        </button>
        <button
          className="flow-btn"
          type="button"
          onClick={() => void topline().catch(err => setError(String(err.message || err)))}
        >
          Topline
        </button>
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
    }>(`/api/projects/${projectId}/interviews${query}`).then(page => {
      setRows(page.interviews || []);
      setThemes(page.themes || []);
      setLabel(page.count_label || '');
    });
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
          <select
            className="flow-input"
            value={theme}
            onChange={event => setTheme(event.target.value)}
          >
            <option value="">All themes</option>
            {themes.map(item => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <p className="flow-muted">
          Counts only. These passages are not added to survey percentages. No audio.
        </p>
        <input
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
                <input
                  className="flow-input"
                  value={code}
                  placeholder="Code"
                  onChange={event => setCode(event.target.value)}
                />
                <button className="flow-btn" type="submit">
                  Code passage
                </button>
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
