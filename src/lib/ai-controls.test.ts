import {
  aiDisabledMessage,
  isAiEnabled,
  updateOrganizationAiEnabled,
  updateProjectAiEnabled,
} from './ai-controls';

describe('ai controls client', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('treats missing as on and falsey flags as off', () => {
    expect(isAiEnabled(undefined)).toBe(true);
    expect(isAiEnabled(true)).toBe(true);
    expect(isAiEnabled(false)).toBe(false);
    expect(isAiEnabled('off')).toBe(false);
    expect(aiDisabledMessage('organization')).toContain('workspace');
    expect(aiDisabledMessage('project')).toContain('project');
  });

  it('puts organization ai_enabled', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ organization: { id: 'org-1', ai_enabled: false } }),
    }) as unknown as typeof fetch;

    const result = await updateOrganizationAiEnabled('org-1', false, 'tok');
    expect(result.ai_enabled).toBe(false);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/organizations/org-1'),
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ ai_enabled: false }),
      })
    );
  });

  it('patches project ai_enabled', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, project: { id: 'proj-1', ai_enabled: false } }),
    }) as unknown as typeof fetch;

    const result = await updateProjectAiEnabled('proj-1', false, 'tok');
    expect(result.ai_enabled).toBe(false);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/projects/proj-1'),
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ ai_enabled: false }),
      })
    );
  });
});
