import { QueryClient } from '@tanstack/react-query';
import { PROJECT_STALE_MS, projectQueryKeys } from '@/lib/project-query-cache';
import { clearSessionMe } from '@/lib/session-me-cache';
import {
  ensureMe,
  ensureProjectAskerLog,
  ensureProjectDetail,
  ensureProjectMembers,
  ensureWorkspaceDatasets,
  fetchMe,
  shouldRetryProjectQuery,
} from './use-project-data';
import { flowJson } from '@/lib/flow-api';
import { fetchMeProfile } from '@/lib/business-api';

jest.mock('@/lib/flow-api', () => ({
  flowJson: jest.fn(),
}));

const mockFlowJson = flowJson as jest.MockedFunction<typeof flowJson>;

describe('shouldRetryProjectQuery', () => {
  it('retries a 5xx once, then stops', () => {
    const err = Object.assign(new Error('Tensr could not load this right now.'), { status: 500 });
    expect(shouldRetryProjectQuery(0, err)).toBe(true);
    expect(shouldRetryProjectQuery(1, err)).toBe(false);
  });

  it('never retries a 4xx', () => {
    const err = Object.assign(new Error('Project not found'), { status: 404 });
    expect(shouldRetryProjectQuery(0, err)).toBe(false);
  });
});

describe('shared Details cache ensure helpers', () => {
  beforeEach(() => {
    mockFlowJson.mockReset();
    clearSessionMe();
  });

  it('fetches /api/me once when two callers ensure the same session key', async () => {
    mockFlowJson.mockResolvedValue({ user_id: 'u1', user: { id: 'u1', email: 'a@b.co' } });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const [first, second] = await Promise.all([ensureMe(client), ensureMe(client)]);
    expect(first.user_id).toBe('u1');
    expect(second.user_id).toBe('u1');
    expect(mockFlowJson).toHaveBeenCalledTimes(1);
    expect(mockFlowJson).toHaveBeenCalledWith('/api/me');
    expect(client.getQueryData(projectQueryKeys.me())).toEqual(first);
    expect(PROJECT_STALE_MS.session).toBe(Number.POSITIVE_INFINITY);
  });

  it('shares one /api/me between auth profile and flow fetchMe', async () => {
    const profile = {
      user: { userId: 'u1', email: 'a@b.co', firstName: 'A', lastName: 'B' },
      entitlements: { plan_code: 'pro' },
      subscription: null,
      user_id: 'u1',
    };
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => profile,
      text: async () => '',
      status: 200,
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const fromAuth = await fetchMeProfile();
    const fromFlow = await fetchMe();
    expect(fromAuth.user.userId).toBe('u1');
    expect(fromFlow.user_id).toBe('u1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0] || '')).toContain('/api/me');
  });

  it('caches workspace tips list across ensure callers', async () => {
    mockFlowJson.mockResolvedValue([
      { dataset_id: 'd1', project_id: 'p1' },
      { dataset_id: 'd2', project_id: 'p2' },
    ]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const [first, second] = await Promise.all([
      ensureWorkspaceDatasets(client),
      ensureWorkspaceDatasets(client),
    ]);
    expect(first).toHaveLength(2);
    expect(second).toBe(first);
    expect(mockFlowJson).toHaveBeenCalledTimes(1);
    expect(mockFlowJson).toHaveBeenCalledWith('/datasets?scope=all');
    expect(client.getQueryData(projectQueryKeys.workspaceDatasets())).toEqual(first);
  });

  it('unwraps { datasets } workspace payloads and keeps preview cache keys stable', async () => {
    mockFlowJson.mockResolvedValue({ datasets: [{ dataset_id: 'wave-a' }] });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const rows = await ensureWorkspaceDatasets(client);
    expect(rows).toEqual([{ dataset_id: 'wave-a' }]);
    client.setQueryData(projectQueryKeys.preview('wave-a'), {
      headers: ['Age'],
      rows: [[34]],
    });
    expect(client.getQueryData(projectQueryKeys.preview('wave-a'))).toEqual({
      headers: ['Age'],
      rows: [[34]],
    });
  });

  it('fetches /api/projects/:id once when two callers ensure the same detail key', async () => {
    mockFlowJson.mockResolvedValue({
      project: { id: 'p1', name: 'Study' },
      datasets: [{ dataset_id: 'd1' }],
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const [first, second] = await Promise.all([
      ensureProjectDetail(client, 'p1'),
      ensureProjectDetail(client, 'p1'),
    ]);
    expect(first.project?.id).toBe('p1');
    expect(second).toEqual(first);
    expect(mockFlowJson).toHaveBeenCalledTimes(1);
    expect(mockFlowJson).toHaveBeenCalledWith('/api/projects/p1');
    expect(client.getQueryData(projectQueryKeys.detail('p1'))).toEqual(first);
  });

  it('shares members and asker-log under project keys', async () => {
    mockFlowJson
      .mockResolvedValueOnce({ members: [{ user_id: 'u1', role: 'editor' }] })
      .mockResolvedValueOnce({ turns: [{ turn_id: 't1', question: 'Q', answer: 'A' }] });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const members = await ensureProjectMembers(client, 'p1');
    const again = await ensureProjectMembers(client, 'p1');
    const turns = await ensureProjectAskerLog(client, 'p1');
    expect(members).toEqual([{ user_id: 'u1', role: 'editor' }]);
    expect(again).toBe(members);
    expect(turns).toHaveLength(1);
    expect(mockFlowJson).toHaveBeenCalledTimes(2);
    expect(client.getQueryData(projectQueryKeys.members('p1'))).toEqual(members);
    expect(client.getQueryData(projectQueryKeys.askerLog('p1'))).toEqual(turns);
  });
});
