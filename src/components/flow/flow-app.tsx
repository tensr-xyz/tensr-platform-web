'use client';

import Link from 'next/link';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/atoms/empty';
import { clearSigningIn } from '@/lib/signing-in';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SubscriptionGate } from '@/components/templates/subscription-gate';
import { useAuth } from '@/hooks/api/use-auth';
import { AgentThread, AgentThreadColumn, useAgentThread } from '@/components/flow/agent-thread';
import { flowFetch, flowJson, type FlowProject } from '@/lib/flow-api';
import {
  loadProjectTables,
  savedTableTotal,
  tableFileNote,
  uniqueStale,
} from '@/components/flow/project-tables';
import { loadTablesSettled, type StaleTable } from '@/components/flow/stale-table';
import { PaletteNoMatch } from '@/components/flow/palette-no-match';
import { isIdColumn, isInternalColumn, type FlowColumn } from '@/lib/flow-columns';
import { openSignedDownload } from '@/lib/excel-download';
import { runAgentLoop, type AgentLoopAttachment } from '@/lib/run-agent-loop';
import { FlowComposer } from '@/components/flow/chat-composer';
import { SidePanel as FlowSidePanel } from '@/components/flow/side-panel';
import { datasetFileLabel } from '@/components/flow/survey-screens';
import { baseCount } from '@/components/flow/chat-output';
import { AnalysisResult } from '@/components/flow/analysis-result';
import { fetchAnalysisRun } from '@/lib/analysis-runs';
import { resultViewFromToolResults } from '@/components/flow/result-tables';
import { FlowMarkdown } from '@/components/flow/flow-markdown';
import {
  PROJECT_TABS,
  projectSectionPath,
  visibleProjectSection,
} from '@/components/flow/project-tabs';
import {
  rememberedFileName,
  sourceVersionTitle,
  SourcesScreen,
} from '@/components/flow/sources-screen';
import { InterviewsScreen } from '@/components/flow/interviews-screen';
import { FlowNotebook } from '@/components/flow/notebook-panel';
import { AnovaModal } from '@/components/flow/anova-modal';
import { ReportOutputs, ReportPaneSwitch } from '@/components/flow/report-outputs';
import { ShareDialog } from '@/components/flow/share-dialog';
import { ExportDialog } from '@/components/flow/export-dialog';
import {
  documentApa,
  pinIsThin,
  pinStory,
  placePins,
  runDocument,
  type ReportPin,
  type RunTable,
} from '@/components/flow/run-document';
import {
  deliverableOutputs,
  pinsFromRuns,
  rememberReportRuns,
  savePin,
  setProjectPins,
  shareRequest,
  useProjectPins,
} from '@/components/flow/report-pins';
import { SettingsScreen } from '@/components/flow/settings-screen';
import { FiltersPanel, type FlowFilter } from '@/components/flow/filters-panel';
import { describeFilters } from '@/components/flow/filters-panel-logic';
import { CodingReview } from '@/components/flow/coding-review';
import { shouldAdoptCodingVersion } from '@/components/flow/coding-versions';
import { FlowNotFound } from '@/components/flow/flow-not-found';
import { DatasetsScreen, uploadTotal } from '@/components/flow/datasets-screen';
import { FolderView } from '@/components/flow/folder-view';
import { ArchivedProjects } from '@/components/flow/archived-projects';
import { PluginDetail } from '@/components/flow/plugin-detail';
import { MyPlugins } from '@/components/flow/my-plugins';
import { AdminPluginReview } from '@/components/flow/admin-plugin-review';
import {
  FlowSidebar,
  LogoMark,
  memberInitials,
  NavIcon,
  NewProjectDialog,
  ProjectSwitcher,
  SearchIcon,
} from '@/components/flow/flow-shell';
import { AnalysisSetupHost } from '@/components/templates/analysis/analysis-setup-provider';
import {
  getAnalysisOpForMenuName,
  isDialogMenuItem,
} from '@/configs/analysis-config/menu-registry';
import {
  filterAnalysisItems,
  getAllAnalysisItems,
  getPaletteTabContent,
  groupAnalysisItems,
  rankAnalysisItems,
  PALETTE_TAB_LABELS,
  PALETTE_TAB_ORDER,
  PLUGINS_TAB_VALUE,
  type AnalysisItem,
} from '@/configs/analysis-config/utils';
import { useAnalysisSetupStore } from '@/stores/analysis-setup-store';
import { useTabsStore, ViewType } from '@/stores/tabs-store';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Command, CommandInput } from '@/components/ui/command';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  RadioGroup,
  RadioGroupItem,
  ScrollArea,
  Skeleton,
} from '@/components/ui/rest';
import {
  distinctTables,
  findingFromOverview,
  findingFromStale,
  findingFromTable,
  findingsWithOutOfDate,
  outOfDateLine,
  reportTableFromBook,
  titledWithQuestions,
  segmentChoices,
  valueRows,
  type ReportFinding,
  type ReportTable,
  type RowCut,
} from '@/lib/flow-report';
import {
  installCount,
  installErrorMessage,
  isEditorsPick,
  languageAccepted,
  PLUGIN_CATEGORIES,
  PLUGIN_CURRENCY,
  pluginByline,
  pluginLanguageChoices,
  pluginMatches,
  reviewLines,
  type FlowPlugin,
  type PluginCategory,
} from '@/lib/flow-plugins';
import { bannerHeading } from '@/lib/flow-survey';
import { CodeFrameRail } from '@/components/flow/code-frame-rail';
import { ColumnSpark, fileCounts, valueCounts } from '@/components/flow/column-spark';
import {
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
type FlowRecipe = {
  name?: string;
  recipe_id?: string;
  version?: number;
  ops?: unknown[];
  created_from?: string;
};

type DatasetRow = {
  dataset_id?: string;
  id?: string;
  original_filename?: string;
  n_rows?: number;
  n_cols?: number;
  project_id?: string;
  updated_at?: string;
  created_at?: string;
  source_filenames?: string[];
  parent_dataset_id?: string | null;
  origin_dataset_id?: string | null;
  lineage_label?: string | null;
  producing_operation?: string | null;
};

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

/** A sheet row meets every applied filter. Cells show labels, filters hold codes, so both are checked. */
export function rowPassesFilters(
  row: unknown[],
  names: string[],
  filters: FlowFilter[],
  columns: { name: string; label?: string | null; value_labels?: Record<string, string> | null }[]
): boolean {
  return filters.every(filter => {
    const meta = columns.find(column => column.name === filter.column);
    const index = names.findIndex(
      name => name === filter.column || (meta?.label && name === meta.label)
    );
    if (index < 0) return true;
    const cell = row[index] == null || row[index] === 'null' ? '' : String(row[index]).trim();
    const accepted = filter.values.flatMap(value => [
      value,
      value.replace(/\.0$/, ''),
      meta?.value_labels?.[value] || '',
      meta?.value_labels?.[value.replace(/\.0$/, '')] || '',
    ]);
    const hit =
      (cell !== '' && accepted.includes(cell.replace(/\.0$/, ''))) || accepted.includes(cell);
    return filter.op === 'is_none_of' ? !hit : hit;
  });
}

/** The same conditions as a table filter, so Tables runs on the filtered rows. */
export function tableFilterRef(filters: FlowFilter[]): {
  filters: { column: string; op: string; value: string | string[] }[];
} {
  return {
    filters: filters.flatMap(
      (filter): { column: string; op: string; value: string | string[] }[] =>
        filter.op === 'is_any_of'
          ? [{ column: filter.column, op: 'in', value: filter.values }]
          : filter.values.map(value => ({ column: filter.column, op: '!=', value }))
    ),
  };
}

function isNumberValue(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  return typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value.trim());
}

function isNumericColumn(column?: FlowColumn): boolean {
  const type = String(column?.type || '').toLowerCase();
  return ['numeric', 'number', 'float', 'integer', 'double'].includes(type);
}

function shortAgo(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 5) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  if (hours < 24 * 6) return date.toLocaleDateString('en-GB', { weekday: 'short' });
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function editedWhen(value?: string | null): string {
  const label = editedAgo(value).replace(/^Edited /, '');
  return label || '—';
}

function projectFiles(projectId: string, datasets: DatasetRow[]): DatasetRow[] {
  return datasets.filter(row => row.project_id === projectId);
}

function responseLabel(files: DatasetRow[]): string {
  if (!files.length) return 'Not fielded';
  const rows = files.reduce((sum, row) => sum + (row.n_rows || 0), 0);
  if (rows > 0) return `${rows.toLocaleString('en-GB')} rows`;
  return `${files.length} file${files.length === 1 ? '' : 's'}`;
}

function editedLabel(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const PROJECT_PAGE = 24;

export function FlowApp({ slug }: { slug: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthReady, isAuthenticated } = useAuth();
  const [palette, setPalette] = useState(false);
  const [sideCollapsed, setSideCollapsed] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [projectCursor, setProjectCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [email, setEmail] = useState('');
  const [membersReady, setMembersReady] = useState(false);
  const [pendingAsk, setPendingAsk] = useState<string | null>(null);
  const [projects, setProjects] = useState<FlowProject[]>([]);
  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [datasets, setDatasets] = useState<DatasetRow[]>([]);
  const [members, setMembers] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [account, setAccount] = useState('');
  const [orgName, setOrgName] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [workspacePhase, setWorkspacePhase] = useState<'loading' | 'ready' | 'error'>('loading');
  // The shell has drawn, so a sign-in that led here has landed.
  useEffect(() => clearSigningIn(), []);
  const routeProjectId = slug[0] === 'p' ? slug[1] || '' : '';
  const exportPins = useProjectPins(
    routeProjectId,
    exportOpen
      ? datasets
          .filter(row => row.project_id === routeProjectId)
          .map(row => datasetRowId(row))
          .filter(Boolean)
      : []
  );

  useEffect(() => {
    if (!isAuthReady) return;
    if (!isAuthenticated) {
      router.replace(`/login?returnTo=${encodeURIComponent(pathname || '/flow')}`);
    }
  }, [isAuthReady, isAuthenticated, pathname, router]);

  const membersFor = useCallback(async (listed: FlowProject[]) => {
    if (!listed.length) return {} as Record<string, string[]>;
    const page = await flowJson<{
      members?: Record<string, { user_id?: string; name?: string; email?: string }[]>;
    }>(`/api/projects/batch/members?ids=${listed.map(project => project.id).join(',')}`, {
      signal: AbortSignal.timeout(10000),
    }).catch(() => ({
      members: {} as Record<string, { user_id?: string; name?: string; email?: string }[]>,
    }));
    return Object.fromEntries(
      listed.map(project => [
        project.id,
        (page.members?.[project.id] || [])
          .map(item => item.name || item.email || item.user_id || '')
          .filter(Boolean),
      ])
    ) as Record<string, string[]>;
  }, []);

  const reload = useCallback(async () => {
    try {
      const [projectPage, folderPage, filePage] = await Promise.all([
        flowJson<{ projects?: FlowProject[]; next_cursor?: string | null }>(
          `/api/projects?limit=${PROJECT_PAGE}`
        ),
        flowJson<{ folders?: { id: string; name: string }[] }>('/api/project-folders'),
        flowJson<DatasetRow[] | { datasets?: DatasetRow[] }>(
          '/datasets/?scope=all&include=versions'
        ),
      ]);
      const listed = projectPage.projects || [];
      void membersFor(listed).then(memberMap => {
        setMembers(current => ({ ...current, ...memberMap }));
        setMembersReady(true);
      });
      setProjects(current => [
        ...listed,
        ...current.filter(item => !listed.some(row => row.id === item.id)),
      ]);
      setProjectCursor(projectPage.next_cursor || null);
      setFolders(folderPage.folders || []);
      const incoming = Array.isArray(filePage) ? filePage : filePage.datasets || [];
      // A project page may already have loaded every version. The workspace list
      // keeps one file per origin, so a refresh must not drop the rest.
      setDatasets(current => {
        const incomingIds = new Set(incoming.map(row => datasetRowId(row)));
        const kept = current.filter(row => !incomingIds.has(datasetRowId(row)));
        return [...incoming, ...kept];
      });
      setError(null);
      setWorkspacePhase('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the workspace');
      setWorkspacePhase('error');
    }
  }, [membersFor]);

  const loadMoreProjects = useCallback(async () => {
    if (!projectCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await flowJson<{ projects?: FlowProject[]; next_cursor?: string | null }>(
        `/api/projects?limit=${PROJECT_PAGE}&cursor=${encodeURIComponent(projectCursor)}`
      );
      const listed = page.projects || [];
      const memberMap = await membersFor(listed);
      setMembers(current => ({ ...current, ...memberMap }));
      setProjects(current => [
        ...current,
        ...listed.filter(item => !current.some(row => row.id === item.id)),
      ]);
      setProjectCursor(page.next_cursor || null);
    } finally {
      setLoadingMore(false);
    }
  }, [projectCursor, loadingMore, membersFor]);

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
        setEmail(page.user?.email || page.email || '');
        setAccount(page.user?.name || page.user?.email || page.email || '');
        setOrgName(page.active_organization?.name || '');
      })
      .catch(() => undefined);
  }, [isAuthenticated]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('new') === '1') {
      setNewOpen(true);
      router.replace('/flow');
    }
    // Only on first load: /project/new redirects here with ?new=1.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      window.localStorage.removeItem('tensr-classic');
      setSideCollapsed(window.localStorage.getItem('tensr-side-collapsed') === '1');
    } catch {
      // Storage can be unavailable; the sidebar starts expanded.
    }
  }, []);

  const collapseSide = (value: boolean) => {
    setSideCollapsed(value);
    try {
      window.localStorage.setItem('tensr-side-collapsed', value ? '1' : '0');
    } catch {
      // The choice lasts for this visit only.
    }
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPalette(open => !open);
      }
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        setNewOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const section = slug[0] === 'p' ? slug[2] || 'chat' : slug[0] || 'projects';
  const projectId = slug[0] === 'p' ? slug[1] : '';
  const project = projects.find(item => item.id === projectId);
  const [projectReady, setProjectReady] = useState('');

  useEffect(() => {
    if (!isAuthenticated || !projectId) return;
    let cancelled = false;
    void flowJson<{ project?: FlowProject; datasets?: DatasetRow[] }>(`/api/projects/${projectId}`)
      .then(page => {
        if (cancelled) return;
        const found = page.project;
        if (found) {
          setProjects(current =>
            current.some(item => item.id === found.id)
              ? current.map(item => (item.id === found.id ? { ...item, ...found } : item))
              : [...current, found]
          );
          try {
            window.localStorage.setItem(`tensr-project-name:${found.id}`, found.name);
          } catch {
            // The cached name only saves a flash of the placeholder.
          }
        }
        const rows = (page.datasets || []).map(row => ({
          ...row,
          dataset_id: row.dataset_id || row.id,
          project_id: row.project_id || projectId,
        }));
        setDatasets(current => {
          const previous = new Map(current.map(row => [datasetRowId(row), row]));
          const merged = rows.map(row => {
            const prior = previous.get(datasetRowId(row));
            const incomingName = (row.original_filename || '').trim();
            const priorName = (prior?.original_filename || '').trim();
            return {
              ...prior,
              ...row,
              original_filename: incomingName || priorName,
              source_filenames: row.source_filenames?.length
                ? row.source_filenames
                : prior?.source_filenames,
            };
          });
          return [
            ...current.filter(
              row => !merged.some(item => datasetRowId(item) === datasetRowId(row))
            ),
            ...merged,
          ];
        });
        setProjectReady(projectId);
      })
      .catch(() => {
        if (!cancelled) setProjectReady(projectId);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, projectId]);
  const tabReady = workspacePhase === 'ready' || projectReady === projectId;
  const finishedRun = useAnalysisSetupStore(s => s.lastRun);
  const handledRun = useRef(finishedRun?.nonce || 0);
  useEffect(() => {
    if (!finishedRun || finishedRun.nonce === handledRun.current) return;
    handledRun.current = finishedRun.nonce;
    if (projectId && section !== 'report') {
      router.push(
        `/flow/p/${projectId}/report?pane=outputs&run=${encodeURIComponent(finishedRun.runId)}`
      );
    }
  }, [finishedRun, projectId, section, router]);
  useEffect(() => {
    if (section !== 'details' || !projectId) return;
    router.replace(projectSectionPath(projectId, section));
  }, [section, projectId, router]);
  const page = visibleProjectSection(section);
  const [cachedName, setCachedName] = useState('');
  useEffect(() => {
    try {
      setCachedName(
        projectId ? window.localStorage.getItem(`tensr-project-name:${projectId}`) || '' : ''
      );
    } catch {
      setCachedName('');
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId || workspacePhase !== 'ready' || projects.some(item => item.id === projectId)) {
      return;
    }
    void flowJson<{ project?: FlowProject }>(`/api/projects/${projectId}`)
      .then(page => {
        const found = page.project;
        if (found)
          setProjects(current =>
            current.some(item => item.id === found.id) ? current : [...current, found]
          );
      })
      .catch(() => undefined);
  }, [projectId, projects, workspacePhase]);
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

  const workspaceLabel =
    orgName && account && orgName.startsWith(account)
      ? orgName.slice(account.length).trim() || 'Workspace'
      : orgName || '';

  // A project that is not there gets the plain 404, without its header, tabs, Share or Export.
  const missingProject = Boolean(projectId) && projectReady === projectId && !project;
  const projectChrome = Boolean(projectId) && !missingProject;

  return (
    <SubscriptionGate>
      <div className={projectChrome ? 'flow flow-project' : 'flow flow-home'}>
        {projectChrome ? null : (
          <FlowSidebar
            collapsed={sideCollapsed}
            onCollapse={collapseSide}
            section={section}
            datasetCount={uploadTotal(datasets)}
            folders={folders}
            folderName={folderName}
            account={account}
            email={email}
            workspace={workspaceLabel}
            onFolder={setFolderName}
            onNewProject={() => setNewOpen(true)}
            onSearch={() => setPalette(true)}
            onFoldersChanged={reload}
          />
        )}
        <div className="flow-main">
          {projectChrome ? (
            <>
              <header className="proj-bar">
                <div className="proj-brand">
                  <Link href="/flow" aria-label="Projects">
                    <LogoMark />
                  </Link>
                  <span className="proj-slash">/</span>
                  <div className="proj-name">
                    <i />
                    <ProjectSwitcher
                      current={project}
                      fallbackName={cachedName}
                      projects={projects}
                      section={page}
                      hasMore={Boolean(projectCursor)}
                      onLoadMore={loadMoreProjects}
                    />
                  </div>
                </div>
                <Button className="proj-search" type="button" onClick={() => setPalette(true)}>
                  <SearchIcon />
                  <span className="proj-search-label">Search analyses</span>
                  <span className="flow-k">⌘K</span>
                </Button>
                <div className="proj-actions">
                  <Button className="flow-btn" type="button" onClick={() => setShareOpen(true)}>
                    Share
                  </Button>
                  <Button
                    className="flow-btn primary"
                    type="button"
                    onClick={() => setExportOpen(true)}
                  >
                    Export
                  </Button>
                </div>
              </header>
              <nav className="proj-tabs">
                {PROJECT_TABS.map(([key, label]) => (
                  <Link
                    key={key}
                    href={`/flow/p/${projectId}/${key}`}
                    data-active={page === key || (key === 'sources' && section === 'interviews')}
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
            {missingProject ? (
              <FlowNotFound />
            ) : section === 'plugins' && slug[1] === 'publish' ? (
              <PublishScreen />
            ) : section === 'plugins' && slug[1] === 'mine' ? (
              <MyPlugins />
            ) : section === 'plugins' && slug[1] ? (
              <PluginDetail pluginId={slug[1]} />
            ) : section === 'plugins' ? (
              <PluginsScreen />
            ) : section === 'admin' && slug[1] === 'plugins' && !projectId ? (
              <AdminPluginReview />
            ) : section === 'settings' && !projectId ? (
              <SettingsScreen section={slug[1]} />
            ) : section === 'datasets' && !projectId ? (
              <DatasetsScreen
                phase={workspacePhase}
                datasets={datasets}
                projects={projects}
                onChanged={reload}
              />
            ) : (section === 'projects' || !projectId) &&
              folderName &&
              folders.some(item => item.name === folderName) ? (
              <FolderView
                folder={
                  folders.find(item => item.name === folderName) as { id: string; name: string }
                }
                projects={projects}
                members={members}
                datasets={datasets}
                onNewProject={() => setNewOpen(true)}
                onChanged={reload}
              />
            ) : section === 'projects' || !projectId ? (
              <ProjectsScreen
                phase={workspacePhase === 'ready' && !membersReady ? 'loading' : workspacePhase}
                error={error}
                projects={projects}
                members={members}
                datasets={datasets}
                folders={folders}
                folderName={folderName}
                workspace={orgName}
                onFolder={name => setFolderName(name)}
                onCreated={reload}
                hasMore={Boolean(projectCursor)}
                loadingMore={loadingMore}
                onLoadMore={loadMoreProjects}
                onCreate={() => setNewOpen(true)}
              />
            ) : section === 'sources' ? (
              <SourcesScreen
                project={project}
                datasets={datasets}
                onChanged={reload}
                projectNames={Object.fromEntries(projects.map(item => [item.id, item.name]))}
              />
            ) : section === 'responses' ? (
              <ResponsesScreen
                project={project}
                datasets={datasets}
                ready={tabReady}
                onChanged={reload}
              />
            ) : section === 'tables' ? (
              <TablesScreen project={project} datasets={datasets} ready={tabReady} />
            ) : section === 'report' ? (
              <ReportScreen
                projectId={projectId}
                project={project}
                datasets={datasets}
                ready={tabReady}
              />
            ) : section === 'interviews' ? (
              <InterviewsScreen projectId={projectId} />
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
                ready={tabReady}
                pendingAsk={pendingAsk}
                onAsked={() => setPendingAsk(null)}
              />
            )}
          </div>
        </div>
        {palette ? (
          <Palette
            datasetId={openDatasetId}
            datasets={datasets}
            onClose={() => setPalette(false)}
            onAsk={name => {
              setPalette(false);
              setPendingAsk(name);
              if (projectId) router.push(`/flow/p/${projectId}/chat`);
            }}
          />
        ) : null}
        <NewProjectDialog
          open={newOpen}
          onOpenChange={setNewOpen}
          folders={folders}
          datasets={datasets}
          defaultFolder={folderName}
          onCreated={reload}
        />
        {shareOpen && projectId ? (
          <ShareDialog
            projectId={projectId}
            projectName={project?.name || 'Project'}
            onClose={() => setShareOpen(false)}
          />
        ) : null}
        {exportOpen && projectId ? (
          <ExportDialog
            kind="report"
            title={project?.name || 'Report'}
            document={runDocument({
              title: project?.name || 'Report',
              op: 'report',
              report: {
                summary: exportPins.map(pin => pin.headline).join(' '),
                tables: exportPins.map(pin => ({
                  title: pin.citation || 'Finding',
                  columns: ['Finding', 'Detail'],
                  rows: [[pin.headline, pin.support]],
                })),
              },
            })}
            runIds={exportPins.map(pin => pin.runId)}
            datasetId={openDatasetId}
            onClose={() => setExportOpen(false)}
          />
        ) : null}
        <AnalysisSetupHost />
      </div>
    </SubscriptionGate>
  );
}

function ProjectsScreen({
  phase,
  error,
  projects,
  members,
  datasets,
  folders,
  folderName,
  workspace,
  onFolder,
  onCreated,
  onCreate,
  hasMore,
  loadingMore,
  onLoadMore,
}: {
  phase: 'loading' | 'ready' | 'error';
  error: string | null;
  projects: FlowProject[];
  members: Record<string, string[]>;
  datasets: DatasetRow[];
  folders: { id: string; name: string }[];
  folderName: string | null;
  workspace: string;
  onFolder: (name: string | null) => void;
  onCreated: () => Promise<void>;
  onCreate: () => void;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => Promise<void>;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasMore || phase !== 'ready') return;
    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) void onLoadMore();
      },
      { rootMargin: '320px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, phase, onLoadMore]);
  const moveToFolder = (projectId: string, folder: string) => {
    void flowJson(`/api/projects/${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify({ folder: folder || null }),
    }).then(() => onCreated());
  };
  const [mode, setMode] = useState<'cards' | 'table'>('cards');
  const [filter, setFilter] = useState<'active' | 'mine' | 'archived'>('active');
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('view') === 'archived')
      setFilter('archived');
  }, []);
  const [query, setQuery] = useState('');
  const [newestFirst, setNewestFirst] = useState(true);
  const shown = projects
    .filter(project => {
      const status = project.status || 'active';
      if (folderName && (project.folder || '') !== folderName) return false;
      if (filter === 'archived') return status === 'archived';
      if (status === 'archived') return false;
      if (query && !project.name.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    })
    .sort((left, right) => {
      const a = new Date(left.updated_at || 0).getTime();
      const b = new Date(right.updated_at || 0).getTime();
      return newestFirst ? b - a : a - b;
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
            <SearchIcon />
            <Input
              value={query}
              placeholder="Search projects"
              aria-label="Search projects"
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
      {filter === 'archived' ? (
        <ArchivedProjects onChanged={onCreated} />
      ) : phase === 'loading' ? (
        mode === 'table' ? (
          <div className="project-table" aria-busy="true">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <div className="flow-grid" aria-busy="true">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="flow-card-skeleton" />
            ))}
          </div>
        )
      ) : phase === 'error' ? (
        <p className="flow-error">{error || 'Could not load projects.'}</p>
      ) : mode === 'cards' ? (
        <div className="flow-grid">
          {shown.map(project => (
            <ProjectCard
              key={project.id}
              project={project}
              datasets={datasets}
              memberIds={members[project.id] || []}
              folders={folders}
              onMove={folder => moveToFolder(project.id, folder)}
            />
          ))}
          {loadingMore
            ? Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={`more-${index}`} className="flow-card-skeleton" />
              ))
            : null}
          <Button className="flow-card flow-card-new" type="button" onClick={onCreate}>
            <span className="home-plus">+</span>
            <strong>New project</strong>
            <span className="flow-muted">
              Name it, then upload a survey file or use one you have
            </span>
          </Button>
        </div>
      ) : (
        <div className="project-table">
          {shown.length === 0 ? (
            <p className="report-empty">No projects in this view.</p>
          ) : (
            <Table className="flow-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Folder</th>
                  <th>Status</th>
                  <th>Responses</th>
                  <th>People</th>
                  <th className="edited">
                    <Button
                      className="table-sort"
                      type="button"
                      onClick={() => setNewestFirst(current => !current)}
                    >
                      Edited {newestFirst ? '↓' : '↑'}
                    </Button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map(project => {
                  const files = projectFiles(project.id, datasets);
                  const status = project.status || 'active';
                  const draft = files.length === 0;
                  return (
                    <tr key={project.id}>
                      <td>
                        <Link className="project-name" href={`/flow/p/${project.id}/chat`}>
                          {project.name}
                        </Link>
                        <div className="project-sub">
                          {files.length} file{files.length === 1 ? '' : 's'}
                          {files[0]?.original_filename ? ` · ${files[0].original_filename}` : ''}
                        </div>
                      </td>
                      <td>
                        <ChoiceSelect
                          className="row-folder"
                          aria-label={`Folder for ${project.name}`}
                          value={project.folder || ''}
                          onValueChange={value => moveToFolder(project.id, value)}
                          options={[
                            { value: '', label: 'No folder' },
                            ...folders.map(folder => ({ value: folder.name, label: folder.name })),
                          ]}
                        />
                      </td>
                      <td>
                        <Badge tone={status === 'archived' || draft ? 'draft' : 'active'}>
                          {status === 'archived' ? 'Archived' : draft ? 'Draft' : 'Active'}
                        </Badge>
                        <Button
                          className="flow-btn row-archive"
                          type="button"
                          onClick={() => {
                            void flowJson(`/api/projects/${project.id}`, {
                              method: 'PATCH',
                              body: JSON.stringify({
                                status: status === 'archived' ? 'active' : 'archived',
                              }),
                            }).then(() => onCreated());
                          }}
                        >
                          {status === 'archived' ? 'Restore' : 'Archive'}
                        </Button>
                      </td>
                      <td>{responseLabel(files)}</td>
                      <td className="flow-muted">
                        {(members[project.id] || []).map(memberMark).join(', ') || '—'}
                      </td>
                      <td className="edited">{editedWhen(project.updated_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </div>
      )}
      {phase === 'ready' && hasMore ? (
        <div ref={sentinel} className="home-more">
          {mode === 'table' && loadingMore ? (
            <Skeleton className="h-12 w-full" />
          ) : (
            <Button
              className="flow-btn"
              type="button"
              disabled={loadingMore}
              onClick={() => void onLoadMore()}
            >
              {loadingMore ? 'Loading…' : 'Load more projects'}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}

function ProjectCard({
  project,
  datasets,
  memberIds,
  folders,
  onMove,
}: {
  project: FlowProject;
  datasets: DatasetRow[];
  memberIds: string[];
  folders: { id: string; name: string }[];
  onMove: (folder: string) => void;
}) {
  const count = datasets.filter(row => row.project_id === project.id).length;
  const status = project.status || 'active';
  const draft = count === 0;
  return (
    <Card asChild>
      <Link href={`/flow/p/${project.id}/chat`} className="flow-card">
        <div className="card-top">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                className="card-folder"
                type="button"
                aria-label={`Move ${project.name} to a folder`}
                onClick={event => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
              >
                <i />
                {project.folder || 'No folder'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" onClick={event => event.stopPropagation()}>
              <DropdownMenuItem disabled className="card-folder-label">
                Move to folder
              </DropdownMenuItem>
              {[{ id: '', name: '' }, ...folders].map(folder => (
                <DropdownMenuItem
                  key={folder.id || 'none'}
                  onSelect={() => onMove(folder.name)}
                  data-active={(project.folder || '') === folder.name}
                >
                  {folder.name || 'No folder'}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
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
        </div>
        <div className="card-foot">
          <Members ids={memberIds} />
          <span className="flow-muted">{editedAgo(project.updated_at)}</span>
        </div>
      </Link>
    </Card>
  );
}

function memberMark(label: string): string {
  return memberInitials(label);
}

function Members({ ids }: { ids: string[] }) {
  if (!ids.length) return <span />;
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
  const { user } = useAuth();
  const userIds = [user?.userId, user?.id].filter((id): id is string => Boolean(id));
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [plugins, setPlugins] = useState<FlowPlugin[]>([]);
  const [installed, setInstalled] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<PluginCategory>('All');
  const [mine, setMine] = useState(false);
  const router = useRouter();
  // A plugin opens its own page (Paper 1g), not a dialog.
  const openPlugin = (plugin: FlowPlugin) =>
    router.push(`/flow/plugins/${encodeURIComponent(plugin.pluginId)}`);
  const [installing, setInstalling] = useState<string | null>(null);
  const [installError, setInstallError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      flowJson<{ items?: FlowPlugin[] }>('/plugins?limit=100'),
      flowJson<{ items?: { pluginId?: string }[] }>('/plugins/installed').catch(() => ({
        items: [],
      })),
    ])
      .then(([catalog, installs]) => {
        if (cancelled) return;
        setPlugins(catalog.items || []);
        setInstalled(
          new Set(
            (installs.items || [])
              .map(row => row.pluginId)
              .filter((id): id is string => Boolean(id))
          )
        );
        setPhase('ready');
      })
      .catch(reason => {
        if (cancelled) return;
        setError(reason instanceof Error ? reason.message : 'Could not load plugins.');
        setPhase('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const shown = plugins.filter(plugin =>
    pluginMatches(plugin, { category, query, mine, installed, userIds })
  );
  const featured = category === 'All' && !query && !mine ? shown.slice(0, 2) : [];
  const rest = category === 'All' && !query && !mine ? shown.slice(2) : shown;

  const install = (plugin: FlowPlugin) => {
    setInstalling(plugin.pluginId);
    setInstallError(null);
    void flowJson(`/plugins/${plugin.pluginId}/install`, { method: 'POST' })
      .then(() => {
        setInstalled(current => new Set(current).add(plugin.pluginId));
      })
      .catch(reason => setInstallError(installErrorMessage(reason)))
      .finally(() => setInstalling(null));
  };

  return (
    <div className="plugins-page">
      <div className="plugins-head">
        <div>
          <div className="plugins-eyebrow">Plugin marketplace</div>
          <h1 className="plugins-title">Plugins</h1>
          <p className="flow-muted plugins-lead">
            Add methods and checks your team uses. They show up in ⌘K, the agent can call them, and
            every run stays traceable.
          </p>
        </div>
        <div className="plugins-actions">
          <Button
            className="flow-btn"
            type="button"
            data-active={mine}
            onClick={() => setMine(current => !current)}
          >
            My plugins{phase === 'ready' ? ` · ${installed.size}` : ''}
          </Button>
          <Link className="home-new" href="/flow/plugins/publish">
            + Publish
          </Link>
        </div>
      </div>
      <div className="plugins-tools">
        <label className="home-search plugin-search">
          <SearchIcon />
          <Input
            value={query}
            placeholder="Search plugins"
            onChange={event => setQuery(event.target.value)}
          />
        </label>
        {PLUGIN_CATEGORIES.map(item => (
          <Button
            key={item}
            className="plugin-pill"
            type="button"
            data-active={category === item}
            onClick={() => setCategory(item)}
          >
            {item}
          </Button>
        ))}
      </div>
      {phase === 'loading' ? (
        <div className="plugin-features" aria-busy="true">
          <Skeleton className="plugin-skeleton" />
          <Skeleton className="plugin-skeleton" />
        </div>
      ) : phase === 'error' ? (
        <p className="flow-error">{error || 'Could not load plugins.'}</p>
      ) : shown.length === 0 ? (
        <p className="report-empty">No plugins in this view.</p>
      ) : (
        <>
          {featured.length > 0 ? (
            <div className="plugin-features">
              {featured.map(plugin => (
                <PluginFeature
                  key={plugin.pluginId}
                  plugin={plugin}
                  installed={installed.has(plugin.pluginId)}
                  team={Boolean(plugin.authorId && userIds.includes(plugin.authorId))}
                  busy={installing === plugin.pluginId}
                  onOpen={() => openPlugin(plugin)}
                  onInstall={() => install(plugin)}
                />
              ))}
            </div>
          ) : null}
          {rest.length > 0 ? (
            <div className="plugin-grid">
              {rest.map(plugin => (
                <PluginTile
                  key={plugin.pluginId}
                  plugin={plugin}
                  installed={installed.has(plugin.pluginId)}
                  busy={installing === plugin.pluginId}
                  onOpen={() => openPlugin(plugin)}
                  onInstall={() => install(plugin)}
                />
              ))}
            </div>
          ) : null}
          {installError ? <p className="flow-error">{installError}</p> : null}
        </>
      )}
    </div>
  );
}

function PluginFeature({
  plugin,
  installed,
  team,
  busy,
  onOpen,
  onInstall,
}: {
  plugin: FlowPlugin;
  installed: boolean;
  team: boolean;
  busy: boolean;
  onOpen: () => void;
  onInstall: () => void;
}) {
  const count = installCount(plugin);
  return (
    <Card className={team ? 'plugin-feature team' : 'plugin-feature'}>
      <div className="plugin-kicker">
        {isEditorsPick(plugin) ? <Badge tone="active">Editor&apos;s pick</Badge> : null}
        {team ? <Badge tone="warn">Your team</Badge> : null}
        <span className="flow-muted">{pluginByline(plugin)}</span>
      </div>
      <Button className="plugin-name" type="button" onClick={onOpen}>
        {plugin.name}
      </Button>
      <p className="flow-muted">{plugin.description}</p>
      <div className="plugin-foot">
        {count ? <span className="flow-muted">{count}</span> : null}
        {plugin.version ? <span className="flow-muted">v{plugin.version}</span> : null}
        <span className="plugin-spacer" />
        {installed ? (
          <span className="plugin-installed-pill">Installed</span>
        ) : (
          <Button className="flow-btn primary" type="button" disabled={busy} onClick={onInstall}>
            {busy ? 'Installing' : 'Install'}
          </Button>
        )}
      </div>
    </Card>
  );
}

function PluginTile({
  plugin,
  installed,
  busy,
  onOpen,
  onInstall,
}: {
  plugin: FlowPlugin;
  installed: boolean;
  busy: boolean;
  onOpen: () => void;
  onInstall: () => void;
}) {
  const count = installCount(plugin);
  const tag = (plugin.tags || [])[0];
  return (
    <Card className="plugin-tile">
      <Button className="plugin-tile-name" type="button" onClick={onOpen}>
        {plugin.name}
      </Button>
      <p className="flow-muted">{plugin.description}</p>
      <div className="plugin-foot">
        {tag ? <span className="flow-muted">{tag}</span> : null}
        {count ? <span className="flow-muted">{count}</span> : null}
        <span className="plugin-spacer" />
        {installed ? (
          <span className="plugin-installed">Installed</span>
        ) : (
          <Button className="plugin-install" type="button" disabled={busy} onClick={onInstall}>
            {busy ? 'Installing' : 'Install'}
          </Button>
        )}
      </div>
    </Card>
  );
}

function PublishScreen() {
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [plugins, setPlugins] = useState<
    { pluginId: string; name?: string; status?: string; version?: string }[]
  >([]);
  const [stats, setStats] = useState<{
    totalDownloads: number;
    totalCustomers: number;
    monthlyRevenue: number;
  } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [version, setVersion] = useState('0.1.0');
  const [description, setDescription] = useState('');
  const [language, setLanguage] = useState('typescript');
  const [entryPoint, setEntryPoint] = useState('dist/index.js');
  const [paid, setPaid] = useState(false);
  const [price, setPrice] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [review, setReview] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    setPhase('loading');
    void Promise.all([
      flowJson<{ pluginId: string; name?: string; status?: string }[]>('/creator/plugins'),
      flowJson<{
        totalDownloads: number;
        totalCustomers: number;
        monthlyRevenue: number;
      }>('/creator/stats').catch(() => null),
    ])
      .then(([rows, figures]) => {
        setPlugins(Array.isArray(rows) ? rows : []);
        setStats(figures);
        setPhase('ready');
      })
      .catch(reason => {
        setError(reason instanceof Error ? reason.message : 'Could not load your plugins.');
        setPhase('error');
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const blank = () => {
    setSelectedId(null);
    setName('');
    setVersion('0.1.0');
    setDescription('');
    setLanguage('typescript');
    setEntryPoint('dist/index.js');
    setPaid(false);
    setPrice('');
    setFile(null);
    setReview([]);
    setMessage(null);
  };

  const choose = (pluginId: string) => {
    setSelectedId(pluginId);
    setFile(null);
    setMessage(null);
    void flowJson<
      FlowPlugin & {
        status?: string;
        reviewNotes?: string;
        entryPoint?: string;
        scanResults?: { passed?: boolean };
        isPaid?: boolean;
        pricing?: { price?: number };
      }
    >(`/plugins/${pluginId}`).then(plugin => {
      setName(plugin.name || '');
      setVersion(plugin.version || '0.1.0');
      setDescription(plugin.description || '');
      const storedLanguage = (plugin.language || 'typescript').toLowerCase();
      setLanguage(languageAccepted(storedLanguage) ? storedLanguage : 'typescript');
      setEntryPoint(plugin.entryPoint || 'dist/index.js');
      setPaid(Boolean(plugin.isPaid));
      setPrice(plugin.pricing?.price != null ? String(plugin.pricing.price) : '');
      setReview(reviewLines(plugin));
    });
  };

  const submit = () => {
    if (!file) {
      setMessage('Choose a .zip to submit.');
      return;
    }
    if (!languageAccepted(language)) return;
    const body = new FormData();
    body.append('file', file);
    body.append('name', name || file.name.replace(/\.zip$/i, ''));
    body.append('version', version || '0.1.0');
    body.append('description', description);
    body.append('entryPoint', entryPoint || 'dist/index.js');
    body.append('language', language);
    body.append('isPaid', paid ? 'true' : 'false');
    if (paid && price) {
      body.append('pricingModel', 'subscription');
      body.append('price', price);
      body.append('currency', PLUGIN_CURRENCY);
      body.append('subscriptionInterval', 'monthly');
    }
    setBusy(true);
    setMessage(null);
    void flowFetch('/plugins/upload', { method: 'POST', body })
      .then(async response => {
        const text = await response.text();
        if (!response.ok) throw new Error(installErrorMessage(new Error(text)));
        setMessage('Submitted for review.');
        setFile(null);
        load();
      })
      .catch(reason => setMessage(installErrorMessage(reason)))
      .finally(() => setBusy(false));
  };

  const statusChip = (status?: string) =>
    status === 'APPROVED'
      ? { label: 'Published', tone: 'accent' }
      : status === 'PENDING'
        ? { label: 'In review', tone: 'warn' }
        : status === 'REJECTED'
          ? { label: 'Rejected', tone: 'warn' }
          : { label: 'Draft', tone: 'muted' };
  const languageLabel = (id?: string) =>
    pluginLanguageChoices().find(item => item.id === (id || '').toLowerCase())?.label || id || '';
  const checks = [
    {
      label: 'Static scan',
      detail: 'Dependencies and imports checked',
      line: review.find(line => line.startsWith('Static scan')),
    },
    {
      label: 'Sandbox test',
      detail: 'Coming soon',
      line: undefined as string | undefined,
    },
    {
      label: 'Manual review',
      detail: 'A Tensr statistician checks the method',
      line: review.find(line => !line.startsWith('Static scan')),
    },
  ];

  return (
    <div className="pub">
      <header className="pub-head">
        <div className="pub-head-copy">
          <div className="pub-crumbs">
            <span>PLUGINS</span>
            <span className="pub-slash">/</span>
            <span>AUTHOR</span>
          </div>
          <h1>Publish a plugin</h1>
          <p>
            Write it in TypeScript or JavaScript; Python and R are coming soon. Once approved it
            shows up in ⌘K and the agent can call it.
          </p>
        </div>
        <div className="pub-actions">
          <Button className="pub-btn" type="button" disabled title="Draft saving is coming soon">
            Save draft <span className="pub-soon">soon</span>
          </Button>
          <Button className="pub-btn primary" type="button" disabled={busy} onClick={submit}>
            {busy ? 'Submitting' : 'Submit for review'}
          </Button>
        </div>
      </header>
      {phase === 'loading' ? (
        <div className="pub-body" aria-busy="true">
          <div className="pub-rail">
            <Skeleton className="h-12 w-full" />
          </div>
          <div className="pub-main">
            <Skeleton className="h-64 w-full" />
          </div>
          <div className="pub-side">
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      ) : phase === 'error' ? (
        <p className="flow-error pub-error">{error || 'Could not load your plugins.'}</p>
      ) : (
        <div className="pub-body">
          <aside className="pub-rail">
            <div className="pub-rail-head">
              <span>Your plugins</span>
              <Button className="pub-new" type="button" onClick={blank}>
                + New
              </Button>
            </div>
            {plugins.length === 0 ? <p className="pub-empty">No plugins yet.</p> : null}
            {plugins.map(plugin => {
              const chip = statusChip(plugin.status);
              return (
                <Button
                  key={plugin.pluginId}
                  className="pub-item"
                  type="button"
                  data-active={selectedId === plugin.pluginId}
                  onClick={() => choose(plugin.pluginId)}
                >
                  <span className="pub-item-name">{plugin.name || 'Plugin'}</span>
                  <span className="pub-item-meta">
                    {[
                      plugin.version ? `v${plugin.version}` : '',
                      languageLabel((plugin as { language?: string }).language),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    <span className="pub-chip" data-tone={chip.tone}>
                      <i />
                      {chip.label}
                    </span>
                  </span>
                </Button>
              );
            })}
            <span className="pub-grow" />
            <div className="pub-guide">
              <strong>Author guide</strong>
              <span>Manifest format, the test harness and how review works.</span>
              <a href="https://tensr.xyz/docs" target="_blank" rel="noreferrer">
                Open docs
              </a>
            </div>
          </aside>
          <section className="pub-main">
            <div className="pub-section">
              <div className="pub-section-head">
                <h2>Manifest</h2>
                <span className="pub-mono">plugin.toml</span>
              </div>
              <div className="pub-row">
                <label className="pub-field pub-grow-field">
                  <span>Name</span>
                  <Input value={name} onChange={event => setName(event.target.value)} />
                </label>
                <label className="pub-field pub-version">
                  <span>Version</span>
                  <Input value={version} onChange={event => setVersion(event.target.value)} />
                </label>
              </div>
              <label className="pub-field">
                <span>Description</span>
                <Textarea
                  rows={2}
                  value={description}
                  onChange={event => setDescription(event.target.value)}
                />
              </label>
              <div className="pub-row pub-row-end">
                <div className="pub-field">
                  <span>Language</span>
                  <div className="pub-segment" role="group" aria-label="Language">
                    {pluginLanguageChoices().map(item => (
                      <Button
                        key={item.id}
                        type="button"
                        data-active={language === item.id}
                        disabled={item.soon}
                        title={item.soon ? `${item.label} is coming soon` : undefined}
                        onClick={() => setLanguage(item.id)}
                      >
                        {item.label}
                      </Button>
                    ))}
                  </div>
                </div>
                <label className="pub-field pub-grow-field">
                  <span>Shows up as</span>
                  <Input readOnly value={`⌘K · ${name || 'Your plugin'}`} />
                </label>
              </div>
            </div>
            <div className="pub-section">
              <h2>Permissions</h2>
              <div className="pub-row">
                {[
                  [
                    'Reads selected columns only',
                    'Gets the variables the user picks, nothing else',
                  ],
                  ['No network access', 'Runs sealed in the sandbox'],
                ].map(([title, detail]) => (
                  <div key={title} className="pub-permission">
                    <span className="pub-tick" role="img" aria-label={`${title}: on`}>
                      <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true">
                        <path
                          d="M2.5 6.2l2.4 2.3 4.6-5"
                          fill="none"
                          stroke="#fff"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    <div>
                      <strong>{title}</strong>
                      <span>{detail}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="pub-source">
              <div className="pub-source-head">
                <Input
                  className="pub-mono pub-entry"
                  aria-label="Entry point"
                  value={entryPoint}
                  onChange={event => setEntryPoint(event.target.value)}
                />
                <label className="pub-zip">
                  {file ? file.name : 'Choose .zip'}
                  <Input
                    className="sr-only"
                    type="file"
                    accept=".zip,application/zip"
                    aria-label="Plugin zip"
                    onChange={event => setFile(event.target.files?.[0] || null)}
                  />
                </label>
              </div>
              <div className="pub-source-body">
                <span>The source is the zip you upload, with the entry point above.</span>
                <span className="pub-soon">In-page editor coming soon</span>
              </div>
            </div>
            <div className="pub-test">
              <div className="pub-test-head">
                <span>Test run on sample data</span>
                <span className="pub-soon">Coming soon</span>
              </div>
              <div className="pub-test-figures">
                {['Sample', 'Output', 'Time', 'Memory'].map(label => (
                  <div key={label}>
                    <span>{label}</span>
                    <strong>—</strong>
                  </div>
                ))}
              </div>
            </div>
            {message ? <p className="pub-message">{message}</p> : null}
          </section>
          <FlowSidePanel id="publish" defaultWidth={296} className="pub-side">
            <div className="pub-card">
              <div className="pub-card-head">
                <span>Review · v{version || '0.1.0'}</span>
                <span>
                  {selectedId
                    ? statusChip(plugins.find(item => item.pluginId === selectedId)?.status).label
                    : 'Not submitted'}
                </span>
              </div>
              {checks.map(check => {
                const failed = Boolean(check.line && /failed|rejected/i.test(check.line));
                const done = Boolean(check.line && !failed && !/pending/i.test(check.line));
                return (
                  <div key={check.label} className="pub-check">
                    <span
                      className="pub-check-mark"
                      data-state={done ? 'done' : failed ? 'failed' : 'pending'}
                    >
                      {done ? (
                        <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true">
                          <path
                            d="M2.5 6.2l2.4 2.3 4.6-5"
                            fill="none"
                            stroke="#fff"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : (
                        <i />
                      )}
                    </span>
                    <div>
                      <strong>{check.line || check.label}</strong>
                      <span>{check.detail}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="pub-card">
              <div className="pub-card-head">
                <span>Pricing</span>
              </div>
              <RadioGroup
                className="pub-pricing"
                value={paid ? 'subscription' : 'free'}
                onValueChange={value => setPaid(value === 'subscription')}
              >
                <label className="pub-price" data-active={!paid}>
                  <RadioGroupItem value="free" />
                  <span>Free</span>
                </label>
                <label className="pub-price" data-active={paid}>
                  <span className="pub-price-row">
                    <RadioGroupItem value="subscription" />
                    <span className="pub-grow">Subscription</span>
                    <span className="pub-price-input">
                      £
                      <Input
                        aria-label="Price per month"
                        value={price}
                        placeholder="0"
                        onChange={event => {
                          setPrice(event.target.value);
                          setPaid(true);
                        }}
                      />
                      <span>/mo</span>
                    </span>
                  </span>
                  <span className="pub-price-note">Per workspace · charged monthly in GBP</span>
                </label>
              </RadioGroup>
            </div>
            <div className="pub-card pub-earnings">
              <div className="pub-card-head">
                <span>Earnings · all plugins</span>
                <span className="pub-soon">Payouts soon</span>
              </div>
              <div className="pub-figures">
                <div>
                  <strong>{stats ? stats.totalDownloads : '—'}</strong>
                  <span>Installs</span>
                </div>
                <div>
                  <strong>{stats ? stats.totalCustomers : '—'}</strong>
                  <span>Active workspaces</span>
                </div>
                <div>
                  <strong>
                    {stats
                      ? stats.monthlyRevenue.toLocaleString('en-GB', {
                          style: 'currency',
                          currency: 'GBP',
                          maximumFractionDigits: 0,
                        })
                      : '—'}
                  </strong>
                  <span>This month</span>
                </div>
              </div>
              <svg
                className="pub-spark"
                width="248"
                height="34"
                viewBox="0 0 248 34"
                aria-hidden="true"
              >
                <path d="M0 30 L248 30" fill="none" stroke="var(--color-line)" strokeWidth="1.6" />
              </svg>
            </div>
          </FlowSidePanel>
        </div>
      )}
    </div>
  );
}

function paletteMark(name: string): string {
  const letters = name
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map(word => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return letters || '—';
}

function Palette({
  datasetId,
  datasets,
  onClose,
  onAsk,
}: {
  datasetId?: string;
  datasets: DatasetRow[];
  onClose: () => void;
  onAsk: (name: string) => void;
}) {
  const items = useMemo(() => getAllAnalysisItems(), []);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<string>('analyze');
  const [section, setSection] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [plugins, setPlugins] = useState<{ pluginId: string; name: string }[]>([]);
  const filtered = useMemo(() => filterAnalysisItems(items, query), [items, query]);
  const searching = query.trim().length > 0;
  const ranked = useMemo(
    () => (searching ? rankAnalysisItems(filtered, query) : filtered),
    [filtered, query, searching]
  );
  const grouped = useMemo(
    () => groupAnalysisItems(searching ? ranked : filtered),
    [filtered, ranked, searching]
  );
  const sections = searching
    ? { Matches: ranked }
    : tab === PLUGINS_TAB_VALUE
      ? {}
      : getPaletteTabContent(grouped, tab);
  const sectionNames = Object.keys(sections).filter(name => !query || sections[name]?.length);
  const activeSection = section && sections[section] ? section : sectionNames[0] || null;
  const analyses = activeSection ? sections[activeSection] || [] : [];
  const pluginRows = plugins.filter(plugin =>
    plugin.name.toLowerCase().includes(query.trim().toLowerCase())
  );
  const rows =
    tab === PLUGINS_TAB_VALUE
      ? pluginRows.map(plugin => ({
          kind: 'plugin' as const,
          name: plugin.name,
          id: plugin.pluginId,
        }))
      : analyses.map(item => ({ kind: 'analysis' as const, item }));
  const chosen = rows[Math.min(index, Math.max(rows.length - 1, 0))];
  const dataset = datasets.find(row => datasetRowId(row) === datasetId);

  useEffect(() => {
    void flowJson<{ items?: { pluginId?: string; plugin?: { name?: string } }[] }>(
      '/plugins/installed'
    )
      .then(page => {
        setPlugins(
          (page.items || [])
            .map(row => ({
              pluginId: row.pluginId || '',
              name: row.plugin?.name || '',
            }))
            .filter(row => row.pluginId && row.name)
        );
      })
      .catch(() => setPlugins([]));
  }, []);

  const openChosen = (ask: boolean) => {
    if (!chosen) return;
    if (chosen.kind === 'plugin' || ask) {
      onAsk(chosen.kind === 'plugin' ? chosen.name : chosen.item.name);
      return;
    }
    onClose();
    const store = useAnalysisSetupStore.getState();
    if (isDialogMenuItem(chosen.item.name)) {
      store.openDialog(chosen.item.name);
      return;
    }
    const op = getAnalysisOpForMenuName(chosen.item.name);
    if (op) store.openSetupFromPalette(op);
    else store.openUnavailable(chosen.item.name);
  };

  return (
    <div className="flow-palette" onClick={onClose}>
      <Command
        shouldFilter={false}
        className="palette-card"
        onClick={event => event.stopPropagation()}
        onKeyDown={event => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setIndex(current => Math.min(current + 1, rows.length - 1));
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setIndex(current => Math.max(current - 1, 0));
          } else if (event.key === 'Enter' && chosen) {
            event.preventDefault();
            openChosen(event.metaKey || event.ctrlKey);
          } else if (event.key === 'Escape') {
            onClose();
          }
        }}
      >
        <div className="palette-input">
          <CommandInput
            autoFocus
            value={query}
            placeholder="Search analyses"
            onValueChange={value => {
              setQuery(value);
              setIndex(0);
            }}
          />
          <span className="palette-esc">esc</span>
        </div>
        <div className="palette-tabs">
          {PALETTE_TAB_ORDER.map(key => (
            <Button
              key={key}
              className="palette-tab"
              type="button"
              data-active={tab === key}
              onClick={() => {
                setTab(key);
                setSection(null);
                setIndex(0);
              }}
            >
              {PALETTE_TAB_LABELS[key] || key}
            </Button>
          ))}
          <Button
            className="palette-tab palette-tab-plugins"
            type="button"
            data-active={tab === PLUGINS_TAB_VALUE}
            onClick={() => {
              setTab(PLUGINS_TAB_VALUE);
              setSection(null);
              setIndex(0);
            }}
          >
            Plugins
            {plugins.length ? <span className="palette-count">{plugins.length}</span> : null}
          </Button>
        </div>
        <div className={tab === PLUGINS_TAB_VALUE ? 'palette-body plugins' : 'palette-body'}>
          {tab === PLUGINS_TAB_VALUE ? (
            <div className="palette-results">
              {pluginRows.length === 0 ? (
                <p className="flow-muted">
                  {plugins.length ? 'No plugins in this search.' : 'No installed plugins.'}
                </p>
              ) : (
                pluginRows.map((plugin, rowIndex) => (
                  <Button
                    key={plugin.pluginId}
                    className="palette-hit"
                    type="button"
                    data-active={rowIndex === index}
                    onClick={() => onAsk(plugin.name)}
                  >
                    <span className="palette-mark plugin">P</span>
                    <span className="palette-copy">
                      <strong>{plugin.name}</strong>
                      <span>Plugin · installed in this workspace</span>
                    </span>
                    {rowIndex === index ? <span className="palette-enter">↵</span> : null}
                  </Button>
                ))
              )}
            </div>
          ) : (
            <>
              <div className="palette-sections">
                {sectionNames.length === 0 ? <p className="flow-muted">No sections</p> : null}
                {sectionNames.map(name => (
                  <Button
                    key={name}
                    className="palette-section"
                    type="button"
                    data-active={name === activeSection}
                    onClick={() => {
                      setSection(name);
                      setIndex(0);
                    }}
                  >
                    {name}
                    {sections[name]?.length ? '' : ' · soon'}
                  </Button>
                ))}
              </div>
              <div className="palette-results">
                {analyses.length === 0 ? (
                  <PaletteNoMatch query={query} onAsk={onAsk} />
                ) : (
                  <>
                    <p className="palette-label">{query ? 'Best match' : activeSection}</p>
                    {analyses.map((item, rowIndex) => (
                      <Button
                        key={item.name}
                        className="palette-hit"
                        type="button"
                        data-active={rowIndex === index}
                        onClick={() => {
                          setIndex(rowIndex);
                          onClose();
                          const store = useAnalysisSetupStore.getState();
                          if (isDialogMenuItem(item.name)) {
                            store.openDialog(item.name);
                            return;
                          }
                          const op = getAnalysisOpForMenuName(item.name);
                          if (op) store.openSetupFromPalette(op);
                          else store.openUnavailable(item.name);
                        }}
                      >
                        <span className="palette-mark">{paletteMark(item.name)}</span>
                        <span className="palette-copy">
                          <strong>{item.name}</strong>
                          {item.hint ? <span>{item.hint}</span> : null}
                        </span>
                        {rowIndex === index ? <span className="palette-enter">↵</span> : null}
                      </Button>
                    ))}
                  </>
                )}
              </div>
            </>
          )}
        </div>
        <p className="palette-foot">
          <span>↑↓ navigate</span>
          <span>↵ open dialog</span>
          <span>⌘↵ ask the agent to run it</span>
          <span className="plugin-spacer" />
          <span>
            {dataset
              ? `Runs on ${dataset.original_filename || 'this dataset'}${
                  dataset.n_rows ? ` · ${dataset.n_rows.toLocaleString('en-GB')} rows` : ''
                }`
              : 'No dataset open'}
          </span>
        </p>
      </Command>
    </div>
  );
}

type FlowSession = { session_id: string; title?: string; updated_at?: string };

function chatTitle(session: FlowSession): string {
  return session.title?.trim() || 'Untitled chat';
}

function chatFile(
  project: FlowProject | undefined,
  datasets: DatasetRow[]
): DatasetRow | undefined {
  if (!project) return undefined;
  const files = projectFiles(project.id, datasets);
  return files.find(row => datasetRowId(row) === project.active_dataset_id) || files[0];
}

function chatLead(file?: DatasetRow): string {
  if (!file) return 'This project has no file yet. Add one on Sources, then ask about it.';
  const name = file.original_filename || 'this file';
  const parts = [
    file.n_rows ? `${file.n_rows.toLocaleString('en-GB')} rows` : '',
    file.n_cols ? `${file.n_cols.toLocaleString('en-GB')} variables` : '',
  ].filter(Boolean);
  return parts.length ? `I've read ${name}: ${parts.join(', ')}.` : `I've read ${name}.`;
}

const STARTER_ICONS = [
  'M2 3h10v8H2zM2 6h10M6 3v8',
  'M3 3.5h8M3 7h8M3 10.5h5',
  'M2.5 4h9M2.5 7h6M2.5 10h7.5',
  'M3 11V7M6 11V4M9 11V6M12 11V3',
  'M2 3h10v8H2zM2 6h10M2 8.5h10M5.5 3v8',
  'M7 2.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9zM7 5v2.5l1.5 1',
];

function StarterIcon({ index }: { index: number }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path
        d={STARTER_ICONS[index % STARTER_ICONS.length]}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function chatStarters(file: DatasetRow): { title: string; detail: string; prompt: string }[] {
  const name = file.original_filename || 'this file';
  return [
    {
      title: `Summarise ${name}`,
      detail: 'Row count and the columns in this file',
      prompt: `Summarise ${name}.`,
    },
    {
      title: 'Which columns are categorical?',
      detail: 'A short list from this file',
      prompt: `Which columns in ${name} are categorical?`,
    },
    {
      title: 'Find the open-end columns',
      detail: 'Text columns that can be coded',
      prompt: `Which columns in ${name} look like open ends?`,
    },
    {
      title: 'Run descriptives',
      detail: 'Means for the numeric columns',
      prompt: `Run descriptives on the numeric columns in ${name}.`,
    },
    {
      title: 'Draft a column-percent table',
      detail: 'One stub and one banner from this file',
      prompt: `Draft a column percent table from ${name}.`,
    },
    {
      title: 'What should I look at first?',
      detail: 'A short read of this file',
      prompt: `What should I look at first in ${name}?`,
    },
  ];
}

function EmptyChat({
  file,
  ready,
  question,
  setQuestion,
  mode,
  setMode,
  send,
  sourcesHref,
  columns,
  attachments,
  onAttach,
  onRemoveAttachment,
  attachError,
}: {
  file?: DatasetRow;
  ready: boolean;
  question: string;
  setQuestion: (value: string) => void;
  mode: 'ask' | 'plan' | 'agent';
  setMode: (value: 'ask' | 'plan' | 'agent') => void;
  send: (text?: string) => void;
  sourcesHref: string;
  columns: string[] | null;
  attachments: AgentLoopAttachment[];
  onAttach: (list: FileList | null) => void;
  onRemoveAttachment: (filename: string) => void;
  attachError: string | null;
}) {
  const name = file?.original_filename || 'this file';
  return (
    <section className="flow-thread chat-stage">
      {!ready ? (
        <div className="chat-hero">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-10 w-full max-w-md" />
          <Skeleton className="h-4 w-full max-w-lg" />
          <div className="chat-starters">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-24 w-full" />
            ))}
          </div>
        </div>
      ) : (
        <div className="chat-hero">
          <div className="chat-hero-copy">
            <div className="chat-kicker">
              <i />
              Tensr agent
            </div>
            <h1>What do you want to find out?</h1>
            <p>{chatLead(file)}</p>
          </div>
          {file ? (
            <div className="chat-starters">
              {chatStarters(file).map((starter, index) => (
                <Button
                  key={starter.prompt}
                  className="chat-starter whitespace-normal items-start h-auto"
                  type="button"
                  onClick={() => send(starter.prompt)}
                >
                  <span className="chat-starter-mark">
                    <StarterIcon index={index} />
                  </span>
                  <span className="chat-starter-copy">
                    <strong>{starter.title}</strong>
                    <span>{starter.detail}</span>
                  </span>
                </Button>
              ))}
            </div>
          ) : (
            <Link className="flow-btn" href={sourcesHref}>
              Open sources
            </Link>
          )}
          <div className="chat-ask">
            <FlowComposer
              layout="hero"
              value={question}
              onChange={setQuestion}
              onSend={send}
              placeholder={
                file
                  ? `Ask about ${name}, or describe what you need. Type @ to point at a column.`
                  : 'Add a file on Sources, then ask about it.'
              }
              mode={mode}
              onMode={setMode}
              columns={columns}
              attachments={attachments}
              onAttach={onAttach}
              onRemoveAttachment={onRemoveAttachment}
              attachError={attachError}
            />
            <div className="chat-sources">
              <span>Can also read</span>
              <Badge tone="soon">Another project · coming soon</Badge>
              <Badge tone="soon">The web · coming soon</Badge>
              <Link href={sourcesHref}>+ Add source</Link>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function ChatScreen({
  project,
  datasets,
  ready,
  pendingAsk,
  onAsked,
}: {
  project?: FlowProject;
  datasets: DatasetRow[];
  ready: boolean;
  pendingAsk?: string | null;
  onAsked?: () => void;
}) {
  const datasetId =
    project?.active_dataset_id || datasets.find(row => row.project_id === project?.id)?.dataset_id;
  const [columns, setColumns] = useState<string[] | null>(null);
  const [columnLabels, setColumnLabels] = useState<
    { name: string; label?: string | null; value_labels?: Record<string, string> | null }[]
  >([]);
  const [recipes, setRecipes] = useState<FlowRecipe[] | null>(null);
  const [reportedRun, setReportedRun] = useState('');
  const file = chatFile(project, datasets);
  const projectHref = project ? `/flow/p/${project.id}` : '/flow';
  const chatProjectId = project?.id || '';
  const reportPins = useProjectPins(chatProjectId, datasetId ? [datasetId] : []);

  useEffect(() => {
    if (!datasetId) {
      setColumns([]);
      setColumnLabels([]);
      return;
    }
    let cancelled = false;
    setColumns(null);
    void flowJson<{
      columns?: {
        name?: string;
        label?: string | null;
        value_labels?: Record<string, string> | null;
      }[];
    }>(`/datasets/${datasetId}/metadata`)
      .then(meta => {
        if (cancelled) return;
        const listed = meta.columns || [];
        setColumns(
          listed.map(column => column.name || '').filter(name => name && !isInternalColumn(name))
        );
        setColumnLabels(
          listed
            .filter(column => column.name)
            .map(column => ({
              name: column.name || '',
              label: column.label,
              value_labels: column.value_labels,
            }))
        );
      })
      .catch(() => {
        if (!cancelled) {
          setColumns([]);
          setColumnLabels([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [datasetId]);

  const thread = useAgentThread({
    projectId: chatProjectId,
    datasetId,
    columnNames: columns,
    columnLabels,
    syncAddress: true,
    pendingAsk,
    onAsked,
  });
  const {
    question,
    setQuestion,
    mode,
    setMode,
    send,
    attachments,
    setAttachments,
    attachError,
    attachFiles,
    sessions,
    openSessionId,
    openChat,
    clearChat,
    setStatus,
    showThread,
    panelOpen,
    setPanelOpen,
    outputReady,
    tableMode,
    title,
    runIds,
    baseNote,
    ledger,
    tables,
    kind,
    structuredTables,
    footnote,
    resultChecks,
    resultView,
    takeaway,
    stat,
    checks,
    downloads,
  } = thread;
  const inReport =
    Boolean(runIds[0] && reportPins.some(pin => pin.runId === runIds[0])) ||
    reportedRun === runIds[0];
  const lettered = /\(([A-Z])\)/.test(tables.split('\n')[0] || '');
  const respondents = baseCount(baseNote);
  const addOutputToReport = () => {
    const runId = runIds[0];
    if (!runId || !datasetId || !chatProjectId) {
      setStatus('That result could not be added to the report.');
      return;
    }
    void savePin(chatProjectId, datasetId, {
      id: runId,
      runId,
      datasetId,
      headline: title,
      support: takeaway,
      citation: kind,
      afterId: '',
      deck: true,
      topline: true,
      keepLive: true,
    })
      .then(() => {
        setReportedRun(runId);
        setStatus('Added to the report.');
      })
      .catch(() => setStatus('That result could not be added to the report.'));
  };
  const exportRun = (format: 'pdf' | 'docx' | 'html', label: string) => {
    const stem = title.replace(/[^\w.-]+/g, '-').slice(0, 40) || 'analysis';
    void downloadExport(`/datasets/reports/pipeline/export?format=${format}`, `${stem}.${format}`, {
      method: 'POST',
      body: JSON.stringify({ run_ids: runIds }),
    }).catch(() => setStatus(`The ${label} export did not finish. Try again.`));
  };

  const [recipeNote, setRecipeNote] = useState<{
    text: string;
    error?: boolean;
    outputs?: boolean;
  } | null>(null);
  const [recipeBusy, setRecipeBusy] = useState('');

  const recipesAbort = useRef<AbortController | null>(null);
  const loadRecipes = useCallback(() => {
    recipesAbort.current?.abort();
    if (!chatProjectId) {
      setRecipes([]);
      return;
    }
    const controller = new AbortController();
    recipesAbort.current = controller;
    const timer = window.setTimeout(() => controller.abort('timeout'), 15000);
    void flowJson<{ recipes?: FlowRecipe[] }>(`/datasets/recipes?project_id=${chatProjectId}`, {
      signal: controller.signal,
    })
      .then(page => {
        if (recipesAbort.current !== controller) return;
        setRecipes(page.recipes || []);
      })
      .catch(err => {
        if (recipesAbort.current !== controller) return;
        const timedOut = controller.signal.reason === 'timeout';
        if (!timedOut && err instanceof DOMException && err.name === 'AbortError') return;
        setRecipes(current => current || []);
      })
      .finally(() => window.clearTimeout(timer));
  }, [chatProjectId]);

  useEffect(() => {
    loadRecipes();
    return () => recipesAbort.current?.abort();
  }, [loadRecipes]);

  const saveRecipe = async (name: string, ids: string[]) => {
    if (!project) return;
    if (!ids.length) {
      setRecipeNote({ text: 'Ask for an analysis first. Its run can then be saved as a recipe.' });
      return;
    }
    setRecipeBusy('save');
    setRecipeNote(null);
    try {
      const runs = await Promise.all(
        ids.map(id =>
          flowJson<{ op?: string; body?: Record<string, unknown> }>(`/datasets/analysis-runs/${id}`)
        )
      );
      const ops = runs
        .filter(run => run.op)
        .map(run => ({
          op: 'analysis',
          analysis_type: run.op,
          input: 'survey',
          body: Object.fromEntries(
            Object.entries(run.body || {}).filter(([key]) => key !== 'dataset_id')
          ),
        }));
      if (!ops.length) throw new Error('This run has no steps Tensr can replay.');
      await flowJson('/datasets/recipes', {
        method: 'POST',
        body: JSON.stringify({
          project_id: project.id,
          name: name.slice(0, 120) || 'Recipe',
          ops: [{ op: 'import', role: 'survey' }, ...ops],
          created_from: 'history',
        }),
      });
      setRecipeNote({ text: `Saved “${name}” as a recipe. Run it on any file from Recipes.` });
      loadRecipes();
    } catch (err) {
      setRecipeNote({
        text: err instanceof Error ? err.message : 'The recipe did not save.',
        error: true,
      });
    } finally {
      setRecipeBusy('');
    }
  };

  const runRecipe = async (recipe: FlowRecipe) => {
    if (!recipe.recipe_id) return;
    if (!datasetId) {
      setRecipeNote({ text: 'Open a file on Sources, then run the recipe on it.', error: true });
      return;
    }
    setRecipeBusy(recipe.recipe_id);
    setRecipeNote(null);
    try {
      const out = await flowJson<{ run_ids?: string[]; dataset_id?: string }>(
        `/datasets/recipes/${recipe.recipe_id}/versions/${recipe.version || 1}/run`,
        { method: 'POST', body: JSON.stringify({ dataset_id: datasetId }) }
      );
      const count = out.run_ids?.length || 0;
      setRecipeNote({
        text: count
          ? `Ran “${recipe.name || 'Recipe'}” on ${file?.original_filename || 'the open file'}. ${count} output${count === 1 ? '' : 's'} saved.`
          : `Ran “${recipe.name || 'Recipe'}”. The new working version is on Sources.`,
        outputs: count > 0,
      });
    } catch (err) {
      setRecipeNote({
        text: err instanceof Error ? err.message : 'The recipe did not run.',
        error: true,
      });
    } finally {
      setRecipeBusy('');
    }
  };

  return (
    <div
      className={
        showThread ? (panelOpen ? 'flow-split' : 'flow-split no-output') : 'flow-split chat-empty'
      }
    >
      <aside className="flow-rail">
        <Button className="chat-new" type="button" onClick={clearChat}>
          <NavIcon kind="plus" /> New chat
        </Button>
        <div className="flow-muted chat-label">Chats</div>
        {sessions === null ? (
          <Skeleton className="h-16 w-full" />
        ) : sessions.length === 0 ? (
          <div className="chat-empty-note">
            <div>No chats yet</div>
            <p>Your first question starts one. Every run is also kept in Outputs.</p>
          </div>
        ) : (
          sessions.map(session => (
            <Button
              key={session.session_id}
              className="chat-item"
              type="button"
              data-active={session.session_id === openSessionId}
              onClick={() => openChat(session.session_id)}
            >
              {chatTitle(session)}
            </Button>
          ))
        )}
        <div className="chat-recipe-head">
          <span className="flow-muted">Recipes</span>
          <Button
            className="chat-recipe-add"
            type="button"
            aria-label="Save this run as a recipe"
            title={runIds.length ? 'Save this run as a recipe' : 'Ask for an analysis first'}
            disabled={recipeBusy === 'save'}
            onClick={() => void saveRecipe(title, runIds)}
          >
            +
          </Button>
        </div>
        {recipes === null ? (
          <Skeleton className="h-8 w-full" />
        ) : (
          <>
            {recipes.map(recipe => {
              const steps = Array.isArray(recipe.ops)
                ? recipe.ops.filter(step => (step as { op?: string } | null)?.op !== 'import')
                    .length
                : 0;
              return (
                <Button
                  key={recipe.recipe_id}
                  className="chat-recipe"
                  type="button"
                  disabled={Boolean(recipeBusy)}
                  title={`Run on ${file?.original_filename || 'the open file'}`}
                  onClick={() => void runRecipe(recipe)}
                >
                  <span>{recipe.name || 'Recipe'}</span>
                  <span className="chat-recipe-steps">
                    {recipeBusy === recipe.recipe_id
                      ? 'Running…'
                      : `${steps} step${steps === 1 ? '' : 's'} · Run`}
                  </span>
                </Button>
              );
            })}
            {recipes.length === 0 ? (
              <p className="flow-muted chat-recipe-hint">
                Save any run as a recipe, then run it on another file.
              </p>
            ) : null}
          </>
        )}
        {recipeNote ? (
          <p
            className={
              recipeNote.error ? 'flow-error chat-recipe-note' : 'flow-muted chat-recipe-note'
            }
          >
            {recipeNote.text}{' '}
            {recipeNote.outputs ? (
              <Link href={`${projectHref}/report?pane=outputs`}>Open Outputs</Link>
            ) : null}
          </p>
        ) : null}
      </aside>
      {showThread ? (
        <>
          <section className="flow-thread">
            <AgentThreadColumn
              thread={thread}
              projectHref={projectHref}
              placeholder="Ask a follow-up... Type @ to point at a column."
            />
          </section>
          <FlowSidePanel
            id="chat-output"
            defaultWidth={440}
            className="flow-output"
            hidden={!panelOpen}
          >
            {outputReady && tableMode ? (
              <>
                <div className="output-tabs">
                  <span className="output-tab">T1 {title}</span>
                  {runIds.length ? (
                    <Button
                      className="flow-btn output-tab-export"
                      type="button"
                      onClick={() => exportRun('pdf', 'PDF')}
                    >
                      Export
                    </Button>
                  ) : null}
                  <Button
                    className="output-close"
                    type="button"
                    aria-label="Close output"
                    onClick={() => setPanelOpen(false)}
                  >
                    ×
                  </Button>
                </div>
                <div className="output-body output-table-body">
                  <div>
                    <h2>{title}</h2>
                    {baseNote ? <p className="flow-muted output-base">{baseNote}</p> : null}
                  </div>
                  <div className="report-chips">
                    <span className="report-chip">
                      Weight <span className="ink">{ledger.weight || 'none'}</span>
                    </span>
                    {lettered ? (
                      <span className="report-chip">
                        Sig <span className="ink">95%, letters</span>
                      </span>
                    ) : null}
                  </div>
                  <FlowMarkdown className="output-table">{tables}</FlowMarkdown>
                  {lettered ? (
                    <p className="flow-muted output-base">
                      Letters show the value is significantly higher than that column at 95%.
                    </p>
                  ) : null}
                </div>
                <div className="output-trace">
                  <span>
                    {respondents
                      ? `Traced to ${respondents} respondents`
                      : 'Traced to the open file'}
                    {file?.original_filename ? ` in ${file.original_filename}` : ''}
                  </span>
                  <Link href={`${projectHref}/tables`}>Open in Tables</Link>
                </div>
              </>
            ) : outputReady ? (
              <>
                <div className="output-lead">
                  <div className="output-kicker">
                    <span className="output-badge">{kind}</span>
                    <span className="flow-muted">Agent chat</span>
                    <Button
                      className="output-close"
                      type="button"
                      aria-label="Close output"
                      onClick={() => setPanelOpen(false)}
                    >
                      ×
                    </Button>
                  </div>
                  <h2>{title}</h2>
                  {baseNote && !structuredTables.length ? (
                    <p className="flow-muted output-base">{baseNote}</p>
                  ) : null}
                </div>
                <div className="output-body">
                  {structuredTables.length ? (
                    <AnalysisResult
                      tables={structuredTables}
                      footnote={footnote}
                      checks={resultChecks}
                      script={resultView.script}
                      rCheck={resultView.rCheck}
                      rStatement={resultView.rStatement}
                      runId={runIds[0]}
                    />
                  ) : (
                    <>
                      {tables ? (
                        <FlowMarkdown className="output-table">{tables}</FlowMarkdown>
                      ) : null}
                      {stat ? (
                        <div>
                          <div className="flow-muted">Key stat</div>
                          <div>{stat}</div>
                        </div>
                      ) : null}
                    </>
                  )}
                  {structuredTables.length ? null : checks.length ? (
                    <div>
                      <div className="flow-muted">Checks</div>
                      <div className="report-chips">
                        {checks.map(check => (
                          <span
                            key={check.label}
                            className={check.warn ? 'report-chip warn' : 'report-chip'}
                          >
                            {check.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="flow-row">
                    <Link
                      className="flow-btn primary"
                      href={
                        runIds[0]
                          ? `${projectHref}/report?pane=outputs&run=${encodeURIComponent(runIds[0])}`
                          : `${projectHref}/report?pane=outputs`
                      }
                    >
                      Open
                    </Link>
                    {structuredTables.length ? (
                      <Button
                        className="flow-btn"
                        type="button"
                        onClick={() =>
                          void navigator.clipboard.writeText(
                            documentApa({
                              title,
                              op: kind,
                              summary: takeaway,
                              base: respondents ? Number(respondents.replace(/,/g, '')) : null,
                              createdAt: '',
                              tables: structuredTables,
                              checks: resultChecks,
                              script: resultView.script,
                            })
                          )
                        }
                      >
                        Copy APA 7
                      </Button>
                    ) : null}
                  </div>
                  <div>
                    <div className="flow-muted">Used in</div>
                    <span className="output-badge">
                      {inReport ? 'This chat · in the report' : 'This chat · not in the report yet'}
                    </span>
                  </div>
                  {downloads.length > 0 || runIds.length > 0 ? (
                    <div className="output-export">
                      <div className="flow-muted">Export</div>
                      <div className="flow-row">
                        {runIds.length
                          ? (
                              [
                                ['pdf', 'PDF'],
                                ['docx', 'Word'],
                                ['html', 'HTML'],
                              ] as const
                            ).map(([format, label]) => (
                              <Button
                                key={format}
                                className="flow-btn output-format"
                                type="button"
                                onClick={() => exportRun(format, label)}
                              >
                                {label}
                              </Button>
                            ))
                          : null}
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
                    disabled={recipeBusy === 'save'}
                    onClick={() => void saveRecipe(title, runIds)}
                  >
                    {recipeBusy === 'save' ? 'Saving…' : 'Save as recipe'}
                  </Button>
                  <Button
                    className="flow-btn"
                    type="button"
                    disabled={!runIds[0] || !datasetId || inReport}
                    onClick={addOutputToReport}
                  >
                    {inReport ? 'In report' : 'Add to report'}
                  </Button>
                  <Link className="flow-btn primary output-open" href={`${projectHref}/tables`}>
                    Open
                  </Link>
                </div>
              </>
            ) : (
              <p className="flow-muted output-empty">An output from this chat lands here.</p>
            )}
          </FlowSidePanel>
        </>
      ) : (
        <EmptyChat
          file={file}
          ready={ready}
          question={question}
          setQuestion={setQuestion}
          mode={mode}
          setMode={setMode}
          send={send}
          sourcesHref={`${projectHref}/sources`}
          columns={columns}
          attachments={attachments}
          onAttach={attachFiles}
          onRemoveAttachment={filename =>
            setAttachments(current => current.filter(item => item.filename !== filename))
          }
          attachError={attachError}
        />
      )}
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
    setNote('Thinking…');
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
      {phase === 'warming' ? <p>Thinking…</p> : null}
      {phase === 'error' ? <p className="flow-error">{note}</p> : null}
    </aside>
  );
}

type CachedSheet = {
  columns: FlowColumn[];
  headers: string[];
  variableNames: string[];
  rows: unknown[][];
  n: number;
};

const sheetPages = new Map<string, CachedSheet>();

function fileChoices(
  rows: {
    dataset_id?: string;
    id?: string;
    original_filename?: string;
    source_filenames?: string[];
  }[],
  selected: string
): { value: string; label: string }[] {
  const options = rows.map(row => ({
    value: datasetRowId(row),
    label: datasetFileLabel(row),
  }));
  if (!selected || options.some(option => option.value === selected)) return options;
  return [{ value: selected, label: rememberedFileName(selected) || 'Opening file' }, ...options];
}

function ResponsesScreen({
  project,
  datasets,
  ready = true,
  onChanged,
}: {
  project?: FlowProject;
  datasets: DatasetRow[];
  ready?: boolean;
  onChanged?: () => void;
}) {
  const router = useRouter();
  const [chosenId, setChosenId] = useState<string | null>(null);
  const projectKey = project?.id || '';
  const fallback = datasets.find(row => row.project_id === project?.id);
  const datasetId =
    chosenId || project?.active_dataset_id || (fallback ? datasetRowId(fallback) : '');
  const [tab, setTab] = useState<'sheet' | 'notebook' | 'evidence' | 'themes'>('sheet');
  const [columns, setColumns] = useState<FlowColumn[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [variableNames, setVariableNames] = useState<string[]>([]);
  const [preview, setPreview] = useState<unknown[][]>([]);
  const [pageOffset, setPageOffset] = useState(0);
  const [rowTotal, setRowTotal] = useState(0);
  const pageSize = 50;
  const [query, setQuery] = useState('');
  const [hiddenCols, setHiddenCols] = useState<string[]>([]);
  const [sortCol, setSortCol] = useState<{ index: number; dir: 'asc' | 'desc' } | null>(null);
  const [editingCell, setEditingCell] = useState<{
    index: number;
    column: string;
    value: string;
  } | null>(null);
  const [colMenu, setColMenu] = useState<{
    name: string;
    field: string;
    index: number;
    x: number;
    y: number;
  } | null>(null);
  const [sheetNote, setSheetNote] = useState('');
  const [sessions, setSessions] = useState<FlowSession[] | null>(null);
  const [specs, setSpecs] = useState<
    { id: string; label: string; note?: string; number?: number }[] | null
  >(null);
  const [sheetPhase, setSheetPhase] = useState<'loading' | 'ready' | 'error' | 'empty'>('loading');
  const [sheetAttempt, setSheetAttempt] = useState(0);
  const [selectedCol, setSelectedColState] = useState(0);
  const [colPicked, setColPicked] = useState(false);
  const [frameName, setFrameName] = useState('');
  const setSelectedCol = (index: number) => {
    setFrameName('');
    setColPicked(true);
    setSelectedColState(index);
  };
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [side, setSide] = useState<'agent' | 'variable' | 'evidence'>('variable');
  const [showStats, setShowStats] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<FlowFilter[]>([]);
  const [reviewing, setReviewing] = useState<string | null>(null);
  // The theme last reviewed reopens with its new counts once the coded version is in use.
  const [reopenTheme, setReopenTheme] = useState('');
  const filtersKey = JSON.stringify(filters);
  const sheetKey = `${datasetId || ''}:${pageOffset}:${filtersKey}`;
  const [valueFilter, setValueFilter] = useState<string | null>(null);
  const [anovaOpen, setAnovaOpen] = useState(false);
  const [weightOpen, setWeightOpen] = useState(false);
  const [columnCounts, setColumnCounts] = useState<
    Record<
      string,
      {
        counts?: Record<string, number>;
        value_labels?: Record<string, string>;
        missing?: number;
        n: number;
        fallback?: boolean;
      }
    >
  >({});
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
      setSheetPhase(ready && projectKey ? 'empty' : 'loading');
      return;
    }
    let cancelled = false;
    const cached = sheetPages.get(sheetKey);
    if (cached) {
      setColumns(cached.columns);
      setHeaders(cached.headers);
      setVariableNames(cached.variableNames);
      setPreview(cached.rows);
      setRowTotal(cached.n);
      setSheetPhase('ready');
    } else {
      setSheetPhase('loading');
    }
    const load = () =>
      flowJson<{
        rows?: unknown[][];
        headers?: string[];
        variable_names?: string[];
        n_rows?: number;
        columns?: FlowColumn[];
      }>(
        `/datasets/${datasetId}/preview?limit=${filters.length ? 1000 : pageSize}&offset=${filters.length ? 0 : pageOffset}`
      ).then(page => [{ columns: page.columns || [] }, page] as const);
    const wait = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms));
    void load()
      .catch(() => wait(1200).then(load))
      .then(([meta, page]) => {
        if (cancelled) return;
        const next = {
          columns: meta.columns || [],
          headers: page.headers || [],
          variableNames: page.variable_names || [],
          rows: page.rows || [],
          n: page.n_rows || 0,
        };
        sheetPages.set(sheetKey, next);
        setColumns(next.columns);
        setHeaders(next.headers);
        setVariableNames(next.variableNames);
        setPreview(next.rows);
        setRowTotal(next.n);
        setSheetPhase('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setPreview([]);
        setHeaders([]);
        setSheetPhase('error');
      });
    return () => {
      cancelled = true;
    };
  }, [datasetId, pageOffset, ready, projectKey, sheetAttempt, filtersKey, sheetKey]);
  useEffect(() => {
    if (!project) return;
    void flowJson<{ sessions?: FlowSession[] }>(`/api/projects/${project.id}/sessions`)
      .then(page => setSessions(page.sessions || []))
      .catch(() => setSessions([]));
  }, [project]);
  useEffect(() => {
    if (!datasetId || !project?.id) return;
    const fileIds = datasets
      .filter(row => row.project_id === project.id)
      .map(row => datasetRowId(row))
      .filter(Boolean);
    void loadProjectTables(project.id, datasetId, { fileIds })
      .then(rows =>
        setSpecs(
          rows.map(row => ({
            id: `${row.datasetId}:${row.id}`,
            label: row.label,
            note: tableFileNote(row, datasetId),
            number: row.number,
          }))
        )
      )
      .catch(() => setSpecs([]));
  }, [datasetId, datasets, project?.id]);

  const names = headers.length ? headers : columns.map(column => column.label || column.name);
  const needle = query.trim().toLowerCase();
  const visibleNames = names
    .map((name, index) => ({ name, index }))
    .filter(column => !isInternalColumn(column.name));
  const headerHits = visibleNames.filter(
    column => !needle || column.name.toLowerCase().includes(needle)
  );
  const shownCols = (headerHits.length ? headerHits : visibleNames).filter(
    column => !hiddenCols.includes(column.name)
  );
  const saveCell = (column: string, previewIndex: number, value: string) => {
    if (!datasetId) return;
    const row = (filters.length ? 0 : pageOffset) + previewIndex;
    void flowJson<{ dataset_id?: string }>(`/datasets/${datasetId}/edit-cell`, {
      method: 'POST',
      body: JSON.stringify({ column, row, value }),
    })
      .then(saved => {
        const next = String(saved.dataset_id || '');
        setEditingCell(null);
        setSheetNote('Saved as a new version.');
        if (!next || !project?.id) return;
        setChosenId(next);
        void flowJson(`/api/projects/${project.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ active_dataset_id: next }),
        });
        onChanged?.();
      })
      .catch(err => setSheetNote(err instanceof Error ? err.message : 'The cell was not saved.'));
  };
  const reviseColumn = (path: string, body: Record<string, unknown>, note: string) => {
    if (!datasetId) return;
    setColMenu(null);
    void flowJson<{ dataset_id?: string }>(`/datasets/${datasetId}/${path}`, {
      method: 'POST',
      body: JSON.stringify(body),
    })
      .then(saved => {
        const next = String(saved.dataset_id || '');
        setSheetNote(note);
        if (!next || !project?.id) return;
        setChosenId(next);
        void flowJson(`/api/projects/${project.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ active_dataset_id: next }),
        });
        onChanged?.();
      })
      .catch(err =>
        setSheetNote(err instanceof Error ? err.message : 'That change was not saved.')
      );
  };
  const columnMeta = (name: string) =>
    columns.find(column => column.name === name || column.label === name);
  const fieldAt = (index: number, header: string) =>
    variableNames[index] || columnMeta(header)?.name || header;
  const firstSubstantive = Math.max(
    0,
    shownCols.findIndex(
      column =>
        !isIdColumn(
          column.name,
          preview.map(row => row[column.index])
        ) && !isIdColumn(columnMeta(column.name)?.name || '', [])
    )
  );
  const pickedCol = colPicked ? selectedCol : firstSubstantive;
  const numericColumns = new Set(
    shownCols
      .filter(column => {
        const values = preview
          .map(row => row[column.index])
          .filter(value => value != null && value !== '' && value !== 'null');
        return values.length > 0 && values.every(isNumberValue);
      })
      .map(column => column.index)
  );
  const activeIndex = shownCols[pickedCol]?.index ?? shownCols[0]?.index ?? 0;
  const shownRows = preview
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => rowPassesFilters(row, names, filters, columns))
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
  const sortToken = (cell: unknown, index: number) => {
    const text = cell == null || cell === 'null' ? '' : String(cell);
    const labels =
      columnMeta(names[index] || '')?.value_labels ||
      columnMeta(variableNames[index] || '')?.value_labels;
    if (labels) {
      const code = Object.entries(labels).find(([, label]) => label === text)?.[0];
      if (code != null) return code;
    }
    return text;
  };
  const orderedRows = !sortCol
    ? shownRows
    : [...shownRows].sort((left, right) => {
        const compared = sortToken(left.row[sortCol.index], sortCol.index).localeCompare(
          sortToken(right.row[sortCol.index], sortCol.index),
          undefined,
          { numeric: true }
        );
        return sortCol.dir === 'asc' ? compared : -compared;
      });
  const activeName = names[activeIndex] || 'Variable';
  const isCoded = (column: FlowColumn) =>
    column.name.endsWith('_codes') || String(column.label || '').startsWith('Codes for');
  const codedColumn =
    (frameName
      ? columns.find(column => column.name === frameName && isCoded(column))
      : undefined) ||
    columns.find(column => {
      const matches = column.name === activeName || column.label === activeName;
      return matches && isCoded(column);
    });
  const columnValues = (column?: FlowColumn) => {
    if (!column) return [];
    const index = names.findIndex(name => name === column.name || name === column.label);
    if (index < 0) return [];
    return preview.map(row =>
      row[index] == null || row[index] === 'null' ? '' : String(row[index])
    );
  };
  const activeValues = preview.map(row =>
    row[activeIndex] == null || row[activeIndex] === 'null' ? '' : String(row[activeIndex])
  );
  const variableName = columnMeta(activeName)?.name || activeName;
  const fileKey = `${datasetId}:${variableName}`;
  const fetched = columnCounts[fileKey];
  const countsSettled = Boolean(fetched);
  const filePage = fetched && !fetched.fallback ? fetched : undefined;
  const counts = filePage ? fileCounts(filePage) : valueCounts(activeValues);
  const countTotal = (filePage ? filePage.n : activeValues.length) || 1;
  const missingCount = filePage
    ? filePage.missing || 0
    : activeValues.filter(value => value === '').length;
  const projectDatasets = datasets.filter(row => !project || row.project_id === project.id);
  const uidIndex = names.indexOf('_row_uid');
  const idIndex = names.findIndex(name =>
    ['id', 'respondent_id', 'respid', 'respondentid'].includes(name.toLowerCase())
  );
  const evidenceIds = new Set(evidenceSheet.ids);
  const evidenceColumn = surveyCell?.textColumn || '';
  const columnMarked = (name: string, index: number) =>
    evidenceColumn ? name === evidenceColumn : index === activeIndex;

  useEffect(() => {
    if (!datasetId || sheetPhase !== 'ready' || !variableName || columnCounts[fileKey]) return;
    let cancelled = false;
    void flowJson<{
      counts?: Record<string, number>;
      value_labels?: Record<string, string>;
      missing?: number;
      n?: number;
    }>(`/datasets/${datasetId}/columns/${encodeURIComponent(variableName)}/values`)
      .then(page => {
        if (cancelled) return;
        setColumnCounts(current => ({
          ...current,
          [fileKey]: page.counts ? { ...page, n: page.n || 0 } : { n: 0, fallback: true },
        }));
      })
      .catch(() => {
        if (!cancelled) {
          setColumnCounts(current => ({ ...current, [fileKey]: { n: 0, fallback: true } }));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [datasetId, sheetPhase, variableName, fileKey, columnCounts]);

  const viewSwitch = (
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
  );

  return (
    <div className={tab === 'notebook' ? 'responses-layout notebook-mode' : 'responses-layout'}>
      <aside className="responses-rail">
        {tab === 'notebook' ? (
          <div className="notebook-vars">
            <div className="rail-head">
              <span className="flow-muted">Variables</span>
              <span className="flow-muted">{visibleNames.length}</span>
            </div>
            {visibleNames
              .filter(column => !needle || column.name.toLowerCase().includes(needle))
              .map(column => (
                <div key={`${column.name}-${column.index}`} className="notebook-var">
                  <span className="notebook-var-type">
                    {isNumericColumn(columnMeta(column.name)) ? '#' : 'T'}
                  </span>
                  <span>{column.name}</span>
                </div>
              ))}
          </div>
        ) : null}
        <Input
          value={query}
          placeholder={tab === 'notebook' ? 'Find variable' : 'Search this project'}
          aria-label={tab === 'notebook' ? 'Find variable' : 'Search this project'}
          onChange={event => setQuery(event.target.value)}
        />
        <div>
          <div className="rail-head">
            <span className="flow-muted">Chats</span>
            {project ? (
              <Link className="rail-plus" href={`/flow/p/${project.id}/chat`} aria-label="New chat">
                +
              </Link>
            ) : null}
          </div>
          {sessions === null ? (
            <Skeleton className="h-8 w-full" />
          ) : sessions.length === 0 ? (
            <p className="flow-muted">No saved chats yet</p>
          ) : (
            sessions.slice(0, 6).map(session => (
              <Button
                key={session.session_id}
                className="chat-item rail-chat"
                type="button"
                onClick={() =>
                  project && router.push(`/flow/p/${project.id}/chat?session=${session.session_id}`)
                }
              >
                <span>{chatTitle(session)}</span>
                <span className="flow-muted">{shortAgo(session.updated_at)}</span>
              </Button>
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
              <Link key={spec.id} className="rail-analysis" href={`/flow/p/${project?.id}/tables`}>
                <span className="rail-badge">T{spec.number || ''}</span>
                <span className="rail-analysis-copy">
                  <span>
                    {titledWithQuestions(
                      spec.label,
                      columns.map(column => ({
                        name: column.name,
                        label: column.label || undefined,
                      }))
                    )}
                  </span>
                  <span className="flow-muted">{spec.note || 'Custom Tables'}</span>
                </span>
              </Link>
            ))
          )}
        </div>
      </aside>
      <section className="responses-sheet">
        <div className="sheet-toolbar" hidden={tab === 'notebook'}>
          <ChoiceSelect
            className="w-[150px] shrink-0"
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
            options={fileChoices(projectDatasets, datasetId || '')}
          />
          {viewSwitch}
          {tab === 'themes' || tab === 'notebook' ? null : (
            <>
              <Button
                className="flow-btn"
                type="button"
                data-active={showStats}
                onClick={() => setShowStats(current => !current)}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                  <path
                    d="M2 10V6M5 10V3M8 10V5M11 10V2"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                  />
                </svg>
                Stats
              </Button>
              <Button
                className={surveyCell ? 'flow-btn hidden' : 'flow-btn'}
                type="button"
                data-active={filtersOpen || filters.length > 0 || undefined}
                onClick={() => setFiltersOpen(current => !current)}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                  <path
                    d="M1.5 2h9L7 6.5V10L5 9V6.5z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinejoin="round"
                  />
                </svg>
                Filters{needle || valueFilter != null ? ' 1' : ''}
              </Button>
              {surveyCell ? (
                <>
                  <Button
                    className="flow-btn sheet-evidence-chip"
                    type="button"
                    data-active
                    onClick={() => setSurveyCell(null)}
                  >
                    Evidence · {surveyCell.textColumn} · {surveyCell.n || evidenceSheet.ids.length}{' '}
                    rows ×
                  </Button>
                  <Button className="flow-btn" type="button" onClick={() => setSurveyCell(null)}>
                    Back to all
                  </Button>
                </>
              ) : null}
              <span className="sheet-spacer" />
            </>
          )}
        </div>
        {filters.length ? (
          <div className="sheet-toolbar sheet-filter-bar">
            <span>
              <strong>Filters</strong>{' '}
              {describeFilters(
                filters,
                columns.map(column => ({ ...column, label: column.label || undefined }))
              )}
              {preview.length >= 1000 ? ' · first 1,000 rows' : ''}
            </span>
            <Button className="flow-btn" type="button" onClick={() => setFilters([])}>
              Clear
            </Button>
          </div>
        ) : null}
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
        {tab === 'notebook' ? <FlowNotebook datasetId={datasetId} lead={viewSwitch} /> : null}
        {tab === 'themes' ? (
          reviewing && datasetId ? (
            <CodingReview
              datasetId={datasetId}
              codeColumn={reviewing.endsWith('_codes') ? reviewing : `${reviewing}_codes`}
              textColumn={reviewing.replace(/_codes$/, '')}
              onDone={result => {
                setReopenTheme(result?.codeColumn || reviewing);
                setReviewing(null);
                if (result?.datasetId) {
                  const files = projectDatasets.map(row => ({
                    id: datasetRowId(row),
                    name: datasetFileLabel(row),
                    createdAt: row.updated_at,
                    updatedAt: row.updated_at,
                    lineageLabel: row.lineage_label,
                    parentId: row.parent_dataset_id,
                  }));
                  // Include the brand-new version so Done can adopt it even before the list refreshes.
                  const withNext = [
                    ...files,
                    {
                      id: result.datasetId,
                      name: result.datasetId,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                      lineageLabel: 'coded comments',
                    },
                  ];
                  const adopt = shouldAdoptCodingVersion(
                    project?.active_dataset_id || datasetId,
                    result.datasetId,
                    withNext
                  );
                  if (adopt) {
                    setChosenId(result.datasetId);
                    if (project) {
                      void flowJson(`/api/projects/${project.id}`, {
                        method: 'PATCH',
                        body: JSON.stringify({ active_dataset_id: result.datasetId }),
                      });
                    }
                  }
                  onChanged?.();
                }
              }}
            />
          ) : (
            <ThemesPanel
              key={`${datasetId}:${reopenTheme}`}
              datasetId={datasetId}
              projectId={project?.id}
              files={projectDatasets.map(row => ({
                id: datasetRowId(row),
                name: datasetFileLabel(row),
                createdAt: row.created_at,
                updatedAt: row.updated_at,
                lineageLabel: row.lineage_label,
                producingOperation: row.producing_operation,
                parentId: row.parent_dataset_id,
                originId: row.origin_dataset_id,
              }))}
              initialStub={reopenTheme}
              onReview={column => setReviewing(column)}
              onUseNewer={nextId => {
                if (!project?.id || !nextId) return;
                void flowJson(`/api/projects/${project.id}`, {
                  method: 'PATCH',
                  body: JSON.stringify({ active_dataset_id: nextId }),
                }).then(() => onChanged?.());
              }}
              onSelectCell={cell => {
                setSurveyCell(cell);
                setSide('evidence');
              }}
              onEditFrame={column => {
                setFrameName(column);
                const match = columns.find(item => item.name === column);
                const header = match?.label || column;
                const position = shownCols.findIndex(
                  item => item.name === header || item.name === column
                );
                if (position >= 0) {
                  setColPicked(true);
                  setSelectedColState(position);
                }
                setSide('variable');
              }}
            />
          )
        ) : null}
        {tab === 'sheet' || tab === 'evidence' ? (
          sheetPhase === 'loading' ? (
            <div className="sheet-scroll" aria-busy="true">
              {Array.from({ length: 8 }, (_, index) => (
                <Skeleton key={index} className="mb-2 h-8 w-full" />
              ))}
            </div>
          ) : sheetPhase === 'empty' || sheetPhase === 'error' ? (
            <div className="sheet-state" role={sheetPhase === 'error' ? 'alert' : undefined}>
              <span className="sheet-state-mark" data-tone={sheetPhase}>
                {sheetPhase === 'error' ? '!' : '+'}
              </span>
              <strong>
                {sheetPhase === 'error' ? 'This file didn’t load' : 'No file in this project yet'}
              </strong>
              <p>
                {sheetPhase === 'error'
                  ? 'Tensr tried twice and couldn’t read the responses. Try again, or open another file from Sources.'
                  : 'Upload a survey file on Sources and its responses show here.'}
              </p>
              <div className="sheet-state-actions">
                {sheetPhase === 'error' ? (
                  <Button
                    className="flow-btn primary"
                    type="button"
                    onClick={() => setSheetAttempt(value => value + 1)}
                  >
                    Try again
                  </Button>
                ) : null}
                <Link
                  className={sheetPhase === 'error' ? 'flow-btn' : 'flow-btn primary'}
                  href={`/flow/p/${project?.id || ''}/sources`}
                >
                  {sheetPhase === 'error' ? 'Open Sources' : 'Add a file'}
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div
                ref={sheetRef}
                className="sheet-frame"
                tabIndex={0}
                onKeyDown={event => {
                  if (editingCell || !orderedRows.length) return;
                  const row = selectedRow ?? 0;
                  const col = selectedCol ?? 0;
                  if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    setSelectedRow(Math.min(row + 1, orderedRows.length - 1));
                  } else if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    setSelectedRow(Math.max(row - 1, 0));
                  } else if (event.key === 'ArrowRight') {
                    event.preventDefault();
                    setSelectedCol(Math.min(col + 1, shownCols.length - 1));
                  } else if (event.key === 'ArrowLeft') {
                    event.preventDefault();
                    setSelectedCol(Math.max(col - 1, 0));
                  } else if (event.key === 'Enter' && shownCols[col]) {
                    const current = orderedRows[row];
                    if (!current) return;
                    const column = shownCols[col];
                    setEditingCell({
                      index: current.index,
                      column: column.name,
                      value:
                        current.row[column.index] == null || current.row[column.index] === 'null'
                          ? ''
                          : String(current.row[column.index]),
                    });
                  }
                }}
              >
                <ScrollArea className="sheet-scroll">
                  <Table className="flow-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        {shownCols.map((column, position) => (
                          <th
                            key={`${column.name}-${column.index}`}
                            data-numeric={numericColumns.has(column.index) || undefined}
                          >
                            <Button
                              type="button"
                              className="sheet-col"
                              data-active={columnMarked(column.name, column.index)}
                              onClick={() => {
                                setSelectedCol(position);
                                if (!surveyCell) setSide('variable');
                              }}
                              onContextMenu={event => {
                                event.preventDefault();
                                setColMenu({
                                  name: column.name,
                                  field: fieldAt(column.index, column.name),
                                  index: column.index,
                                  x: event.clientX,
                                  y: event.clientY,
                                });
                              }}
                            >
                              <span className="sheet-col-name">{column.name}</span>
                              <span className="sheet-col-label">
                                {(() => {
                                  const meta = columnMeta(column.name);
                                  const measure = String(meta?.measure || '').toLowerCase();
                                  if (
                                    measure === 'nominal' ||
                                    measure === 'ordinal' ||
                                    measure === 'scale'
                                  )
                                    return measure;
                                  const label =
                                    meta?.label && meta.label !== column.name ? meta.label : '';
                                  if (label) return label;
                                  const type = String(meta?.type || '').toLowerCase();
                                  if (
                                    ['numeric', 'number', 'float', 'integer', 'double'].includes(
                                      type
                                    )
                                  )
                                    return '123';
                                  return type ? 'abc' : '\u00a0';
                                })()}
                              </span>
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
                      {orderedRows.map(({ row, index }) => {
                        const inEvidence =
                          (uidIndex >= 0 && evidenceIds.has(String(row[uidIndex] ?? ''))) ||
                          (idIndex >= 0 && evidenceIds.has(String(row[idIndex] ?? '')));
                        return (
                          <tr
                            key={index}
                            data-active={selectedRow === index}
                            data-evidence={inEvidence || undefined}
                            data-clickable
                            onClick={() => setSelectedRow(index)}
                          >
                            <td className="sheet-rownum">
                              <Button type="button" onClick={() => setSelectedRow(index)}>
                                {pageOffset + index + 1}
                              </Button>
                            </td>
                            {shownCols.map(column => (
                              <td
                                key={column.index}
                                className="sheet-cell"
                                data-numeric={isNumberValue(row[column.index]) || undefined}
                                data-active={columnMarked(column.name, column.index)}
                                onDoubleClick={() => {
                                  const shown =
                                    row[column.index] == null || row[column.index] === 'null'
                                      ? ''
                                      : String(row[column.index]);
                                  const labels = columnMeta(column.name)?.value_labels;
                                  const code =
                                    labels &&
                                    Object.entries(labels).find(
                                      ([, label]) => label === shown
                                    )?.[0];
                                  setEditingCell({
                                    index,
                                    column: column.name,
                                    value: code ?? shown,
                                  });
                                }}
                              >
                                {editingCell &&
                                editingCell.index === index &&
                                editingCell.column === column.name ? (
                                  columnMeta(column.name)?.value_labels &&
                                  Object.keys(columnMeta(column.name)?.value_labels || {})
                                    .length ? (
                                    <ChoiceSelect
                                      aria-label={`Edit ${column.name}`}
                                      value={editingCell.value}
                                      onValueChange={next => {
                                        setEditingCell({ ...editingCell, value: next });
                                        saveCell(fieldAt(column.index, column.name), index, next);
                                      }}
                                      options={Object.entries(
                                        columnMeta(column.name)?.value_labels || {}
                                      ).map(([code, label]) => ({ value: code, label }))}
                                    />
                                  ) : (
                                    <Input
                                      aria-label={`Edit ${column.name}`}
                                      value={editingCell.value}
                                      autoFocus
                                      onChange={event =>
                                        setEditingCell({
                                          ...editingCell,
                                          value: event.target.value,
                                        })
                                      }
                                      onKeyDown={event => {
                                        if (event.key === 'Enter')
                                          saveCell(
                                            fieldAt(column.index, column.name),
                                            index,
                                            editingCell.value
                                          );
                                        if (event.key === 'Escape') setEditingCell(null);
                                      }}
                                      onBlur={() =>
                                        saveCell(
                                          fieldAt(column.index, column.name),
                                          index,
                                          editingCell.value
                                        )
                                      }
                                    />
                                  )
                                ) : row[column.index] == null || row[column.index] === 'null' ? (
                                  ''
                                ) : (
                                  String(row[column.index])
                                )}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </ScrollArea>
              </div>
              {colMenu ? (
                <div
                  className="column-menu"
                  style={{ left: colMenu.x, top: colMenu.y }}
                  role="menu"
                >
                  <Button
                    type="button"
                    onClick={() => {
                      setSortCol({ index: colMenu.index, dir: 'asc' });
                      setColMenu(null);
                    }}
                  >
                    Sort ascending
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setSortCol({ index: colMenu.index, dir: 'desc' });
                      setColMenu(null);
                    }}
                  >
                    Sort descending
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setFiltersOpen(true);
                      setColMenu(null);
                    }}
                  >
                    Filter
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      const from = window.prompt('Value to recode') || '';
                      const to = window.prompt('New value') || '';
                      if (!from) return;
                      reviseColumn(
                        'recode',
                        {
                          source_column: colMenu.field,
                          mappings: [{ from_value: from, to_value: to }],
                          replace_existing: true,
                          unmapped_policy: 'copy',
                        },
                        'Recode saved as a new version.'
                      );
                    }}
                  >
                    Recode
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      const target = window.prompt('New column name') || '';
                      const expr = window.prompt('Expression, such as this column >= 1') || '';
                      if (!target || !expr) return;
                      reviseColumn(
                        'compute',
                        { transforms: [{ kind: 'formula', target, expr }] },
                        'Computed column saved as a new version.'
                      );
                    }}
                  >
                    Compute from this column
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      const measure =
                        window.prompt('Measure level: nominal, ordinal, or scale') || '';
                      if (!measure || !datasetId) return;
                      setColMenu(null);
                      void flowJson(`/datasets/${datasetId}/metadata`, {
                        method: 'PUT',
                        body: JSON.stringify({ columns: { [colMenu.field]: { measure } } }),
                      })
                        .then(() => setSheetNote('Measure level saved.'))
                        .catch(err =>
                          setSheetNote(
                            err instanceof Error ? err.message : 'The measure was not saved.'
                          )
                        );
                    }}
                  >
                    Change measure level
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      const label = window.prompt('Column label') || '';
                      if (!label || !datasetId) return;
                      setColMenu(null);
                      void flowJson(`/datasets/${datasetId}/metadata`, {
                        method: 'PUT',
                        body: JSON.stringify({ columns: { [colMenu.field]: { label } } }),
                      })
                        .then(() => setSheetNote('Label saved.'))
                        .catch(err =>
                          setSheetNote(
                            err instanceof Error ? err.message : 'The label was not saved.'
                          )
                        );
                    }}
                  >
                    Edit label
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      if (project)
                        router.push(
                          `/flow/p/${project.id}/tables?banner=${encodeURIComponent(colMenu.field)}`
                        );
                      setColMenu(null);
                    }}
                  >
                    Use as banner
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      if (project)
                        router.push(
                          `/flow/p/${project.id}/tables?stub=${encodeURIComponent(colMenu.field)}`
                        );
                      setColMenu(null);
                    }}
                  >
                    Use as stub
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setHiddenCols(current => [...current, colMenu.name]);
                      setColMenu(null);
                    }}
                  >
                    Hide
                  </Button>
                  <Button
                    type="button"
                    onClick={() =>
                      reviseColumn(
                        'drop-column',
                        { column: colMenu.field },
                        'Column removed in a new version.'
                      )
                    }
                  >
                    Delete
                  </Button>
                </div>
              ) : null}
              <div className="sheet-foot">
                <span>
                  {rowTotal} respondent{rowTotal === 1 ? '' : 's'}
                </span>
                <span>
                  {selectedRow == null
                    ? 'No row selected'
                    : `Row ${pageOffset + selectedRow + 1} selected`}
                  {sheetNote ? ` · ${sheetNote}` : ''}
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
      {tab === 'notebook' ? (
        <aside className="notebook-icons" aria-label="Panels">
          {(['agent', 'variable', 'evidence'] as const).map(item => (
            <Button
              key={item}
              type="button"
              aria-label={item[0].toUpperCase() + item.slice(1)}
              onClick={() => {
                setSide(item);
                setTab('sheet');
              }}
            >
              {item === 'agent' ? '✦' : item === 'variable' ? '▤' : '❝'}
            </Button>
          ))}
        </aside>
      ) : null}
      {filtersOpen && datasetId ? (
        <FlowSidePanel
          id="responses"
          defaultWidth={300}
          className="responses-side responses-filters"
        >
          <FiltersPanel
            datasetId={datasetId}
            columns={columns
              .filter(column => !isInternalColumn(column.name))
              .map(column => ({ ...column, label: column.label || undefined }))}
            filters={filters}
            onChange={setFilters}
            onClose={() => setFiltersOpen(false)}
            onUseOnTables={applied => {
              try {
                window.sessionStorage.setItem(
                  `tensr-table-filter:${datasetId}`,
                  JSON.stringify(tableFilterRef(applied))
                );
              } catch {
                // Tables opens without the filter if storage is unavailable.
              }
              if (project) router.push(`/flow/p/${project.id}/tables`);
            }}
          />
        </FlowSidePanel>
      ) : null}
      <FlowSidePanel
        id="responses"
        defaultWidth={300}
        className="responses-side"
        hidden={
          tab === 'notebook' ||
          (filtersOpen && Boolean(datasetId)) ||
          (tab === 'themes' && Boolean(reviewing))
        }
      >
        <div className="sheet-toolbar">
          <Segmented
            className="side-tabs"
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
          <EvidencePanel
            datasetId={datasetId}
            projectId={project?.id}
            variable={
              countsSettled
                ? {
                    label: columnMeta(activeName)?.label || activeName,
                    rows: counts,
                    total: countTotal,
                  }
                : undefined
            }
          />
        ) : side === 'agent' ? (
          <div className="responses-agent">
            <AgentThread
              projectId={project?.id || ''}
              datasetId={datasetId}
              columnNames={names}
              columnLabels={columns.map(column => ({
                name: column.name,
                label: column.label,
                value_labels: column.value_labels,
              }))}
              placeholder={`Ask about ${activeName}`}
              projectHref={project ? `/flow/p/${project.id}` : '/flow'}
              emptyTitle="Ask about these responses"
              emptyDescription="Questions about the open file show up here."
              onSession={row =>
                setSessions(current => {
                  const rest = (current || []).filter(item => item.session_id !== row.session_id);
                  return [row, ...rest];
                })
              }
            />
          </div>
        ) : (
          <ScrollArea className="sheet-scroll">
            {side === 'variable' && codedColumn ? (
              <CodeFrameRail
                datasetId={datasetId}
                column={codedColumn.name}
                title={codedColumn.name.replace(/_codes$/, '')}
                question={
                  columns.find(item => item.name === codedColumn.name.replace(/_codes$/, ''))
                    ?.label || ''
                }
                values={columnValues(codedColumn)}
                texts={columnValues(
                  columns.find(item => item.name === codedColumn.name.replace(/_codes$/, ''))
                )}
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
              <div className="output-body variable-panel">
                <div className="flow-muted">
                  {[
                    columnMeta(activeName)?.measure || columnMeta(activeName)?.type,
                    `${counts.length} code${counts.length === 1 ? '' : 's'}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
                <h2>{columnMeta(activeName)?.name || activeName}</h2>
                {columnMeta(activeName)?.label &&
                columnMeta(activeName)?.label !== columnMeta(activeName)?.name ? (
                  <p className="flow-muted variable-question">{columnMeta(activeName)?.label}</p>
                ) : null}
                <div className="variable-head">
                  <span className="flow-muted">Click codes to filter</span>
                  <span className="flow-muted">
                    {filePage
                      ? `% of all ${filePage.n.toLocaleString('en-GB')} rows`
                      : countsSettled
                        ? '% of loaded rows'
                        : '% of all rows'}
                  </span>
                </div>
                {!countsSettled
                  ? Array.from({ length: 3 }, (_, index) => (
                      <Skeleton key={`count-${index}`} className="mb-2 h-7 w-full" />
                    ))
                  : null}
                {(countsSettled ? counts : []).map(item => (
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
                      <span>
                        {item.label}
                        {columnMeta(activeName)?.value_labels?.[item.label]
                          ? ` ${columnMeta(activeName)?.value_labels?.[item.label]}`
                          : ''}
                      </span>
                      <span>{Math.round((item.count / countTotal) * 100)}%</span>
                      <span className="value-track">
                        <i style={{ width: `${Math.round((item.count / countTotal) * 100)}%` }} />
                      </span>
                    </span>
                  </Button>
                ))}
                {countsSettled ? (
                  <div className="variable-missing" data-none={missingCount === 0 || undefined}>
                    <span>Missing</span>
                    <span>
                      {missingCount
                        ? `${Math.round((missingCount / countTotal) * 100)}% · ${missingCount} rows`
                        : 'None'}
                    </span>
                  </div>
                ) : null}
                {project ? (
                  <Link className="variable-action" href={`/flow/p/${project.id}/tables`}>
                    Use as banner column <span aria-hidden="true">+</span>
                  </Link>
                ) : null}
              </div>
            ) : null}
          </ScrollArea>
        )}
      </FlowSidePanel>
      {anovaOpen ? (
        <AnovaModal
          columns={columns}
          datasetId={datasetId}
          projectId={project?.id}
          onClose={() => setAnovaOpen(false)}
        />
      ) : null}
      {weightOpen ? (
        <WeightPanel
          datasetId={datasetId}
          datasets={projectDatasets}
          onClose={() => setWeightOpen(false)}
          onAdopted={nextId => {
            setChosenId(nextId);
            setColPicked(false);
            onChanged?.();
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

function TablesScreen({
  project,
  datasets,
  ready = false,
}: {
  project?: FlowProject;
  datasets: DatasetRow[];
  ready?: boolean;
}) {
  const [chosen, setChosen] = useState('');
  const [initialStub, setInitialStub] = useState('');
  const [initialBanner, setInitialBanner] = useState('');
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setInitialStub(params.get('stub') || '');
    setInitialBanner(params.get('banner') || '');
  }, [project?.id]);
  const files = datasets.filter(row => row.project_id === project?.id && datasetRowId(row));
  const datasetId =
    chosen || project?.active_dataset_id || (files[0] ? datasetRowId(files[0]) : undefined);
  return (
    <TablesBuilder
      key={datasetId}
      datasetId={datasetId}
      projectId={project?.id}
      initialStub={initialStub}
      initialBanner={initialBanner}
      ready={ready}
      files={files.map(row => ({
        id: datasetRowId(row),
        name: datasetFileLabel(row),
        inUse: datasetRowId(row) === project?.active_dataset_id,
      }))}
      datasets={files}
      onFile={setChosen}
      onAdopted={nextId => {
        setChosen(nextId);
        if (!project?.id) return;
        void flowJson(`/api/projects/${project.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ active_dataset_id: nextId }),
        });
      }}
    />
  );
}

function OutputPin({ pin }: { pin: ReportPin }) {
  const thin = pinIsThin(pin);
  const [lead, setLead] = useState(pin.support);
  const [bars, setBars] = useState(pin.bars || []);
  const [tables, setTables] = useState<RunTable[]>([]);
  const [phase, setPhase] = useState<'loading' | 'ready'>(thin && pin.runId ? 'loading' : 'ready');
  useEffect(() => {
    if (!thin || !pin.runId) return;
    let live = true;
    void fetchAnalysisRun(pin.runId).then(run => {
      if (!live) return;
      if (run) {
        const document = runDocument({
          op: run.op,
          title: run.report?.meta?.title,
          report: run.report,
          result: run.result,
          created_at: run.created_at,
        });
        const story = pinStory(document);
        if (story.support) setLead(story.support);
        if (story.bars.length) setBars(story.bars);
        const view = resultViewFromToolResults([{ result: run.result, report: run.report }]);
        if (view.tables.length) setTables(view.tables);
      }
      setPhase('ready');
    });
    return () => {
      live = false;
    };
  }, [thin, pin.runId]);
  if (phase === 'loading') {
    return (
      <article className="report-finding" aria-busy="true">
        <Skeleton className="h-36 w-full" />
      </article>
    );
  }
  if (tables.length) {
    return (
      <article className="report-finding">
        <AnalysisResult lead={lead || pin.headline} tables={tables} />
      </article>
    );
  }
  return (
    <article className="report-finding">
      <div className="report-finding-copy">
        <p className="flow-muted">{pin.citation}</p>
        <h3>{pin.headline}</h3>
        {lead ? <p>{lead}</p> : null}
        {bars.length ? (
          <div className="report-bars">
            {bars.map(bar => (
              <div key={`${pin.id}-${bar.label}`}>
                <div className="report-bar-label">
                  <span>{bar.label}</span>
                  <span>{bar.percent.toFixed(1)}%</span>
                </div>
                <div className="report-bar-track">
                  <div
                    className="report-bar"
                    style={{ width: `${Math.max(0, Math.min(100, bar.percent))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function versionLabel(files: DatasetRow[], id: string, fallback: string): string {
  const file = files.find(row => datasetRowId(row) === id);
  return file ? sourceVersionTitle(file) : fallback.trim();
}

function ReportScreen({
  projectId,
  project,
  datasets,
  ready = false,
}: {
  projectId: string;
  project?: FlowProject;
  datasets: DatasetRow[];
  ready?: boolean;
}) {
  const datasetId =
    project?.active_dataset_id || datasets.find(row => row.project_id === projectId)?.dataset_id;
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [specs, setSpecs] = useState<
    {
      id: string;
      label: string;
      spec: Record<string, unknown>;
      datasetId?: string;
      number?: number;
    }[]
  >([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [tables, setTables] = useState<ReportTable[]>([]);
  const [staleTables, setStaleTables] = useState<StaleTable[]>([]);
  const [rebuildOffers, setRebuildOffers] = useState<
    Record<string, { id: string; filename: string }>
  >({});
  const [findings, setFindings] = useState<ReportFinding[]>([]);
  const [findingsPhase, setFindingsPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [findingsError, setFindingsError] = useState('');
  const [segmentId, setSegmentId] = useState<string | null>(null);
  const [rowCut, setRowCut] = useState<RowCut[] | null>(null);
  const [filterDraft, setFilterDraft] = useState<RowCut[]>([]);
  const [template, setTemplate] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');
  const [pane, setPane] = useState<'report' | 'outputs'>('report');
  const [openRunId, setOpenRunId] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [staleErrors, setStaleErrors] = useState<Record<string, string>>({});
  const lastRun = useAnalysisSetupStore(s => s.lastRun);
  const seenRun = useRef(lastRun?.nonce || 0);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('pane') === 'outputs') setPane('outputs');
    if (params.get('run')) setOpenRunId(params.get('run') || '');
  }, []);
  useEffect(() => {
    if (!lastRun || lastRun.nonce === seenRun.current) return;
    seenRun.current = lastRun.nonce;
    setPane('outputs');
    setOpenRunId(lastRun.runId);
  }, [lastRun]);
  const reportPins = useProjectPins(projectId, []);
  const stampTries = useRef(0);

  const templateInput = useRef<HTMLInputElement>(null);

  const reportFileKey = datasets
    .filter(row => row.project_id === projectId)
    .map(row => datasetRowId(row))
    .filter(Boolean)
    .join(',');
  const reportLoadKey = reportFileKey || (ready ? 'ready' : '');

  const writeFindings = useCallback(
    (nextTables: ReportTable[], nextSegment: string | null, nextCut: RowCut[] | null) => {
      setFindingsError('');
      setFindings(nextTables.map(table => findingFromTable(table, nextSegment, nextCut)));
      setFindingsPhase('ready');
    },
    []
  );

  useEffect(() => {
    if (!datasetId) {
      if (!ready) return;
      setSpecs([]);
      setPicked([]);
      setTables([]);
      setStaleTables([]);
      setFindings([]);
      setPhase('ready');
      setFindingsPhase('ready');
      return;
    }
    let live = true;
    setPhase('loading');
    setError('');
    const fileIds = reportFileKey ? reportFileKey.split(',') : [];
    // The file list arrives after the first paint. Waiting for it keeps the
    // overview on those files instead of scanning every file in the account.
    if (!reportLoadKey) return;
    const overviewUrl = `/api/projects/${projectId}/overview${
      fileIds.length ? `?dataset_ids=${encodeURIComponent(fileIds.join(','))}` : ''
    }`;
    void shareRequest(overviewUrl, async () => {
      const first = await flowJson<{
        ok?: boolean;
        stamps_pending?: boolean;
        tables?: {
          spec_id?: string;
          label?: string;
          dataset_id?: string;
          filename?: string;
          table_number?: number | null;
          stale?: boolean;
          detail?: string;
        }[];
        findings?: { id: string; title: string; number?: number | null }[];
        runs?: { id?: string; dataset_id?: string; in_report?: boolean; report_pin?: unknown }[];
      }>(overviewUrl);
      return first;
    })
      .then(async overview => {
        if (!live || !overview?.ok || !Array.isArray(overview.tables)) {
          throw new Error('Could not load saved tables');
        }
        if (overview.stamps_pending && stampTries.current < 4) {
          stampTries.current += 1;
          window.setTimeout(() => {
            if (live) setRefreshKey(key => key + 1);
          }, 400);
          return;
        }
        stampTries.current = 0;
        const runs = (overview.runs || []) as Parameters<typeof pinsFromRuns>[0];
        rememberReportRuns(projectId, runs);
        setProjectPins(projectId, pinsFromRuns(runs));
        const staleRows = overview.tables.filter(row => row.stale);
        const liveRows = overview.tables.filter(row => row.spec_id && !row.stale);
        setStaleTables(
          uniqueStale(
            staleRows.map(row => ({
              id: String(row.spec_id || ''),
              label: String(row.label || ''),
              number: Number(row.table_number) || 0,
              datasetId: String(row.dataset_id || ''),
              filename: String(row.filename || ''),
              detail: String(row.detail || ''),
            }))
          )
        );
        setFindings((overview.findings || []).map(findingFromOverview));
        setFindingsPhase('ready');
        const meta = await flowJson<{
          columns?: {
            name?: string;
            label?: string;
            value_labels?: Record<string, string> | null;
          }[];
        }>(`/datasets/${datasetId}/metadata`).catch(() => ({ columns: [] }));
        if (!live) return;
        const questions = (meta.columns || []).map(column => ({
          name: column.name || '',
          label: column.label || '',
        }));
        const labels = Object.fromEntries(
          (meta.columns || []).map(column => [column.name || '', column.value_labels || null])
        );
        const opened = liveRows.length
          ? await flowJson<{
              tables?: {
                ok?: boolean;
                spec_id?: string;
                book?: Record<string, unknown>;
                stale?: boolean;
              }[];
            }>(`/datasets/projects/${projectId}/tables/open`, {
              method: 'POST',
              body: JSON.stringify({
                tables: liveRows.map(row => ({
                  spec_id: row.spec_id,
                  dataset_id: row.dataset_id,
                })),
              }),
            }).catch(() => null)
          : { tables: [] };
        if (!live) return;
        const staleFromOpen = new Set(
          (opened?.tables || [])
            .filter(item => item.stale && item.spec_id)
            .map(item => String(item.spec_id))
        );
        const byId = new Map(
          (opened?.tables || [])
            .filter(item => item.ok && item.book && item.spec_id)
            .map(item => [String(item.spec_id), item.book as Record<string, unknown>])
        );
        const rows = liveRows
          .filter(row => !staleFromOpen.has(String(row.spec_id || '')))
          .map(row => ({
            id: String(row.spec_id || ''),
            label: String(row.label || ''),
            datasetId: String(row.dataset_id || datasetId),
            filename: String(row.filename || ''),
            number: Number(row.table_number) || 0,
          }));
        const settled = await loadTablesSettled(rows, row => {
          const cached = byId.get(row.id);
          if (cached) return Promise.resolve(cached);
          return flowJson<Record<string, unknown>>(`/datasets/${row.datasetId}/tables/${row.id}`);
        });
        if (!live) return;
        const ready = settled.ready.map(({ row, detail }) => {
          const note = tableFileNote(row, datasetId);
          const named = titledWithQuestions(row.label, questions);
          const label = note ? `${named} (${note})` : named;
          const spec = (detail.spec as Record<string, unknown>) || {};
          return {
            id: row.id,
            label,
            datasetId: row.datasetId,
            number: row.number,
            spec,
            table: reportTableFromBook(row.id, label, row.number, detail, labels),
          };
        });
        setSpecs(
          ready.map(row => ({
            id: row.id,
            label: row.label,
            spec: row.spec,
            datasetId: row.datasetId,
            number: row.number,
          }))
        );
        setPicked(ready.map(row => row.id));
        const refused = liveRows
          .filter(row => staleFromOpen.has(String(row.spec_id || '')))
          .map(row => ({
            id: String(row.spec_id || ''),
            label: titledWithQuestions(String(row.label || ''), questions),
            number: Number(row.table_number) || 0,
            datasetId: String(row.dataset_id || ''),
            filename: String(row.filename || ''),
            detail: String(row.detail || 'Rebuild this table on the current file.'),
          }));
        setStaleTables(current =>
          uniqueStale([...current, ...refused, ...settled.stale]).map(table => ({
            ...table,
            label: titledWithQuestions(table.label, questions),
          }))
        );
        const nextTables = distinctTables(ready.map(row => row.table));
        setTables(nextTables);
        setSegmentId(null);
        setRowCut(null);
        writeFindings(nextTables, null, null);
        setPhase('ready');
      })
      .catch(err => {
        if (!live) return;
        setError(err instanceof Error ? err.message : 'Could not load saved tables');
        setPhase('error');
      });
    return () => {
      live = false;
    };
  }, [datasetId, writeFindings, refreshKey, projectId, reportLoadKey, reportFileKey]);

  const selected = specs.filter(
    row => picked.includes(row.id) && Object.keys(row.spec || {}).length > 0
  );
  const savedCount = savedTableTotal([specs, staleTables]);

  const rebuildStale = async (table: StaleTable, targetId?: string) => {
    setBusy(`rebuild-${table.id}`);
    setError('');
    setStaleErrors(current => ({ ...current, [table.id]: '' }));
    try {
      const result = await flowJson<{
        ok?: boolean;
        blocked?: boolean;
        detail?: string;
        clean_dataset_id?: string;
        clean_filename?: string;
        table_number?: number;
        weight_note?: string;
      }>(`/datasets/${datasetId}/tables/${table.id}/rebuild`, {
        method: 'POST',
        body: JSON.stringify(targetId ? { dataset_id: targetId } : {}),
      });
      if (result.blocked) {
        const message = result.detail || 'This file has a scale problem.';
        setStaleErrors(current => ({ ...current, [table.id]: message }));
        if (result.clean_dataset_id) {
          setRebuildOffers(current => ({
            ...current,
            [table.id]: {
              id: result.clean_dataset_id || '',
              filename: result.clean_filename || 'the latest file',
            },
          }));
        }
        return;
      }
      const number = result.table_number || table.number;
      setRefreshKey(key => key + 1);
      const weightNote = result.weight_note ? ` ${result.weight_note}` : '';
      setNote(`T${number} rebuilt.${weightNote}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not rebuild that table';
      setStaleErrors(current => ({ ...current, [table.id]: message }));
    } finally {
      setBusy('');
    }
  };

  const exportFileId =
    selected[0]?.datasetId || reportPins.find(pin => pin.datasetId)?.datasetId || datasetId;

  const deck = async () => {
    const outputs = deliverableOutputs(reportPins, 'deck');
    if (!exportFileId || (!selected.length && !outputs.length)) {
      setError(
        staleTables.length && !outputs.length
          ? 'Rebuild or deselect tables built on an older file before exporting.'
          : 'Add an output to the report, or save a table, before building a deck.'
      );
      return;
    }
    setError('');
    const created = await flowJson<{ export_id?: string; filename?: string }>(
      `/datasets/${exportFileId}/export/deck`,
      {
        method: 'POST',
        body: JSON.stringify({
          spec_ids: selected.map(row => row.id),
          outputs,
          headlines: findings
            .filter(finding => finding.headline)
            .map(finding => ({ title: finding.eyebrow, text: finding.headline })),
          ...(template ? { template_base64: template } : {}),
        }),
      }
    );
    if (!created.export_id) throw new Error('The deck export did not return a file.');
    await downloadExport(`/exports/${created.export_id}`, created.filename || 'deck.pptx');
    setNote('Deck downloaded.');
  };

  const run = (name: string, action: () => Promise<void>) => {
    setBusy(name);
    void action()
      .catch(err => setError(String(err instanceof Error ? err.message : err)))
      .finally(() => setBusy(''));
  };

  const generate = async () => {
    const outputs = deliverableOutputs(reportPins, 'deck');
    if (!exportFileId || (!selected.length && !outputs.length)) {
      setError('Add an output to the report, or save a table, before generating.');
      return;
    }
    setError('');
    setNote('');
    await deck();
    if (selected.length) await bannerBook();
    await topline();
    setNote(
      selected.length
        ? 'Deck, banner book, and topline downloaded.'
        : 'Deck and topline downloaded.'
    );
  };

  const bannerBook = async () => {
    if (!datasetId || !selected.length) {
      setError(
        staleTables.length
          ? 'Rebuild or deselect tables built on an older file before exporting.'
          : 'Save a table before building a banner book.'
      );
      return;
    }
    setError('');
    const exportDatasetId = selected[0].datasetId || datasetId;
    const saved = await flowJson<{ book?: { id?: string } }>(
      `/datasets/${exportDatasetId}/banner-books`,
      {
        method: 'POST',
        body: JSON.stringify({
          name: 'Banner book',
          specs: selected
            .map(row => ({
              ...row.spec,
              dataset_id: (row.spec.dataset_id as string | undefined) || row.datasetId || datasetId,
              table_number: row.number || row.spec.table_number,
            }))
            .filter(spec => Object.keys(spec).length),
        }),
      }
    );
    const bookId = saved.book?.id;
    if (!bookId) throw new Error('The banner book was not saved.');
    await downloadExport(
      `/datasets/${exportDatasetId}/banner-books/${bookId}/export.xlsx`,
      'banner-book.xlsx',
      {
        method: 'POST',
        body: JSON.stringify({ target_dataset_id: exportDatasetId, mapping: {} }),
      }
    );
    setNote('Banner book downloaded.');
  };

  const topline = async () => {
    const live = specs.filter(row => row.id);
    const outputs = deliverableOutputs(reportPins, 'topline');
    if (!exportFileId || (!live.length && !outputs.length)) {
      setError('Add an output to the report, or save a table, before building a topline.');
      return;
    }
    setError('');
    await downloadExport(`/datasets/${exportFileId}/export/topline`, 'topline.docx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spec_ids: live.map(row => row.id), outputs }),
    });
    setNote('Topline downloaded.');
  };

  if (pane === 'outputs') {
    return (
      <section className="report-page outputs-page">
        <ReportOutputs
          lead={<ReportPaneSwitch pane={pane} onChange={setPane} />}
          projectId={projectId}
          openRunId={openRunId}
          refreshKey={lastRun?.nonce || 0}
          ready={ready}
          findings={findings.map(finding => ({ id: finding.id, label: finding.eyebrow }))}
          files={datasets
            .filter(row => row.project_id === projectId)
            .map(row => ({
              id: datasetRowId(row),
              name: datasetFileLabel(row),
            }))
            .filter(file => file.id)}
        />
      </section>
    );
  }

  if (phase === 'loading') {
    return (
      <section className="report-page" aria-busy="true" aria-label="Report">
        <div className="report-loading">
          <Skeleton className="h-6 w-72" />
          <Skeleton className="h-10 w-96" />
          <div className="report-loading-cards">
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </div>
          <Skeleton className="h-24" />
        </div>
      </section>
    );
  }

  if (phase === 'error') {
    return (
      <section className="report-page">
        <p className="flow-error">{error || 'Could not load this report.'}</p>
      </section>
    );
  }

  return (
    <section className="report-page">
      <div className="report-toolbar">
        <ReportPaneSwitch pane={pane} onChange={setPane} />
        <div className="report-toolbar-actions">
          {tables.some(table => valueRows(table).length) ? (
            <Popover
              onOpenChange={open => {
                if (!open) return;
                setFilterDraft(
                  rowCut ||
                    tables.flatMap(table =>
                      valueRows(table).map(item => ({ tableId: table.id, number: item.number }))
                    )
                );
              }}
            >
              <PopoverTrigger asChild>
                <Button className="flow-btn" type="button" data-active={rowCut != null}>
                  Filter{rowCut ? ` ${rowCut.length}` : ''}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="report-filter" align="end">
                {tables.flatMap(table =>
                  valueRows(table).map(item => {
                    const checked = filterDraft.some(
                      row => row.tableId === table.id && row.number === item.number
                    );
                    const name =
                      tables.length > 1
                        ? `T${table.index} ${item.row.label}`
                        : item.row.label || `Row ${item.number}`;
                    return (
                      <label key={`${table.id}-${item.number}`}>
                        <Checkbox
                          checked={checked}
                          onCheckedChange={value => {
                            const next = { tableId: table.id, number: item.number };
                            setFilterDraft(current => {
                              const without = current.filter(
                                row => !(row.tableId === next.tableId && row.number === next.number)
                              );
                              return value === true ? [...without, next] : without;
                            });
                          }}
                        />
                        {item.number}. {name}
                      </label>
                    );
                  })
                )}
                <div className="report-filter-actions">
                  <Button
                    className="flow-btn"
                    type="button"
                    onClick={() => {
                      setRowCut(null);
                      writeFindings(tables, segmentId, null);
                    }}
                  >
                    All rows
                  </Button>
                  <Button
                    className="flow-btn"
                    type="button"
                    disabled={!filterDraft.length}
                    onClick={() => {
                      setRowCut(filterDraft);
                      writeFindings(tables, segmentId, filterDraft);
                    }}
                  >
                    Apply
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          ) : null}
          {segmentChoices(tables).length ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="flow-btn" type="button" data-active={segmentId != null}>
                  Segments
                  {segmentId
                    ? ` · ${bannerHeading(segmentChoices(tables).find(column => column.id === segmentId) || { id: segmentId })}`
                    : ''}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem
                  onSelect={() => {
                    setSegmentId(null);
                    writeFindings(tables, null, rowCut);
                  }}
                >
                  All segments
                </DropdownMenuItem>
                {segmentChoices(tables).map(column => (
                  <DropdownMenuItem
                    key={column.id}
                    onSelect={() => {
                      setSegmentId(column.id);
                      writeFindings(tables, column.id, rowCut);
                    }}
                  >
                    {bannerHeading(column)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>
      <div className="report-sheet">
        <div className="report-lead">
          <h1>{project?.name || 'Report'}</h1>
          <p className="report-meta">
            <span className="ink">
              {savedCount} saved table{savedCount === 1 ? '' : 's'}
            </span>
          </p>
        </div>
        <div className="report-block">
          <div className="report-head">
            <div>
              <h2>Deliverables</h2>
              <p className="flow-muted">Built from saved tables and outputs added to the report</p>
            </div>
            <Button
              className="flow-btn"
              type="button"
              disabled={busy !== ''}
              onClick={() => run('generate', generate)}
            >
              Generate
            </Button>
          </div>
          {error ? <p className="flow-error">{error}</p> : null}
          {note ? <p className="flow-muted">{note}</p> : null}
          <div className="report-cards">
            <Card>
              <div className="report-tags">
                <span>.PPTX</span>
              </div>
              <div>
                <h3>Client deck</h3>
                <p>
                  {templateName ? `${templateName} · ` : 'Default layout · '}
                  <Button
                    className="report-template-link"
                    type="button"
                    onClick={() => templateInput.current?.click()}
                  >
                    {templateName ? 'Change' : 'Use a template'}
                  </Button>
                </p>
              </div>
              <Button type="button" disabled={busy !== ''} onClick={() => run('deck', deck)}>
                Download
              </Button>
            </Card>
            <Card>
              <div className="report-tags">
                <span>.XLSX</span>
                <span>
                  {savedCount} table{savedCount === 1 ? '' : 's'}
                </span>
              </div>
              <div>
                <h3>Banner book</h3>
                <p>Every saved table</p>
              </div>
              <Button
                type="button"
                disabled={busy !== ''}
                onClick={() => run('banner', bannerBook)}
              >
                Download
              </Button>
            </Card>
            <Card>
              <div className="report-tags">
                <span>.DOCX</span>
              </div>
              <div>
                <h3>Topline summary</h3>
                <p>Every live table</p>
              </div>
              <Button type="button" disabled={busy !== ''} onClick={() => run('topline', topline)}>
                Download
              </Button>
            </Card>
          </div>
          <Input
            ref={templateInput}
            className="sr-only"
            type="file"
            accept=".pptx"
            aria-label="Deck template"
            tabIndex={-1}
            onChange={event => {
              const file = event.target.files?.[0];
              if (!file) {
                setTemplate('');
                setTemplateName('');
                return;
              }
              setTemplateName(file.name);
              void fileToBase64(file).then(setTemplate);
            }}
          />
        </div>
        <div className="report-findings">
          <div className="report-head">
            <h2>Key findings</h2>
          </div>
          {findingsPhase === 'loading' ? (
            <>
              <Skeleton className="h-36 w-full" />
              <Skeleton className="h-36 w-full" />
            </>
          ) : findingsPhase === 'error' ? (
            <p className="flow-error">{findingsError || 'Could not write the findings.'}</p>
          ) : findings.length === 0 && reportPins.length === 0 && !staleTables.length ? (
            <p className="report-empty">
              Add an output from Outputs, or save a table, to generate findings.
            </p>
          ) : (
            <>
              {placePins(
                findingsWithOutOfDate(
                  findings,
                  staleTables.map(table => findingFromStale(table))
                ),
                reportPins
              ).map(entry => {
                if (entry.kind === 'pin') {
                  return <OutputPin key={entry.item.id} pin={entry.item} />;
                }
                const finding = entry.item;
                const stale = staleTables.find(
                  table => table.id === finding.id || table.id === finding.tableId
                );
                const inUse = versionLabel(datasets, datasetId || '', '');
                const builtOn = stale
                  ? versionLabel(datasets, stale.datasetId, stale.filename)
                  : '';
                const headline = stale?.label || finding.headline;
                const support = stale ? outOfDateLine(builtOn, inUse) : finding.support;
                return (
                  <article key={finding.id} className="report-finding">
                    <div className="report-finding-copy">
                      {finding.eyebrow ? <p className="flow-muted">{finding.eyebrow}</p> : null}
                      <div className="report-finding-title">
                        <h3>{headline}</h3>
                        {stale ? <Badge tone="warn">Out of date</Badge> : null}
                      </div>
                      {support ? <p>{support}</p> : null}
                      {stale && staleErrors[stale.id] ? (
                        <p className="flow-error">{staleErrors[stale.id]}</p>
                      ) : null}
                      <div className="report-chips">
                        {finding.citation ? (
                          <span className="report-chip accent">{finding.citation}</span>
                        ) : null}
                        {finding.significant ? <span className="report-chip">Sig 95%</span> : null}
                        {finding.lowBase ? (
                          <span className="report-chip warn">Low base</span>
                        ) : null}
                        {stale ? (
                          <Button
                            className="report-chip accent"
                            type="button"
                            disabled={busy !== ''}
                            onClick={() => void rebuildStale(stale, rebuildOffers[stale.id]?.id)}
                          >
                            {rebuildOffers[stale.id]
                              ? `Rebuild on ${rebuildOffers[stale.id].filename}`
                              : staleErrors[stale.id]
                                ? 'Retry'
                                : 'Rebuild'}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    {finding.bars.length ? (
                      <div className="report-bars">
                        {finding.bars.map(bar => (
                          <div key={`${finding.id}-${bar.label}`}>
                            <div className="report-bar-label">
                              <span>{bar.label}</span>
                              <span>{bar.percent.toFixed(1)}%</span>
                            </div>
                            <div className="report-bar-track">
                              <div
                                className="report-bar"
                                style={{ width: `${Math.max(0, Math.min(100, bar.percent))}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
