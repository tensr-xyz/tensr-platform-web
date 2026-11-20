import { tensrApiUrl } from '@/lib/tensr-api-url';

/** Workspace / project AI switch (TEN-174). Missing means on. */
export function isAiEnabled(flag: unknown): boolean {
  if (flag === false || flag === 0 || flag === '0' || flag === 'false' || flag === 'off') {
    return false;
  }
  return true;
}

export function aiDisabledMessage(scope: 'organization' | 'project' = 'organization'): string {
  return scope === 'project'
    ? 'AI is turned off for this project.'
    : 'AI is turned off for this workspace.';
}

export async function updateOrganizationAiEnabled(
  organizationId: string,
  aiEnabled: boolean,
  token: string
): Promise<{ ai_enabled: boolean }> {
  const res = await fetch(tensrApiUrl(`/api/organizations/${organizationId}`), {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ai_enabled: aiEnabled }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Could not update AI setting (${res.status})`);
  }
  const page = (await res.json()) as { organization?: { ai_enabled?: boolean } };
  return { ai_enabled: isAiEnabled(page.organization?.ai_enabled ?? aiEnabled) };
}

export async function updateProjectAiEnabled(
  projectId: string,
  aiEnabled: boolean,
  token: string
): Promise<{ ai_enabled: boolean }> {
  const res = await fetch(tensrApiUrl(`/api/projects/${projectId}`), {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ai_enabled: aiEnabled }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Could not update project AI setting (${res.status})`);
  }
  const page = (await res.json()) as { project?: { ai_enabled?: boolean } };
  return { ai_enabled: isAiEnabled(page.project?.ai_enabled ?? aiEnabled) };
}
