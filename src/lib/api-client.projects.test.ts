import { apiClient } from '@/lib/api-client';

jest.mock('@/utils/auth', () => ({
  getStytchBearerForTensrApi: () => 'token',
  getTensrApiHeaders: (h: Record<string, string>) => ({ ...h, Authorization: 'Bearer token' }),
}));
jest.mock('@/lib/tensr-api-url', () => ({ tensrApiUrl: (p: string) => `http://api${p}` }));

describe('apiClient.projects.list', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('keeps who owns each dataset', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => [
        { dataset_id: 'ds-p', owner_type: 'user', owner_id: 'user-1', original_filename: 'a.csv' },
        {
          dataset_id: 'ds-o',
          owner_type: 'organization',
          owner_id: 'org-1',
          original_filename: 'b.csv',
        },
      ],
    })) as unknown as typeof fetch;

    const rows = await apiClient.projects.list();

    expect(rows.map(r => [r.projectId, r.ownerType, r.ownerId])).toEqual([
      ['ds-p', 'user', 'user-1'],
      ['ds-o', 'organization', 'org-1'],
    ]);
  });
});
