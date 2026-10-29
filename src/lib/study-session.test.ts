import {
  bearerWhenReady,
  fetchStudyJson,
  studiesWithDatasets,
  studyRowText,
} from './study-session';

jest.mock('@/utils/auth', () => ({
  getStytchBearerForTensrApi: () => 'session-jwt',
  getTensrApiHeaders: () => ({}),
}));

jest.mock('@/lib/tensr-api-url', () => ({
  tensrApiUrl: (path: string) => `http://127.0.0.1:8000${path}`,
}));

describe('study session', () => {
  it('waits for the session token instead of sending an empty bearer', async () => {
    jest.useFakeTimers();
    let token = '';
    const pending = bearerWhenReady(() => token, 5);
    await jest.advanceTimersByTimeAsync(100);
    token = 'session-jwt';
    await jest.advanceTimersByTimeAsync(100);
    await expect(pending).resolves.toBe('session-jwt');
    jest.useRealTimers();
  });

  it('shares one in-flight studies request', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => '',
      json: async () => ({ projects: [{ id: 'p1' }] }),
    }));
    global.fetch = fetchMock as unknown as typeof fetch;
    const [first, second] = await Promise.all([
      fetchStudyJson<{ projects: { id: string }[] }>('/api/projects?limit=50'),
      fetchStudyJson<{ projects: { id: string }[] }>('/api/projects?limit=50'),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first.projects[0].id).toBe('p1');
    expect(second.projects[0].id).toBe('p1');
  });

  it('labels a study with its dataset count and updated time', () => {
    const text = studyRowText({
      name: 'Brand tracker',
      dataset_count: 2,
      updated_at: '2026-10-29T11:00:00.000Z',
    });
    expect(text.startsWith('Brand tracker · 2 datasets · ')).toBe(true);
  });

  it('drops studies that have no datasets', () => {
    const visible = studiesWithDatasets([
      { name: 'osf_data', dataset_count: 0 },
      { name: 'Brand tracker', dataset_count: 2 },
    ]);
    expect(visible.map(project => project.name)).toEqual(['Brand tracker']);
  });
});
