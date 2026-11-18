import { tensrApiUrl } from '@/lib/tensr-api-url';
import { handleUnauthorizedResponse } from '@/lib/session-expired';
import { PERSONAL_ACCOUNT_KEY } from '@/lib/active-organisation';
import { ApiRequestError, formatApiErrorMessage } from '@/lib/api-error';

export type SurveyConnector = {
  id: string;
  label: string;
  status: 'available' | 'coming_soon' | string;
  auth?: string;
  note?: string;
};

export type QualtricsSurvey = {
  id: string;
  name: string;
  is_active?: boolean;
};

export type QualtricsPullResult = {
  dataset_id: string;
  n_rows?: number;
  prep?: Record<string, unknown>;
  survey_connector?: {
    platform?: string;
    survey_id?: string;
    survey_name?: string;
    label?: string;
    last_pulled_at?: string;
  };
  [key: string]: unknown;
};

function orgHeaders(token: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  if (typeof window !== 'undefined') {
    const orgId = localStorage.getItem('activeOrganizationId');
    if (orgId && orgId !== PERSONAL_ACCOUNT_KEY) headers['X-Organization-Id'] = orgId;
  }
  return headers;
}

async function readError(response: Response): Promise<string> {
  const text = await response.text();
  return formatApiErrorMessage(new ApiRequestError(response.status, text));
}

export async function fetchSurveyConnectors(token: string): Promise<SurveyConnector[]> {
  const response = await fetch(tensrApiUrl('/datasets/connectors'), {
    headers: orgHeaders(token),
  });
  if (handleUnauthorizedResponse(response)) throw new Error('Sign in again.');
  if (!response.ok) throw new Error(await readError(response));
  const body = (await response.json()) as { connectors?: SurveyConnector[] };
  return body.connectors || [];
}

export async function requestSurveyConnector(
  token: string,
  platform: string,
  note = ''
): Promise<{ message?: string }> {
  const response = await fetch(tensrApiUrl('/datasets/connectors/request'), {
    method: 'POST',
    headers: orgHeaders(token),
    body: JSON.stringify({ platform, note }),
  });
  if (handleUnauthorizedResponse(response)) throw new Error('Sign in again.');
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as { message?: string };
}

export async function listQualtricsSurveys(
  token: string,
  brandHost: string,
  apiToken: string
): Promise<QualtricsSurvey[]> {
  const response = await fetch(tensrApiUrl('/datasets/qualtrics/surveys'), {
    method: 'POST',
    headers: orgHeaders(token),
    body: JSON.stringify({ brand_host: brandHost, api_token: apiToken, scope: 'team' }),
  });
  if (handleUnauthorizedResponse(response)) throw new Error('Sign in again.');
  if (!response.ok) throw new Error(await readError(response));
  const body = (await response.json()) as { surveys?: QualtricsSurvey[] };
  return body.surveys || [];
}

export async function pullQualtricsSurvey(
  token: string,
  input: {
    brandHost: string;
    apiToken: string;
    surveyId: string;
    surveyName?: string;
    scope?: 'personal' | 'team';
  }
): Promise<QualtricsPullResult> {
  const response = await fetch(tensrApiUrl('/datasets/qualtrics/pull'), {
    method: 'POST',
    headers: orgHeaders(token),
    body: JSON.stringify({
      brand_host: input.brandHost,
      api_token: input.apiToken,
      survey_id: input.surveyId,
      survey_name: input.surveyName || undefined,
      scope: input.scope || 'team',
    }),
  });
  if (handleUnauthorizedResponse(response)) throw new Error('Sign in again.');
  if (!response.ok) throw new Error(await readError(response));
  const body = (await response.json()) as QualtricsPullResult;
  if (!body.dataset_id) throw new Error('Qualtrics did not return a dataset.');
  return body;
}

export async function refreshQualtricsDataset(
  token: string,
  datasetId: string,
  input: { brandHost?: string; apiToken: string; surveyId?: string; surveyName?: string }
): Promise<QualtricsPullResult> {
  const response = await fetch(tensrApiUrl(`/datasets/${datasetId}/qualtrics/refresh`), {
    method: 'POST',
    headers: orgHeaders(token),
    body: JSON.stringify({
      brand_host: input.brandHost || '',
      api_token: input.apiToken,
      survey_id: input.surveyId || undefined,
      survey_name: input.surveyName || undefined,
    }),
  });
  if (handleUnauthorizedResponse(response)) throw new Error('Sign in again.');
  if (!response.ok) throw new Error(await readError(response));
  const body = (await response.json()) as QualtricsPullResult;
  if (!body.dataset_id) throw new Error('Qualtrics did not return a refreshed dataset.');
  return body;
}
