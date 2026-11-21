import {
  commentaryToneLabel,
  normalizeProjectAiSettings,
  projectAiSettingRows,
  updateProjectAiSettings,
} from './project-ai-settings';

jest.mock('@/lib/flow-api', () => ({
  flowJson: jest.fn(),
}));

import { flowJson } from '@/lib/flow-api';

const mockedFlowJson = flowJson as jest.MockedFunction<typeof flowJson>;

describe('project AI settings (Paper 10g)', () => {
  beforeEach(() => {
    mockedFlowJson.mockReset();
  });

  it('defaults missing keys and keeps auto_edit_data off', () => {
    const settings = normalizeProjectAiSettings({});
    expect(settings.write_commentary).toBe(true);
    expect(settings.auto_edit_data).toBe(false);
    expect(settings.commentary_tone).toBe('plain_short');
  });

  it('lists the Paper preference rows with On / Off · asks first labels', () => {
    const rows = projectAiSettingRows(
      normalizeProjectAiSettings({ write_commentary: true, auto_edit_data: false })
    );
    expect(rows[0]?.label).toBe('Write commentary on tables and slides');
    expect(rows[0]?.onLabel).toBe('On');
    expect(rows.find(row => row.key === 'auto_edit_data')?.offLabel).toBe('Off · asks first');
    expect(commentaryToneLabel('plain_short')).toBe('Plain · short');
  });

  it('patches project ai_settings through the projects API', async () => {
    mockedFlowJson.mockResolvedValue({
      ok: true,
      project: {
        id: 'proj-1',
        ai_enabled: true,
        ai_settings: { write_commentary: false, auto_edit_data: false },
      },
    });
    const result = await updateProjectAiSettings('proj-1', { write_commentary: false });
    expect(result.ai_settings.write_commentary).toBe(false);
    expect(mockedFlowJson).toHaveBeenCalledWith(
      '/api/projects/proj-1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ ai_settings: { write_commentary: false } }),
      })
    );
  });
});
