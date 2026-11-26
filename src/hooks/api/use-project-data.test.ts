import { QueryClient } from '@tanstack/react-query';
import { PROJECT_STALE_MS, projectQueryKeys } from '@/lib/project-query-cache';
import {
  ensureMe,
  ensureProjectAskerLog,
  ensureProjectDetail,
  ensureProjectMembers,
  shouldRetryProjectQuery,
} from './use-project-data';
import { flowJson } from '@/lib/flow-api';

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
  });

  it('fetches /me once when two callers ensure the same session key', async () => {
    mockFlowJson.mockResolvedValue({ user_id: 'u1', user: { id: 'u1', email: 'a@b.co' } });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const [first, second] = await Promise.all([ensureMe(client), ensureMe(client)]);
    expect(first.user_id).toBe('u1');
    expect(second.user_id).toBe('u1');
    expect(mockFlowJson).toHaveBeenCalledTimes(1);
    expect(mockFlowJson).toHaveBeenCalledWith('/me');
    expect(client.getQueryData(projectQueryKeys.me())).toEqual(first);
    expect(PROJECT_STALE_MS.session).toBe(Number.POSITIVE_INFINITY);
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
