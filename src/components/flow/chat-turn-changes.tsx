'use client';

import { useState } from 'react';
import Link from 'next/link';
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
  responsesHref,
  disabled = false,
  onRestored,
}: {
  projectId: string;
  changes: ChatTurnChange[];
  versionLabel?: string | number | null;
  /** Responses sheet path for "See them" on row-removal edits. */
  responsesHref?: string | null;
  disabled?: boolean;
  onRestored?: (datasetId: string) => void;
}) {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [undone, setUndone] = useState<Set<string>>(() => new Set());
  const [seeKey, setSeeKey] = useState<string | null>(null);
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
        const showSee = Boolean(change.seeDropped) && !isUndone;
        const seeOpen = seeKey === key;
        return (
          <div key={key} className="chat-turn-changes-block">
            <div className="chat-turn-changes-row" data-undone={isUndone ? 'true' : undefined}>
              <span className="chat-turn-changes-label">{change.label}</span>
              {canUndo || showSee || isUndone ? (
                <span className="chat-turn-changes-actions">
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
                  ) : null}
                  {canUndo && showSee ? (
                    <span className="chat-turn-changes-sep" aria-hidden="true">
                      ·
                    </span>
                  ) : null}
                  {showSee ? (
                    <Button
                      type="button"
                      className="chat-turn-changes-see"
                      aria-expanded={seeOpen}
                      onClick={() => setSeeKey(current => (current === key ? null : key))}
                    >
                      See them
                    </Button>
                  ) : null}
                  {isUndone ? <span className="chat-turn-changes-undone">Undone</span> : null}
                </span>
              ) : null}
            </div>
            {seeOpen ? (
              <div className="chat-turn-changes-see-note" role="note">
                <p>Those respondents are no longer in the working version. Undo restores them.</p>
                {responsesHref ? (
                  <Link className="chat-turn-changes-see-link" href={responsesHref}>
                    Open Responses
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
