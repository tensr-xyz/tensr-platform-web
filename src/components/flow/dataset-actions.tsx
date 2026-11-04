'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/rest';
import { flowJson } from '@/lib/flow-api';

export function renameDataset(datasetId: string, name: string) {
  return flowJson(`/datasets/${datasetId}`, {
    method: 'PATCH',
    body: JSON.stringify({ original_filename: name.trim() }),
  });
}

export function archiveDataset(datasetId: string, archived = true) {
  return flowJson(`/datasets/${datasetId}/archive`, {
    method: 'POST',
    body: JSON.stringify({ archived }),
  });
}

/** Rename or archive a file. Extra items (open, move, download) come from the caller. */
export function DatasetMenu({
  datasetId,
  name,
  inUse = false,
  onChanged,
  children,
}: {
  datasetId: string;
  name: string;
  inUse?: boolean;
  onChanged: () => void;
  children?: React.ReactNode;
}) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const save = () => {
    if (!draft.trim()) return;
    setBusy(true);
    setError('');
    void renameDataset(datasetId, draft)
      .then(() => {
        setRenaming(false);
        onChanged();
      })
      .catch(err => setError(err instanceof Error ? err.message : 'The name did not save.'))
      .finally(() => setBusy(false));
  };
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="row-more" type="button" aria-label={`Actions for ${name}`}>
            ···
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="row-menu">
          {children}
          <DropdownMenuItem
            onSelect={() => {
              setDraft(name);
              setRenaming(true);
            }}
          >
            Rename
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={inUse}
            onSelect={() => void archiveDataset(datasetId).then(onChanged)}
          >
            {inUse ? 'Archive (open another file first)' : 'Archive'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename file</DialogTitle>
            <DialogDescription>
              The data and every output that used it stay the same.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            aria-label="File name"
            value={draft}
            onChange={event => setDraft(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') save();
            }}
          />
          {error ? <p className="flow-error">{error}</p> : null}
          <div className="flow-row">
            <Button className="flow-btn" type="button" onClick={() => setRenaming(false)}>
              Cancel
            </Button>
            <Button
              className="flow-btn primary"
              type="button"
              disabled={busy || !draft.trim()}
              onClick={save}
            >
              {busy ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
