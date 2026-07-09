'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { Upload, Plus, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/atoms/button';
import { Input } from '@/components/atoms/input';
import { DatasetFilePicker } from '@/components/molecules/dataset-file-picker';
import { ProjectsTable } from '@/components/templates/home/projects-table';
import Loading from '@/components/molecules/loading';
import { useProjects, projectKeys } from '@/hooks/api/use-projects';
import { useQueryClient } from '@tanstack/react-query';
import { Project, ProjectStatus } from '@/types/project';
import { useToast } from '@/hooks/ui/use-toast';
import { useDatasetUpload } from '@/hooks/api/use-dataset-upload';
import { Avatar, AvatarFallback } from '@/components/atoms/avatar';
import useAuth from '@/hooks/api/use-auth';
import { cn } from '@/utils';
import { apiClient } from '@/lib/api-client';

const TEMPLATES = [
  {
    id: 'ab-test',
    name: 'A/B test analysis',
    desc: 'Group comparison with t-test + effect size.',
    tag: 'T-test',
    icon: 'split' as const,
  },
  {
    id: 'survey',
    name: 'Survey results',
    desc: 'Likert summaries, cross-tabs, chi-square.',
    tag: 'χ² · Cross-tabs',
    icon: 'poll' as const,
  },
  {
    id: 'cohort',
    name: 'Cohort retention',
    desc: 'Cohort matrix with regression on decay.',
    tag: 'OLS',
    icon: 'trend' as const,
  },
  {
    id: 'blank',
    name: 'Blank workspace',
    desc: 'Start from a CSV / Excel / JSON dataset.',
    tag: 'Empty',
    icon: 'blank' as const,
  },
];

const PROJECT_COLORS = [
  'hsl(250, 100%, 63%)',
  '#16A34A',
  '#0EA5E9',
  '#6B7280',
  '#EA580C',
  '#7C3AED',
];

function TemplateIcon({ kind }: { kind: (typeof TEMPLATES)[number]['icon'] }) {
  const stroke = 'currentColor';
  const common = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke,
    strokeWidth: 1.4,
  };
  switch (kind) {
    case 'split':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="8" height="14" rx="1.5" />
          <rect x="13" y="5" width="8" height="14" rx="1.5" />
          <path d="M7 9v6M17 9v6" strokeOpacity={0.4} />
        </svg>
      );
    case 'poll':
      return (
        <svg {...common}>
          <rect x="3" y="13" width="4" height="7" rx="0.5" />
          <rect x="10" y="8" width="4" height="12" rx="0.5" />
          <rect x="17" y="4" width="4" height="16" rx="0.5" />
        </svg>
      );
    case 'trend':
      return (
        <svg {...common}>
          <path d="M3 17l5-5 4 4 8-9" />
          <path d="M14 7h6v6" />
        </svg>
      );
    case 'blank':
      return (
        <svg {...common}>
          <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
          <path d="M14 3v6h6" />
          <path d="M9 14h6" strokeOpacity={0.5} />
        </svg>
      );
  }
}

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} hr ago`;
    if (date.toDateString() === now.toDateString()) {
      return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return 'yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return 'Unknown';
  }
}

function projectColor(projectId: string): string {
  let hash = 0;
  for (let i = 0; i < projectId.length; i++) hash += projectId.charCodeAt(i);
  return PROJECT_COLORS[hash % PROJECT_COLORS.length];
}

function displayStatus(status: ProjectStatus): 'Active' | 'Completed' | 'Archived' {
  if (status === 'deleted' || status === 'error') return 'Archived';
  if (status === 'ready') return 'Active';
  return 'Active';
}

function statusFilterMatch(project: Project, filter: string): boolean {
  if (filter === 'all') return true;
  const display = displayStatus(project.status).toLowerCase();
  if (filter === 'active') return display === 'active' && project.status !== 'deleted';
  if (filter === 'completed') {
    return project.status === 'ready' && Boolean(project.processingCompletedAt);
  }
  if (filter === 'archived') return project.status === 'deleted' || project.status === 'error';
  return true;
}

/** Row shape from `apiClient.projects.list()` (dataset-backed home list). */
type HomeDatasetRow = Pick<
  Project,
  | 'projectId'
  | 'projectName'
  | 'updatedAt'
  | 'createdAt'
  | 'sourceType'
  | 'size'
  | 'status'
  | 'files'
> & { id: string; name: string };

const HomeTemplate: React.FC = () => {
  const { toast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [searchQ, setSearchQ] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [uploadPickerOpen, setUploadPickerOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: projects, isLoading: projectsLoading, error: projectsError } = useProjects();

  const handleDatasetUploaded = useCallback(
    (datasetId: string, fileName: string) => {
      toast({
        title: 'File ready',
        description: `${fileName} uploaded. Opening workspace…`,
      });
      router.push(`/workspace/dataset/${datasetId}?name=${encodeURIComponent(fileName)}`);
    },
    [router, toast]
  );

  const { uploadFile, isLoading: uploadBusy } = useDatasetUpload('personal', handleDatasetUploaded);

  const projectsArray: HomeDatasetRow[] = Array.isArray(projects)
    ? (projects as HomeDatasetRow[])
    : [];

  const filteredProjects = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    if (!q) return projectsArray;
    return projectsArray.filter(p => p.projectName.toLowerCase().includes(q));
  }, [projectsArray, searchQ]);

  const handleProjectSelect = (projectId: string): void => {
    const row = projectsArray.find(p => p.projectId === projectId);
    const name = row?.projectName || row?.name || 'Dataset';
    router.push(`/workspace/dataset/${projectId}?name=${encodeURIComponent(name)}`);
  };

  /** Templates start a fresh upload — never reopen the most recent dataset. */
  const handleStartNewAnalysis = useCallback(() => {
    setUploadPickerOpen(true);
  }, []);

  const handleDeleteDataset = useCallback(
    async (projectId: string) => {
      const row = projectsArray.find(p => p.projectId === projectId);
      const name = row?.projectName || row?.name || 'Dataset';
      if (
        !window.confirm(
          `Delete “${name}”? This permanently removes the dataset and its analysis history.`
        )
      ) {
        return;
      }
      setDeletingId(projectId);
      try {
        await apiClient.datasets.delete(projectId);
        await queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
        toast({
          title: 'Dataset deleted',
          description: `“${name}” has been removed.`,
        });
      } catch (err) {
        toast({
          title: 'Could not delete dataset',
          description: err instanceof Error ? err.message : 'Unknown error',
          variant: 'destructive',
        });
      } finally {
        setDeletingId(null);
      }
    },
    [projectsArray, queryClient, toast]
  );

  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await uploadFile(file);
  };

  const recentActivity = useMemo(() => {
    return [...projectsArray]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 4)
      .map(p => ({
        id: p.projectId,
        action: p.status === 'ready' ? 'updated project' : 'uploaded to',
        on: p.projectName,
        time: formatRelativeTime(p.updatedAt || p.createdAt),
      }));
  }, [projectsArray]);

  const workspaceLabel = user?.email?.split('@')[0] ?? 'personal';
  const userInitials = (user?.email ?? 'YO').slice(0, 2).toUpperCase();

  return (
    <div className="w-full pb-8 text-left">
      <header className="mb-6 pt-6 md:pt-8">
        <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          Workspace · {workspaceLabel}
        </p>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <h1 className="text-2xl font-medium tracking-tight text-foreground md:text-3xl">
            Datasets
          </h1>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              placeholder="Search projects, datasets, analyses…"
              className="h-9 rounded-full border-border bg-background pl-9 text-[13px] shadow-none"
            />
          </div>
        </div>
      </header>

      <section className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-[1.65fr_1fr]">
        <div
          onDragOver={e => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleFileDrop}
          className={cn(
            'relative overflow-hidden rounded-2xl border bg-card p-5 md:p-6',
            dragOver ? 'border-primary border-dashed bg-primary/5' : 'border-border'
          )}
        >
          <div
            className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-primary/5"
            aria-hidden
          />
          <div className="relative mb-5 flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Upload className="size-4" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-medium text-foreground">Start a new analysis</p>
              <p className="text-xs text-muted-foreground">
                Drop a CSV, Excel, or JSON file — or pick a template below
              </p>
            </div>
          </div>

          <div className="relative grid grid-cols-1 gap-2 sm:grid-cols-2 2xl:grid-cols-4">
            {TEMPLATES.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={handleStartNewAnalysis}
                className="rounded-xl border border-border bg-background p-3.5 text-left transition-colors hover:border-primary"
              >
                <div className="mb-3 text-primary">
                  <TemplateIcon kind={t.icon} />
                </div>
                <p className="text-[13px] font-medium text-foreground">{t.name}</p>
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{t.desc}</p>
                <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t.tag}
                </p>
              </button>
            ))}
          </div>

          <div className="relative mt-5 flex flex-wrap items-center gap-2">
            <DatasetFilePicker
              open={uploadPickerOpen}
              onOpenChange={setUploadPickerOpen}
              onUploaded={handleDatasetUploaded}
            >
              <Button className="h-9 gap-2 rounded-full px-4" disabled={uploadBusy}>
                <Upload className="size-4" aria-hidden />
                {uploadBusy ? 'Uploading…' : 'Upload dataset'}
              </Button>
            </DatasetFilePicker>
            <Button
              variant="outline"
              className="h-9 gap-2 rounded-full"
              onClick={() => router.push('/project/new')}
            >
              <Plus className="size-4" aria-hidden />
              New dataset
            </Button>
          </div>
        </div>

        <aside className="flex flex-col rounded-2xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">Recent activity</p>
            <button type="button" className="text-xs text-muted-foreground hover:text-foreground">
              View all →
            </button>
          </div>
          <div className="flex flex-1 flex-col gap-3">
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Activity appears when you create projects.
              </p>
            ) : (
              recentActivity.map(a => (
                <div key={a.id} className="flex items-start gap-3">
                  <Avatar className="size-7 shrink-0">
                    <AvatarFallback className="text-[10px] font-semibold">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug">
                      <span className="font-medium">You</span>
                      <span className="text-muted-foreground"> {a.action} </span>
                      <span className="font-medium">{a.on}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">{a.time}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          <hr className="my-4 border-border" />
          <div className="grid grid-cols-3 gap-4 text-xs text-muted-foreground">
            <div>
              <p className="text-lg font-medium tabular-nums text-foreground">
                {projectsArray.length}
              </p>
              <p>Datasets</p>
            </div>
            <div>
              <p className="text-lg font-medium tabular-nums text-foreground">
                {projectsArray.reduce((n, p) => n + (p.files?.length ?? 0), 0)}
              </p>
              <p>Files</p>
            </div>
            <div>
              <p className="text-lg font-medium tabular-nums text-foreground">
                {projectsArray.filter(p => p.status === 'ready').length}
              </p>
              <p>Ready</p>
            </div>
          </div>
        </aside>
      </section>

      <section>
        {projectsLoading ? (
          <div className="flex min-h-[50vh] w-full items-center justify-center">
            <Loading />
          </div>
        ) : projectsError ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6">
            <p className="text-sm text-destructive">
              Error loading datasets: {String(projectsError)}
            </p>
            <Button
              className="mt-4"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
                toast({
                  title: 'Refreshing datasets',
                  description: 'Attempting to reload your datasets…',
                });
              }}
            >
              Retry
            </Button>
          </div>
        ) : (
          <ProjectsTable
            data={filteredProjects as unknown as Project[]}
            onRowClick={handleProjectSelect}
            onDelete={handleDeleteDataset}
            deletingId={deletingId}
            statusFilterFn={statusFilterMatch}
            projectColor={projectColor}
            displayStatus={displayStatus}
          />
        )}
      </section>
    </div>
  );
};

export default HomeTemplate;
