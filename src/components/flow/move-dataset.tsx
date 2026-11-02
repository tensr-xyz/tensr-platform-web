'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ChoiceSelect } from '@/components/ui/select';
import { datasetRowId } from '@/components/flow/survey-screens';
import { flowJson } from '@/lib/flow-api';

export type MovableDataset = {
  dataset_id?: string;
  id?: string;
  project_id?: string;
  original_filename?: string;
};

export function moveDatasetToProject(projectId: string, datasetId: string) {
  return flowJson<{ ok: boolean; dataset_id: string; project_id: string }>(
    `/api/projects/${projectId}/datasets`,
    {
      method: 'POST',
      body: JSON.stringify({ dataset_id: datasetId }),
    }
  );
}

export function MoveToProjectDialog({
  datasetId,
  datasetName,
  open,
  onOpenChange,
  onMoved,
}: {
  datasetId: string;
  datasetName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMoved?: () => void;
}) {
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [projectId, setProjectId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    void flowJson<{ projects?: { id: string; name: string }[] }>('/api/projects')
      .then(page => {
        const rows = page.projects || [];
        setProjects(rows);
        setProjectId(rows[0]?.id || '');
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Could not load projects'));
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move to project</DialogTitle>
          <DialogDescription>
            {datasetName ? `${datasetName} joins the project you pick` : 'The file joins the project you pick'}{' '}
            and can be stacked with the files already there.
          </DialogDescription>
        </DialogHeader>
        <ChoiceSelect
          aria-label="Project"
          value={projectId}
          onValueChange={setProjectId}
          placeholder="Choose a project"
          options={projects.map(project => ({
            value: project.id,
            label: project.name || project.id,
          }))}
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!datasetId || !projectId || busy}
            onClick={() => {
              setBusy(true);
              setError('');
              void moveDatasetToProject(projectId, datasetId)
                .then(() => {
                  onOpenChange(false);
                  onMoved?.();
                })
                .catch(err =>
                  setError(err instanceof Error ? err.message : 'Could not move the dataset')
                )
                .finally(() => setBusy(false));
            }}
          >
            {busy ? 'Moving…' : 'Move'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AddToProjectButton({
  projectId,
  datasets,
  onAdded,
}: {
  projectId: string;
  datasets: MovableDataset[];
  onAdded?: () => void;
}) {
  const others = datasets.filter(row => row.project_id !== projectId && datasetRowId(row));
  const [open, setOpen] = useState(false);
  const [datasetId, setDatasetId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <>
      <Button className="flow-btn" type="button" onClick={() => setOpen(true)}>
        Add to project
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to project</DialogTitle>
            <DialogDescription>
              Move an existing dataset into this project so it can be stacked with the files here.
            </DialogDescription>
          </DialogHeader>
          {others.length ? (
            <ChoiceSelect
              aria-label="Dataset"
              value={datasetId}
              onValueChange={setDatasetId}
              placeholder="Choose a dataset"
              options={others.map(row => ({
                value: datasetRowId(row),
                label: row.original_filename || datasetRowId(row),
              }))}
            />
          ) : (
            <p>Every dataset is already in this project.</p>
          )}
          {error ? <p className="flow-error">{error}</p> : null}
          <DialogFooter>
            <Button type="button" className="flow-btn" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="flow-btn primary"
              disabled={!datasetId || busy}
              onClick={() => {
                setBusy(true);
                setError('');
                void moveDatasetToProject(projectId, datasetId)
                  .then(() => {
                    setOpen(false);
                    setDatasetId('');
                    onAdded?.();
                  })
                  .catch(err =>
                    setError(err instanceof Error ? err.message : 'Could not add the dataset')
                  )
                  .finally(() => setBusy(false));
              }}
            >
              {busy ? 'Adding…' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
