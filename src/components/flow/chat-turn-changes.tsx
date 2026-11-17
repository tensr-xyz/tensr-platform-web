'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  chatTurnUndoTarget,
  formatChatTurnChangesHeadline,
  type ChatTurnChange,
} from '@/lib/chat-turn-parity';
import { setProjectActiveDataset, useDatasetVersion } from '@/lib/dataset-version-undo';
import { toast } from '@/hooks/ui/use-toast';

function changeKey(change: ChatTurnChange, index: number): string {
  return [
    change.previousDatasetId || '',
    change.currentDatasetId || '',
    change.operation || '',
    String(index),
  ].join('|');
}

async function restoreChange(opts: {
  projectId: string;
  previousDatasetId: string;
  currentDatasetId?: string;
}): Promise<string> {
  const previous = opts.previousDatasetId.trim();
  const current = (opts.currentDatasetId || '').trim();
  if (!opts.projectId || !previous) {
    throw new Error('Missing version to restore.');
  }
  if (current && current !== previous) {
    try {
      return await useDatasetVersion({
        projectId: opts.projectId,
        tipDatasetId: current,
        versionId: previous,
      });
    } catch {
      return setProjectActiveDataset(opts.projectId, previous);
    }
  }
  return setProjectActiveDataset(opts.projectId, previous);
}

/** Paper 9e change list under a chat reply: N changes, Undo all, per-row Undo. */
export function ChatTurnChangesPanel({
  projectId,
  changes,
  versionLabel,
  disabled = false,
  onRestored,
}: {
  projectId: string;
  changes: ChatTurnChange[];
  versionLabel?: string | number | null;
  disabled?: boolean;
  onRestored?: (datasetId: string) => void;
}) {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [undone, setUndone] = useState<Set<string>>(() => new Set());
  if (!changes.length) return null;

  const headline = formatChatTurnChangesHeadline(changes, { versionLabel });
  const allTarget = chatTurnUndoTarget(changes);
  const canUndoAll = Boolean(allTarget?.previousDatasetId) && !disabled;

  const runUndo = (
    key: string,
    target: { previousDatasetId: string; currentDatasetId?: string }
  ) => {
    if (!projectId || busyKey) return;
    setBusyKey(key);
    void restoreChange({
      projectId,
      previousDatasetId: target.previousDatasetId,
      currentDatasetId: target.currentDatasetId,
    })
      .then(id => {
        setUndone(current => {
          const next = new Set(current);
          if (key === 'all') {
            for (let i = 0; i < changes.length; i += 1) {
              next.add(changeKey(changes[i]!, i));
            }
          } else {
            next.add(key);
          }
          return next;
        });
        onRestored?.(id);
      })
      .catch(() => {
        toast({
          title: 'Could not undo',
          description: 'The previous version was not restored.',
          variant: 'destructive',
        });
      })
      .finally(() => setBusyKey(null));
  };

  return (
    <div className="chat-turn-changes" aria-label={headline}>
      <div className="chat-turn-changes-head">
        <span className="chat-turn-changes-title">{headline}</span>
        {canUndoAll ? (
          <Button
            type="button"
            className="chat-turn-changes-undo-all"
            disabled={
              Boolean(busyKey) ||
              changes.every((change, index) => undone.has(changeKey(change, index)))
            }
            onClick={() => {
              if (!allTarget) return;
              runUndo('all', allTarget);
            }}
          >
            Undo all
          </Button>
        ) : null}
      </div>
      {changes.map((change, index) => {
        const key = changeKey(change, index);
        const isUndone = undone.has(key);
        const canUndo = Boolean(change.previousDatasetId) && !disabled && !isUndone;
        return (
          <div
            key={key}
            className="chat-turn-changes-row"
            data-undone={isUndone ? 'true' : undefined}
          >
            <span className="chat-turn-changes-label">{change.label}</span>
            {canUndo ? (
              <Button
                type="button"
                className="chat-turn-changes-undo"
                disabled={Boolean(busyKey)}
                onClick={() =>
                  runUndo(key, {
                    previousDatasetId: change.previousDatasetId!,
                    currentDatasetId: change.currentDatasetId,
                  })
                }
              >
                Undo
              </Button>
            ) : isUndone ? (
              <span className="chat-turn-changes-undone">Undone</span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
