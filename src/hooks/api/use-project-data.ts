'use client';

import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { flowJson } from '@/lib/flow-api';
import { PROJECT_STALE_MS, projectQueryKeys } from '@/lib/project-query-cache';

export type DatasetColumnsPayload = {
  columns?: {
    name?: string;
    label?: string | null;
    value_labels?: Record<string, string> | null;
    measure?: string;
  }[];
};

export type ProjectOverviewPayload = {
  ok?: boolean;
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
};

export type ChatSessionRow = {
  session_id: string;
  title?: string;
  updated_at?: string;
};

export type ReportDocumentPayload = {
  document?: Record<string, unknown> | null;
  has_document?: boolean;
};

function overviewPath(projectId: string, fileKey: string): string {
  return `/api/projects/${projectId}/overview${
    fileKey ? `?dataset_ids=${encodeURIComponent(fileKey)}` : ''
  }`;
}

export function useDatasetColumns(datasetId: string | undefined | null) {
  return useQuery({
    queryKey: projectQueryKeys.columns(datasetId || ''),
    queryFn: () => flowJson<DatasetColumnsPayload>(`/datasets/${datasetId}/metadata`),
    enabled: Boolean(datasetId),
    staleTime: PROJECT_STALE_MS.columns,
    refetchOnMount: false,
  });
}

/** 5xx: one retry. 4xx: never. Other network blips: up to three. */
export function shouldRetryProjectQuery(failureCount: number, error: unknown): boolean {
  const status =
    error && typeof error === 'object' && 'status' in error
      ? Number((error as { status?: unknown }).status)
      : NaN;
  if (status >= 400 && status < 500) return false;
  if (status >= 500) return failureCount < 1;
  return failureCount < 3;
}

export function useProjectOverview(
  projectId: string | undefined | null,
  fileKey: string,
  enabled = true
) {
  return useQuery({
    queryKey: projectQueryKeys.overview(projectId || '', fileKey),
    queryFn: () => flowJson<ProjectOverviewPayload>(overviewPath(projectId || '', fileKey)),
    enabled: Boolean(projectId) && enabled,
    staleTime: PROJECT_STALE_MS.tables,
    refetchOnMount: true,
    retry: shouldRetryProjectQuery,
  });
}

export function useProjectSessions(projectId: string | undefined | null) {
  return useQuery({
    queryKey: projectQueryKeys.sessions(projectId || ''),
    queryFn: async () => {
      const page = await flowJson<{ sessions?: ChatSessionRow[] }>(
        `/api/projects/${projectId}/sessions`,
        { signal: AbortSignal.timeout(15000) }
      );
      return page.sessions || [];
    },
    enabled: Boolean(projectId),
    staleTime: PROJECT_STALE_MS.sessions,
    refetchOnMount: true,
  });
}

export function useReportDocument(datasetId: string | undefined | null) {
  return useQuery({
    queryKey: projectQueryKeys.reportDocument(datasetId || ''),
    queryFn: () =>
      flowJson<ReportDocumentPayload>(`/datasets/${datasetId}/report/document`, {
        // Bound cold loads so Slides never sits on "Loading pages…" forever.
        signal: AbortSignal.timeout(15000),
      }),
    enabled: Boolean(datasetId),
    staleTime: PROJECT_STALE_MS.report,
    refetchOnMount: true,
  });
}

export function usePageTableBook(
  datasetId: string | undefined | null,
  pageId: string,
  specId: string
) {
  return useQuery({
    queryKey: projectQueryKeys.pageTable(datasetId || '', pageId, specId),
    queryFn: () => flowJson<Record<string, unknown>>(`/datasets/${datasetId}/tables/${specId}`),
    enabled: Boolean(datasetId && pageId && specId),
    staleTime: PROJECT_STALE_MS.page,
    refetchOnMount: true,
  });
}

/** Prefetch the heavy reads a tab needs so a hover/switch paints from cache. */
export async function prefetchProjectTab(
  client: QueryClient,
  tab: string,
  args: { projectId: string; datasetId?: string; fileKey?: string }
): Promise<void> {
  const { projectId, datasetId, fileKey = '' } = args;
  if (!projectId) return;
  const jobs: Promise<unknown>[] = [];
  if (tab === 'chat' || tab === 'details' || tab === 'responses' || tab === 'tables') {
    if (datasetId) {
      jobs.push(
        client.prefetchQuery({
          queryKey: projectQueryKeys.columns(datasetId),
          queryFn: () => flowJson<DatasetColumnsPayload>(`/datasets/${datasetId}/metadata`),
          staleTime: PROJECT_STALE_MS.columns,
        })
      );
    }
  }
  if (tab === 'details') {
    jobs.push(
      client.prefetchQuery({
        queryKey: projectQueryKeys.contextDocs(projectId),
        queryFn: () => fetchProjectContextDocs(projectId),
        staleTime: PROJECT_STALE_MS.details,
      }),
      client.prefetchQuery({
        queryKey: projectQueryKeys.members(projectId),
        queryFn: () => fetchProjectMembers(projectId),
        staleTime: PROJECT_STALE_MS.details,
      }),
      client.prefetchQuery({
        queryKey: projectQueryKeys.askerLog(projectId),
        queryFn: () => fetchProjectAskerLog(projectId),
        staleTime: PROJECT_STALE_MS.details,
      }),
      client.prefetchQuery({
        queryKey: projectQueryKeys.me(),
        queryFn: fetchMe,
        staleTime: PROJECT_STALE_MS.session,
      }),
      (async () => {
        await client.prefetchQuery({
          queryKey: projectQueryKeys.detail(projectId),
          queryFn: () => fetchProjectDetail(projectId),
          staleTime: PROJECT_STALE_MS.details,
        });
        const page = client.getQueryData<ProjectDetailPayload>(projectQueryKeys.detail(projectId));
        if (page) {
          client.setQueryData(projectQueryKeys.datasets(projectId), page.datasets || []);
        }
      })()
    );
    if (datasetId) {
      jobs.push(
        client.prefetchQuery({
          queryKey: projectQueryKeys.preview(datasetId),
          queryFn: () => fetchDatasetPreview(datasetId),
          staleTime: PROJECT_STALE_MS.columns,
        }),
        client.prefetchQuery({
          queryKey: projectQueryKeys.audiences(datasetId),
          queryFn: () => fetchDatasetAudiences(datasetId),
          staleTime: PROJECT_STALE_MS.details,
        })
      );
    }
  }
  if (tab === 'chat') {
    jobs.push(
      client.prefetchQuery({
        queryKey: projectQueryKeys.sessions(projectId),
        queryFn: async () => {
          const page = await flowJson<{ sessions?: ChatSessionRow[] }>(
            `/api/projects/${projectId}/sessions`,
            { signal: AbortSignal.timeout(15000) }
          );
          return page.sessions || [];
        },
        staleTime: PROJECT_STALE_MS.sessions,
      })
    );
  }
  if (tab === 'report' || tab === 'tables') {
    jobs.push(
      client.prefetchQuery({
        queryKey: projectQueryKeys.overview(projectId, fileKey),
        queryFn: () => flowJson<ProjectOverviewPayload>(overviewPath(projectId, fileKey)),
        staleTime: PROJECT_STALE_MS.tables,
        retry: shouldRetryProjectQuery,
      })
    );
    if (datasetId) {
      jobs.push(
        client.prefetchQuery({
          queryKey: projectQueryKeys.reportDocument(datasetId),
          queryFn: () =>
            flowJson<ReportDocumentPayload>(`/datasets/${datasetId}/report/document`, {
              signal: AbortSignal.timeout(15000),
            }),
          staleTime: PROJECT_STALE_MS.report,
        })
      );
    }
  }
  await Promise.all(jobs);
}

export function usePrefetchProjectTab() {
  const client = useQueryClient();
  return (tab: string, args: { projectId: string; datasetId?: string; fileKey?: string }) => {
    void prefetchProjectTab(client, tab, args);
  };
}

export type ProjectContextDoc = {
  id?: string;
  name?: string;
  kind?: string;
  text?: string;
  excerpt?: string;
  updated_at?: string;
};

export type ProjectMemberRow = { user_id: string; role?: string };

export type AskerLogTurn = {
  id?: string;
  turn_id?: string;
  question?: string;
  answer?: string;
  created_at?: string;
  user_id?: string;
  checked?: boolean;
  status?: string;
  owner_note?: string;
};

export type MePayload = {
  email?: string;
  user?: { id?: string; email?: string; name?: string };
  user_id?: string;
  active_organization?: { id?: string; name?: string };
};

export type DatasetPreviewPayload = {
  rows?: unknown[][];
  headers?: string[];
};

export type DatasetAudiencesPayload = {
  audiences?: {
    name?: string;
    label?: string;
    description?: string;
    filter?: { combine?: string; filters?: unknown[] };
    n?: number;
    n_total?: number;
    share?: number;
    weighted_share?: number | null;
    projected_people?: number | null;
    used_in?: number;
  }[];
  unmatched?: string[];
};

export type ProjectDetailPayload = {
  project?: {
    id?: string;
    name?: string;
    ai_enabled?: boolean;
    ai_settings?: unknown;
    [key: string]: unknown;
  };
  datasets?: unknown[];
};

/** Shared fetchers so every caller hits the same TanStack Query key. */
export function fetchMe(): Promise<MePayload> {
  return flowJson<MePayload>('/me');
}

export async function fetchProjectMembers(projectId: string): Promise<ProjectMemberRow[]> {
  const page = await flowJson<{ members?: ProjectMemberRow[] }>(
    `/api/projects/${projectId}/members`
  );
  return page.members || [];
}

export async function fetchProjectAskerLog(projectId: string): Promise<AskerLogTurn[]> {
  const page = await flowJson<{ turns?: AskerLogTurn[] }>(`/api/projects/${projectId}/asker-log`);
  return page.turns || [];
}

export async function fetchProjectContextDocs(projectId: string): Promise<ProjectContextDoc[]> {
  const page = await flowJson<{ docs?: ProjectContextDoc[] }>(
    `/api/projects/${projectId}/context-docs`
  );
  return page.docs || [];
}

export function fetchDatasetAudiences(datasetId: string): Promise<DatasetAudiencesPayload> {
  return flowJson<DatasetAudiencesPayload>(`/datasets/${datasetId}/audiences`);
}

export function fetchDatasetPreview(datasetId: string): Promise<DatasetPreviewPayload> {
  return flowJson<DatasetPreviewPayload>(
    `/datasets/${datasetId}/preview?limit=60&offset=0&slim=true`
  );
}

export function fetchProjectDetail(projectId: string): Promise<ProjectDetailPayload> {
  return flowJson<ProjectDetailPayload>(`/api/projects/${projectId}`);
}

/** Ensure one in-flight / cached read for session profile. */
export function ensureMe(client: QueryClient): Promise<MePayload> {
  return client.ensureQueryData({
    queryKey: projectQueryKeys.me(),
    queryFn: fetchMe,
    staleTime: PROJECT_STALE_MS.session,
  });
}

/** One /api/projects/:id fetch shared by shell, Details, and tab prefetch. */
export function ensureProjectDetail(
  client: QueryClient,
  projectId: string
): Promise<ProjectDetailPayload> {
  return client.ensureQueryData({
    queryKey: projectQueryKeys.detail(projectId),
    queryFn: () => fetchProjectDetail(projectId),
    staleTime: PROJECT_STALE_MS.details,
  });
}

export function ensureProjectMembers(
  client: QueryClient,
  projectId: string
): Promise<ProjectMemberRow[]> {
  return client.ensureQueryData({
    queryKey: projectQueryKeys.members(projectId),
    queryFn: () => fetchProjectMembers(projectId),
    staleTime: PROJECT_STALE_MS.details,
  });
}

export function ensureProjectAskerLog(
  client: QueryClient,
  projectId: string
): Promise<AskerLogTurn[]> {
  return client.ensureQueryData({
    queryKey: projectQueryKeys.askerLog(projectId),
    queryFn: () => fetchProjectAskerLog(projectId),
    staleTime: PROJECT_STALE_MS.details,
  });
}

export function useProjectDetail(projectId: string | undefined | null) {
  return useQuery({
    queryKey: projectQueryKeys.detail(projectId || ''),
    queryFn: () => fetchProjectDetail(projectId || ''),
    enabled: Boolean(projectId),
    staleTime: PROJECT_STALE_MS.details,
    refetchOnMount: false,
  });
}

/** Project-scoped dataset list (seeded from /api/projects/:id). */
export function useProjectDatasets(projectId: string | undefined | null) {
  const client = useQueryClient();
  return useQuery({
    queryKey: projectQueryKeys.datasets(projectId || ''),
    queryFn: async () => {
      const page = await ensureProjectDetail(client, projectId || '');
      return page.datasets || [];
    },
    enabled: Boolean(projectId),
    staleTime: PROJECT_STALE_MS.details,
    refetchOnMount: false,
  });
}

export function useDatasetAudiences(datasetId: string | undefined | null) {
  return useQuery({
    queryKey: projectQueryKeys.audiences(datasetId || ''),
    queryFn: () => fetchDatasetAudiences(datasetId || ''),
    enabled: Boolean(datasetId),
    staleTime: PROJECT_STALE_MS.details,
    refetchOnMount: false,
  });
}

export function useProjectContextDocs(projectId: string | undefined | null) {
  return useQuery({
    queryKey: projectQueryKeys.contextDocs(projectId || ''),
    queryFn: () => fetchProjectContextDocs(projectId || ''),
    enabled: Boolean(projectId),
    staleTime: PROJECT_STALE_MS.details,
    refetchOnMount: false,
  });
}

export function useProjectMembers(projectId: string | undefined | null) {
  return useQuery({
    queryKey: projectQueryKeys.members(projectId || ''),
    queryFn: () => fetchProjectMembers(projectId || ''),
    enabled: Boolean(projectId),
    staleTime: PROJECT_STALE_MS.details,
    refetchOnMount: false,
  });
}

export function useProjectAskerLog(projectId: string | undefined | null) {
  return useQuery({
    queryKey: projectQueryKeys.askerLog(projectId || ''),
    queryFn: () => fetchProjectAskerLog(projectId || ''),
    enabled: Boolean(projectId),
    staleTime: PROJECT_STALE_MS.details,
    refetchOnMount: false,
  });
}

export function useMe(enabled = true) {
  return useQuery({
    queryKey: projectQueryKeys.me(),
    queryFn: fetchMe,
    enabled,
    staleTime: PROJECT_STALE_MS.session,
    refetchOnMount: false,
  });
}

export function useOrganizationMembers(orgId: string | undefined | null) {
  return useQuery({
    queryKey: projectQueryKeys.orgMembers(orgId || ''),
    queryFn: async () => {
      const body = await flowJson<{ members?: Record<string, unknown>[] }>(
        `/api/organizations/${orgId}/members`
      );
      return body.members || [];
    },
    enabled: Boolean(orgId),
    staleTime: PROJECT_STALE_MS.details,
    refetchOnMount: false,
  });
}

export function useOrganizationDetail(orgId: string | undefined | null) {
  return useQuery({
    queryKey: projectQueryKeys.orgDetail(orgId || ''),
    queryFn: () =>
      flowJson<{ organization?: { ai_enabled?: boolean } }>(`/api/organizations/${orgId}`),
    enabled: Boolean(orgId),
    staleTime: PROJECT_STALE_MS.details,
    refetchOnMount: false,
  });
}

export function useDatasetPreview(datasetId: string | undefined | null) {
  return useQuery({
    queryKey: projectQueryKeys.preview(datasetId || ''),
    queryFn: () => fetchDatasetPreview(datasetId || ''),
    enabled: Boolean(datasetId),
    staleTime: PROJECT_STALE_MS.columns,
    refetchOnMount: false,
  });
}
