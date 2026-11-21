import { flowJson } from '@/lib/flow-api';
import { isAiEnabled } from '@/lib/ai-controls';

/** Soft preferences for how AI behaves on a project (Paper 10g). */
export type ProjectAiSettings = {
  write_commentary: boolean;
  suggest_next: boolean;
  auto_edit_data: boolean;
  code_open_ends: boolean;
  commentary_tone: 'plain_short' | 'plain_full' | 'formal_short';
};

export const DEFAULT_PROJECT_AI_SETTINGS: ProjectAiSettings = {
  write_commentary: true,
  suggest_next: true,
  auto_edit_data: false,
  code_open_ends: true,
  commentary_tone: 'plain_short',
};

export const COMMENTARY_TONE_OPTIONS: Array<{
  value: ProjectAiSettings['commentary_tone'];
  label: string;
}> = [
  { value: 'plain_short', label: 'Plain · short' },
  { value: 'plain_full', label: 'Plain · full' },
  { value: 'formal_short', label: 'Formal · short' },
];

function flagOrDefault(value: unknown, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return isAiEnabled(value);
}

export function normalizeProjectAiSettings(raw: unknown): ProjectAiSettings {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const tone = String(src.commentary_tone || '').trim();
  const commentary_tone: ProjectAiSettings['commentary_tone'] =
    tone === 'plain_full' || tone === 'formal_short' ? tone : 'plain_short';
  return {
    write_commentary: flagOrDefault(src.write_commentary, true),
    suggest_next: flagOrDefault(src.suggest_next, true),
    auto_edit_data: flagOrDefault(src.auto_edit_data, false),
    code_open_ends: flagOrDefault(src.code_open_ends, true),
    commentary_tone,
  };
}

/** Flag rows shown in the Paper 10g AI settings panel. */
export function projectAiSettingRows(settings: ProjectAiSettings): Array<{
  key: keyof Omit<ProjectAiSettings, 'commentary_tone'>;
  label: string;
  onLabel: string;
  offLabel: string;
  value: boolean;
}> {
  return [
    {
      key: 'write_commentary',
      label: 'Write commentary on tables and slides',
      onLabel: 'On',
      offLabel: 'Off',
      value: settings.write_commentary,
    },
    {
      key: 'suggest_next',
      label: 'Suggest next analyses',
      onLabel: 'On',
      offLabel: 'Off',
      value: settings.suggest_next,
    },
    {
      key: 'auto_edit_data',
      label: 'Let AI change data (recodes, merges) without asking',
      onLabel: 'On',
      offLabel: 'Off · asks first',
      value: settings.auto_edit_data,
    },
    {
      key: 'code_open_ends',
      label: 'Send open-ended answers to AI for coding',
      onLabel: 'On',
      offLabel: 'Off',
      value: settings.code_open_ends,
    },
  ];
}

export function commentaryToneLabel(tone: ProjectAiSettings['commentary_tone']): string {
  return COMMENTARY_TONE_OPTIONS.find(option => option.value === tone)?.label || 'Plain · short';
}

export async function updateProjectAiSettings(
  projectId: string,
  patch: Partial<ProjectAiSettings> & { ai_enabled?: boolean }
): Promise<{ ai_enabled: boolean; ai_settings: ProjectAiSettings }> {
  const body: Record<string, unknown> = {};
  if (patch.ai_enabled !== undefined) body.ai_enabled = patch.ai_enabled;
  const settingsPatch: Partial<ProjectAiSettings> = {};
  for (const key of [
    'write_commentary',
    'suggest_next',
    'auto_edit_data',
    'code_open_ends',
    'commentary_tone',
  ] as const) {
    if (patch[key] !== undefined) settingsPatch[key] = patch[key] as never;
  }
  if (Object.keys(settingsPatch).length) body.ai_settings = settingsPatch;
  const page = await flowJson<{
    project?: { ai_enabled?: boolean; ai_settings?: unknown };
  }>(`/api/projects/${projectId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return {
    ai_enabled: isAiEnabled(page.project?.ai_enabled ?? patch.ai_enabled ?? true),
    ai_settings: normalizeProjectAiSettings(page.project?.ai_settings ?? settingsPatch),
  };
}
