'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { Upload, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/atoms/button';
import { DatasetFilePicker } from '@/components/molecules/dataset-file-picker';
import { ProjectsTable } from '@/components/templates/home/projects-table';
import Loading from '@/components/molecules/loading';
import { useProjects, projectKeys } from '@/hooks/api/use-projects';
import { useQueryClient } from '@tanstack/react-query';
import { Project, ProjectStatus } from '@/types/project';
import { useToast } from '@/hooks/ui/use-toast';
import { useDatasetUpload } from '@/hooks/api/use-dataset-upload';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/molecules/dialog';
import useAuth from '@/hooks/api/use-auth';
import { useOrganizationContext } from '@/contexts/organisation-context';
import { cn } from '@/utils';
import { apiClient } from '@/lib/api-client';
import { formatApiErrorMessage } from '@/lib/api-error';
import { tensrApiUrl } from '@/lib/tensr-api-url';
import { getStytchBearerForTensrApi } from '@/utils/auth';

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
> & { id: string; name: string; ownerType: 'user' | 'organization'; ownerId: string };

const HomeTemplate: React.FC = () => {
  const { toast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { activeOrganization, isPersonalAccount, userOrganizations } = useOrganizationContext();
  const [searchQ, setSearchQ] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [uploadPickerOpen, setUploadPickerOpen] = useState(false);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: projects, isLoading: projectsLoading, error: projectsError } = useProjects();

  const handleDatasetUploaded = useCallback(
    (datasetId: string, fileName: string) => {
      toast({
        title: 'File ready',
        description: `${fileName} uploaded. Opening workspace…`,
      });
      const template = templateId ? `&template=${encodeURIComponent(templateId)}` : '';
      router.push(
        `/workspace/dataset/${datasetId}?name=${encodeURIComponent(fileName)}${template}`
      );
    },
    [router, templateId, toast]
  );

  const {
    uploadFile,
    isLoading: uploadBusy,
    workbook,
    clearWorkbook,
  } = useDatasetUpload('workspace', handleDatasetUploaded);

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
  const handleStartNewAnalysis = useCallback((id: string) => {
    setTemplateId(id);
    setUploadPickerOpen(true);
  }, []);

  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);

  const handleDeleteDataset = useCallback(
    (projectId: string) => {
      const row = projectsArray.find(p => p.projectId === projectId);
      const name = row?.projectName || row?.name || 'Dataset';
      setPendingDelete({ id: projectId, name });
    },
    [projectsArray]
  );

  const confirmDeleteDataset = useCallback(async () => {
    if (!pendingDelete) return;
    const { id: projectId, name } = pendingDelete;
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
        description: formatApiErrorMessage(err),
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
      setPendingDelete(null);
    }
  }, [pendingDelete, queryClient, toast]);

  const handleExportDataset = useCallback(
    async (projectId: string) => {
      const row = projectsArray.find(p => p.projectId === projectId);
      const name = row?.projectName || row?.name || 'dataset';
      try {
        const token = getStytchBearerForTensrApi();
        if (!token) throw new Error('Sign in to export this dataset');
        const res = await fetch(tensrApiUrl(`/datasets/${projectId}/export?format=csv`), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `Export failed (${res.status})`);
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${name.replace(/\.[^.]+$/, '')}.csv`;
        anchor.click();
        URL.revokeObjectURL(url);
        toast({ title: 'Export started', description: `Downloading “${name}” as CSV.` });
      } catch (err) {
        toast({
          title: 'Could not export dataset',
          description: err instanceof Error ? err.message : 'Unknown error',
          variant: 'destructive',
        });
      }
    },
    [projectsArray, toast]
  );

  const handleShareDataset = useCallback(
    async (projectId: string) => {
      const row = projectsArray.find(p => p.projectId === projectId);
      const name = row?.projectName || row?.name || 'Dataset';
      const url = `${window.location.origin}/workspace/dataset/${projectId}?name=${encodeURIComponent(name)}`;
      let audience = 'Only you can open this dataset.';
      if (row?.ownerType === 'organization') {
        const orgName =
          [activeOrganization, ...userOrganizations].find(org => org?.id === row.ownerId)?.name ??
          'your organisation';
        audience = `Members of ${orgName} can open this dataset.`;
      }
      try {
        await navigator.clipboard.writeText(url);
        toast({ title: 'Link copied', description: audience });
      } catch {
        toast({
          title: 'Could not copy share link',
          description: url,
          variant: 'destructive',
        });
      }
    },
    [projectsArray, activeOrganization, userOrganizations, toast]
  );

  const handleRenameDataset = useCallback(
    async (projectId: string) => {
      const row = projectsArray.find(p => p.projectId === projectId);
      const current = row?.projectName || row?.name || 'Dataset';
      const next = window.prompt('Rename dataset', current);
      if (next == null) return;
      const trimmed = next.trim();
      if (!trimmed || trimmed === current) return;
      try {
        await apiClient.datasets.rename(projectId, trimmed);
        await queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
        toast({ title: 'Dataset renamed', description: `Now named “${trimmed}”.` });
      } catch (err) {
        toast({
          title: 'Could not rename dataset',
          description: err instanceof Error ? err.message : 'Unknown error',
          variant: 'destructive',
        });
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

  const hasDatasets = projectsArray.length > 0;

  const workspaceLabel =
    !isPersonalAccount && activeOrganization
      ? activeOrganization.name
      : (user?.email?.split('@')[0] ?? 'personal');

  return (
    <div className="w-full pb-8 text-left">
      <header className="mb-6 pt-6 md:pt-8">
        <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          Workspace · {workspaceLabel}
        </p>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-medium tracking-tight text-foreground md:text-3xl">
            Datasets
          </h1>
          {hasDatasets ? (
            <div className="flex flex-wrap items-center gap-2">
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
          ) : null}
        </div>
      </header>

      {!projectsLoading && !hasDatasets ? (
        <section className="mb-8">
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
                {workbook && workbook.sheets.length > 1 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {workbook.sheets.map(name => (
                      <Button
                        key={name}
                        type="button"
                        variant="outline"
                        disabled={uploadBusy}
                        className="h-auto rounded-md px-2 py-1 text-xs hover:border-primary"
                        onClick={() => {
                          if (name === workbook.selected) {
                            clearWorkbook();
                            handleDatasetUploaded(workbook.datasetId, workbook.file.name);
                            return;
                          }
                          void uploadFile(workbook.file, name);
                        }}
                      >
                        {name === workbook.selected ? `${name} (opened)` : name}
                      </Button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="relative grid grid-cols-1 gap-2 sm:grid-cols-2 2xl:grid-cols-4">
              {TEMPLATES.map(t => (
                <Button
                  key={t.id}
                  type="button"
                  variant="ghost"
                  onClick={() => handleStartNewAnalysis(t.id)}
                  aria-pressed={uploadPickerOpen && templateId === t.id}
                  className={`h-auto items-start justify-start whitespace-normal rounded-xl border bg-background p-3.5 text-left font-normal hover:border-primary hover:bg-background ${
                    uploadPickerOpen && templateId === t.id ? 'border-primary' : 'border-border'
                  }`}
                >
                  <div className="mb-3 text-primary">
                    <TemplateIcon kind={t.icon} />
                  </div>
                  <p className="text-[13px] font-medium text-foreground">{t.name}</p>
                  <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{t.desc}</p>
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {t.tag}
                  </p>
                </Button>
              ))}
            </div>

            <div className="relative mt-5 flex flex-wrap items-center gap-2">
              <DatasetFilePicker
                open={uploadPickerOpen}
                title={TEMPLATES.find(t => t.id === templateId)?.name}
                onOpenChange={open => {
                  setUploadPickerOpen(open);
                  if (!open) setTemplateId(null);
                }}
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
        </section>
      ) : null}

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
            onExport={handleExportDataset}
            onShare={handleShareDataset}
            onRename={handleRenameDataset}
            deletingId={deletingId}
            searchQuery={searchQ}
            onSearchChange={setSearchQ}
            statusFilterFn={statusFilterMatch}
            projectColor={projectColor}
            displayStatus={displayStatus}
          />
        )}
      </section>
      <Dialog
        open={pendingDelete != null}
        onOpenChange={open => {
          if (!open && !deletingId) setPendingDelete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {pendingDelete?.name}?</DialogTitle>
            <DialogDescription>
              This permanently removes the dataset and its analysis history.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPendingDelete(null)}
              disabled={Boolean(deletingId)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void confirmDeleteDataset()}
              disabled={Boolean(deletingId)}
            >
              {deletingId ? 'Deleting…' : 'Delete dataset'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HomeTemplate;
