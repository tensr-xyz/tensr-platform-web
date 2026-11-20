import {
  fetchSurveyConnectors,
  listQualtricsSurveys,
  pullQualtricsSurvey,
  requestSurveyConnector,
} from './survey-connectors';

describe('survey connectors client', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('lists connectors from the catalog', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        connectors: [{ id: 'qualtrics', label: 'Qualtrics', status: 'available' }],
      }),
    }) as unknown as typeof fetch;
    const rows = await fetchSurveyConnectors('tok');
    expect(rows[0]?.id).toBe('qualtrics');
  });

  it('lists Qualtrics surveys and pulls one', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          surveys: [{ id: 'SV_1', name: 'Wave 1' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ dataset_id: 'ds-1', n_rows: 2 }),
      }) as unknown as typeof fetch;
    const surveys = await listQualtricsSurveys('tok', 'acme.qualtrics.com', 'api');
    expect(surveys[0]?.name).toBe('Wave 1');
    const pulled = await pullQualtricsSurvey('tok', {
      brandHost: 'acme.qualtrics.com',
      apiToken: 'api',
      surveyId: 'SV_1',
      scope: 'personal',
    });
    expect(pulled.dataset_id).toBe('ds-1');
  });

  it('sends a request for another connector', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, message: 'Thanks' }),
    }) as unknown as typeof fetch;
    const out = await requestSurveyConnector('tok', 'SurveyMonkey', 'Need OAuth');
    expect(out.message).toBe('Thanks');
  });
});
