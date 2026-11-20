/**
 * Shared client cache keys for project tabs (Chat, Sources, Details, Responses,
 * Tables, Report) and the report presentation view. Auth/session tokens stay out.
 */
import type { QueryClient } from '@tanstack/react-query';

/** Stale-while-revalidate windows (ms). Live polling stays for running jobs only. */
export const PROJECT_STALE_MS = {
  meta: 60_000,
  columns: 60_000,
  tables: 60_000,
  sessions: 30_000,
  outputs: 30_000,
  report: 10_000,
  page: 60_000,
} as const;

export const projectQueryKeys = {
  root: ['project-data'] as const,
  detail: (projectId: string) => [...projectQueryKeys.root, 'detail', projectId] as const,
  datasets: (projectId: string) => [...projectQueryKeys.root, 'datasets', projectId] as const,
  columns: (datasetId: string) => [...projectQueryKeys.root, 'columns', datasetId] as const,
  overview: (projectId: string, fileKey: string) =>
    [...projectQueryKeys.root, 'overview', projectId, fileKey] as const,
  sessions: (projectId: string) => [...projectQueryKeys.root, 'sessions', projectId] as const,
  outputs: (projectId: string) => [...projectQueryKeys.root, 'outputs', projectId] as const,
  reportDocument: (datasetId: string) =>
    [...projectQueryKeys.root, 'reportDocument', datasetId] as const,
  /** Chart/table payload for one report page object (keyed by page + table spec). */
  pageTable: (datasetId: string, pageId: string, specId: string) =>
    [...projectQueryKeys.root, 'pageTable', datasetId, pageId, specId] as const,
  tableBook: (datasetId: string, specId: string) =>
    [...projectQueryKeys.root, 'tableBook', datasetId, specId] as const,
};

export function matchesProjectId(key: readonly unknown[], projectId: string): boolean {
  return key.includes(projectId);
}

/** Drop every cached read for one project (and its datasets when listed). */
export function invalidateProjectData(
  client: QueryClient,
  projectId: string,
  datasetIds: string[] = []
): Promise<void> {
  const datasetSet = new Set(datasetIds.filter(Boolean));
  return client.invalidateQueries({
    predicate: query => {
      const key = query.queryKey;
      if (!Array.isArray(key) || key[0] !== projectQueryKeys.root[0]) return false;
      if (matchesProjectId(key, projectId)) return true;
      if (datasetSet.size === 0) return false;
      const kind = key[1];
      if (
        kind === 'columns' ||
        kind === 'reportDocument' ||
        kind === 'tableBook' ||
        kind === 'pageTable'
      ) {
        return typeof key[2] === 'string' && datasetSet.has(key[2]);
      }
      return false;
    },
  });
}

/** After saving a page or finishing a deck job: refresh that document / page only. */
export function invalidateReportDocument(client: QueryClient, datasetId: string): Promise<void> {
  return client.invalidateQueries({ queryKey: projectQueryKeys.reportDocument(datasetId) });
}

export function invalidateReportPage(
  client: QueryClient,
  datasetId: string,
  pageId: string
): Promise<void> {
  return client.invalidateQueries({
    predicate: query => {
      const key = query.queryKey;
      return (
        Array.isArray(key) &&
        key[0] === projectQueryKeys.root[0] &&
        key[1] === 'pageTable' &&
        key[2] === datasetId &&
        key[3] === pageId
      );
    },
  });
}

export function invalidateProjectOverview(client: QueryClient, projectId: string): Promise<void> {
  return client.invalidateQueries({
    predicate: query => {
      const key = query.queryKey;
      return (
        Array.isArray(key) &&
        key[0] === projectQueryKeys.root[0] &&
        key[1] === 'overview' &&
        key[2] === projectId
      );
    },
  });
}

export function invalidateProjectSessions(client: QueryClient, projectId: string): Promise<void> {
  return client.invalidateQueries({ queryKey: projectQueryKeys.sessions(projectId) });
}

export function invalidateDatasetColumns(client: QueryClient, datasetId: string): Promise<void> {
  return client.invalidateQueries({ queryKey: projectQueryKeys.columns(datasetId) });
}
