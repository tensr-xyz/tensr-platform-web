'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ChoiceSelect } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/rest';
import { isAiEnabled } from '@/lib/ai-controls';
import { projectQueryKeys } from '@/lib/project-query-cache';
import { useProjectDetail, type ProjectDetailPayload } from '@/hooks/api/use-project-data';
import {
  COMMENTARY_TONE_OPTIONS,
  normalizeProjectAiSettings,
  projectAiSettingRows,
  updateProjectAiSettings,
  type ProjectAiSettings,
} from '@/lib/project-ai-settings';

/** Paper 10g · Project settings → AI. */
export function ProjectAiSettingsPanel({
  projectId,
  lockedByWorkspace,
}: {
  projectId: string;
  /** When the org has AI off, rows stay read-only. */
  lockedByWorkspace?: boolean;
}) {
  const queryClient = useQueryClient();
  const detailQuery = useProjectDetail(projectId);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [settings, setSettings] = useState<ProjectAiSettings | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (detailQuery.isError) {
      setError(
        detailQuery.error instanceof Error
          ? detailQuery.error.message
          : 'Could not load AI settings.'
      );
      setSettings(normalizeProjectAiSettings({}));
      return;
    }
    if (!detailQuery.data) return;
    setError('');
    setAiEnabled(isAiEnabled(detailQuery.data.project?.ai_enabled));
    setSettings(normalizeProjectAiSettings(detailQuery.data.project?.ai_settings));
  }, [detailQuery.data, detailQuery.isError, detailQuery.error]);

  const save = async (patch: Partial<ProjectAiSettings> & { ai_enabled?: boolean }) => {
    if (lockedByWorkspace) return;
    setBusy(Object.keys(patch).join(','));
    setError('');
    try {
      const next = await updateProjectAiSettings(projectId, patch);
      setAiEnabled(next.ai_enabled);
      setSettings(next.ai_settings);
      const prior = queryClient.getQueryData<ProjectDetailPayload>(
        projectQueryKeys.detail(projectId)
      );
      queryClient.setQueryData(projectQueryKeys.detail(projectId), {
        ...prior,
        project: {
          ...(prior?.project || {}),
          ai_enabled: next.ai_enabled,
          ai_settings: next.ai_settings,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save AI settings.');
    } finally {
      setBusy('');
    }
  };

  if (!settings) {
    return (
      <section className="project-ai" aria-busy="true">
        <div className="project-ai-eyebrow">Project settings → AI</div>
        <Skeleton className="project-ai-skeleton" />
        <Skeleton className="project-ai-skeleton short" />
      </section>
    );
  }

  const rows = projectAiSettingRows(settings);
  const disabled = Boolean(busy) || Boolean(lockedByWorkspace) || !aiEnabled;

  return (
    <section className="project-ai">
      <div className="project-ai-eyebrow">Project settings → AI</div>
      <h2 className="project-ai-title">How Tensr&apos;s AI works on this project</h2>

      <div className="project-ai-rows">
        <div className="project-ai-row">
          <span>Allow AI on this project</span>
          <Button
            type="button"
            className={aiEnabled ? 'project-ai-value on' : 'project-ai-value'}
            disabled={Boolean(busy) || Boolean(lockedByWorkspace)}
            onClick={() => void save({ ai_enabled: !aiEnabled })}
          >
            {aiEnabled ? 'On' : 'Off'}
          </Button>
        </div>
        {rows.map(row => (
          <div key={row.key} className="project-ai-row">
            <span>{row.label}</span>
            <Button
              type="button"
              className={row.value ? 'project-ai-value on' : 'project-ai-value'}
              disabled={disabled}
              onClick={() => void save({ [row.key]: !row.value })}
            >
              {row.value ? row.onLabel : row.offLabel}
            </Button>
          </div>
        ))}
        <div className="project-ai-row">
          <span>Commentary tone</span>
          <ChoiceSelect
            aria-label="Commentary tone"
            value={settings.commentary_tone}
            disabled={disabled}
            onValueChange={value =>
              void save({
                commentary_tone: value as ProjectAiSettings['commentary_tone'],
              })
            }
            options={COMMENTARY_TONE_OPTIONS}
          />
        </div>
      </div>

      <div className="project-ai-note">
        Every AI change is listed in Version history and can be undone.
      </div>
      <p className="project-ai-foot">
        {lockedByWorkspace
          ? 'AI is turned off for this workspace, so these settings stay locked.'
          : 'Workspace admins can lock these settings for all projects.'}
      </p>
      {error ? <p className="flow-error">{error}</p> : null}
    </section>
  );
}
