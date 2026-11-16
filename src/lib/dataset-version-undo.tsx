'use client';

import { ToastAction } from '@/components/molecules/toast/toast';
import { toast } from '@/hooks/ui/use-toast';
import { flowJson } from '@/lib/flow-api';
import { datasetRestorePath } from '@/lib/dataset-versions';

/** Restore an earlier dataset version and make it the project's active file. */
export async function useDatasetVersion(opts: {
  projectId: string;
  versionId: string;
  /** Tip of the lineage when known; otherwise the version itself. */
  tipDatasetId?: string;
}): Promise<string> {
  const tip = opts.tipDatasetId || opts.versionId;
  await flowJson(datasetRestorePath(tip, opts.versionId), { method: 'POST' });
  await flowJson(`/api/projects/${opts.projectId}`, {
    method: 'PATCH',
    body: JSON.stringify({ active_dataset_id: opts.versionId }),
  });
  return opts.versionId;
}

/** Point the project at a previous dataset id (stack, join, edit, or row change undo). */
export async function setProjectActiveDataset(
  projectId: string,
  datasetId: string
): Promise<string> {
  await flowJson(`/api/projects/${projectId}`, {
    method: 'PATCH',
    body: JSON.stringify({ active_dataset_id: datasetId }),
  });
  return datasetId;
}

/** After a versioned edit, offer Undo that returns the project to the previous file. */
export function showDatasetVersionUndoToast(opts: {
  projectId: string;
  previousDatasetId: string;
  currentDatasetId?: string;
  title?: string;
  onRestored?: (datasetId: string) => void;
}): void {
  const previous = opts.previousDatasetId.trim();
  const current = (opts.currentDatasetId || '').trim();
  if (!opts.projectId || !previous || (current && previous === current)) return;
  toast({
    title: opts.title || 'Saved as a new version',
    description: 'Undo returns this project to the previous version.',
    duration: 12_000,
    action: (
      <ToastAction
        altText="Undo"
        onClick={() => {
          const restore =
            current && current !== previous
              ? useDatasetVersion({
                  projectId: opts.projectId,
                  tipDatasetId: current,
                  versionId: previous,
                }).catch(() => setProjectActiveDataset(opts.projectId, previous))
              : setProjectActiveDataset(opts.projectId, previous);
          void restore
            .then(id => opts.onRestored?.(id))
            .catch(() => {
              toast({
                title: 'Could not undo',
                description: 'The previous version was not restored.',
                variant: 'destructive',
              });
            });
        }}
      >
        Undo
      </ToastAction>
    ),
  });
}
