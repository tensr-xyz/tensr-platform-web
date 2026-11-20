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
    refetchOnMount: true,
  });
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
    queryFn: () => flowJson<ReportDocumentPayload>(`/datasets/${datasetId}/report/document`),
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
      })
    );
    if (datasetId) {
      jobs.push(
        client.prefetchQuery({
          queryKey: projectQueryKeys.reportDocument(datasetId),
          queryFn: () => flowJson<ReportDocumentPayload>(`/datasets/${datasetId}/report/document`),
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
