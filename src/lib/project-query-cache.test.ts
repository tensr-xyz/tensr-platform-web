import { QueryClient } from '@tanstack/react-query';
import {
  invalidateDatasetColumns,
  invalidateProjectData,
  invalidateProjectOverview,
  invalidateProjectSessions,
  invalidateReportDocument,
  invalidateReportPage,
  matchesProjectId,
  PROJECT_STALE_MS,
  projectQueryKeys,
} from './project-query-cache';

describe('projectQueryKeys', () => {
  it('nests every key under the shared root', () => {
    expect(projectQueryKeys.detail('p1')[0]).toBe('project-data');
    expect(projectQueryKeys.columns('d1')).toEqual(['project-data', 'columns', 'd1']);
    expect(projectQueryKeys.overview('p1', 'a,b')).toEqual([
      'project-data',
      'overview',
      'p1',
      'a,b',
    ]);
    expect(projectQueryKeys.pageTable('d1', 'page-2', 'spec-9')).toEqual([
      'project-data',
      'pageTable',
      'd1',
      'page-2',
      'spec-9',
    ]);
  });

  it('uses the stale windows from the ticket', () => {
    expect(PROJECT_STALE_MS.meta).toBe(60_000);
    expect(PROJECT_STALE_MS.columns).toBe(60_000);
    expect(PROJECT_STALE_MS.tables).toBe(60_000);
    expect(PROJECT_STALE_MS.report).toBe(10_000);
    expect(PROJECT_STALE_MS.page).toBe(60_000);
    expect(PROJECT_STALE_MS.details).toBe(60_000);
  });

  it('keys Details tab reads under the shared root', () => {
    expect(projectQueryKeys.contextDocs('p1')).toEqual(['project-data', 'contextDocs', 'p1']);
    expect(projectQueryKeys.members('p1')).toEqual(['project-data', 'members', 'p1']);
    expect(projectQueryKeys.askerLog('p1')).toEqual(['project-data', 'askerLog', 'p1']);
    expect(projectQueryKeys.me()).toEqual(['project-data', 'me']);
    expect(projectQueryKeys.preview('d1')).toEqual(['project-data', 'preview', 'd1']);
    expect(projectQueryKeys.audiences('d1')).toEqual(['project-data', 'audiences', 'd1']);
    expect(projectQueryKeys.detail('p1')).toEqual(['project-data', 'detail', 'p1']);
  });

  it('matches a project id anywhere in the key', () => {
    expect(matchesProjectId(projectQueryKeys.sessions('study'), 'study')).toBe(true);
    expect(matchesProjectId(projectQueryKeys.columns('ds'), 'study')).toBe(false);
  });
});

describe('project query invalidation', () => {
  function seed(client: QueryClient) {
    client.setQueryData(projectQueryKeys.detail('p1'), { id: 'p1' });
    client.setQueryData(projectQueryKeys.sessions('p1'), [{ session_id: 's1' }]);
    client.setQueryData(projectQueryKeys.overview('p1', 'd1'), { ok: true });
    client.setQueryData(projectQueryKeys.overview('p2', 'd9'), { ok: true });
    client.setQueryData(projectQueryKeys.columns('d1'), { columns: [] });
    client.setQueryData(projectQueryKeys.reportDocument('d1'), { document: null });
    client.setQueryData(projectQueryKeys.pageTable('d1', 'page-a', 'spec-1'), { rows: [] });
    client.setQueryData(projectQueryKeys.pageTable('d1', 'page-b', 'spec-2'), { rows: [] });
    client.setQueryData(projectQueryKeys.tableBook('d1', 'spec-1'), { ok: true });
  }

  it('invalidates one project and its listed datasets only', async () => {
    const client = new QueryClient();
    seed(client);
    await invalidateProjectData(client, 'p1', ['d1']);
    expect(client.getQueryState(projectQueryKeys.detail('p1'))?.isInvalidated).toBe(true);
    expect(client.getQueryState(projectQueryKeys.sessions('p1'))?.isInvalidated).toBe(true);
    expect(client.getQueryState(projectQueryKeys.columns('d1'))?.isInvalidated).toBe(true);
    expect(client.getQueryState(projectQueryKeys.reportDocument('d1'))?.isInvalidated).toBe(true);
    expect(client.getQueryState(projectQueryKeys.overview('p2', 'd9'))?.isInvalidated).toBeFalsy();
  });

  it('invalidates a report document without touching other projects', async () => {
    const client = new QueryClient();
    seed(client);
    await invalidateReportDocument(client, 'd1');
    expect(client.getQueryState(projectQueryKeys.reportDocument('d1'))?.isInvalidated).toBe(true);
    expect(client.getQueryState(projectQueryKeys.sessions('p1'))?.isInvalidated).toBeFalsy();
  });

  it('invalidates one presentation page only', async () => {
    const client = new QueryClient();
    seed(client);
    await invalidateReportPage(client, 'd1', 'page-a');
    expect(
      client.getQueryState(projectQueryKeys.pageTable('d1', 'page-a', 'spec-1'))?.isInvalidated
    ).toBe(true);
    expect(
      client.getQueryState(projectQueryKeys.pageTable('d1', 'page-b', 'spec-2'))?.isInvalidated
    ).toBeFalsy();
  });

  it('invalidates overview and sessions by project id', async () => {
    const client = new QueryClient();
    seed(client);
    await invalidateProjectOverview(client, 'p1');
    await invalidateProjectSessions(client, 'p1');
    await invalidateDatasetColumns(client, 'd1');
    expect(client.getQueryState(projectQueryKeys.overview('p1', 'd1'))?.isInvalidated).toBe(true);
    expect(client.getQueryState(projectQueryKeys.overview('p2', 'd9'))?.isInvalidated).toBeFalsy();
    expect(client.getQueryState(projectQueryKeys.sessions('p1'))?.isInvalidated).toBe(true);
    expect(client.getQueryState(projectQueryKeys.columns('d1'))?.isInvalidated).toBe(true);
  });
});
