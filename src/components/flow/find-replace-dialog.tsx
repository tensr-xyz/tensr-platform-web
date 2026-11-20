'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { flowJson } from '@/lib/flow-api';
import {
  DEFAULT_FIND_REPLACE_SCOPES,
  FIND_REPLACE_SCOPE_CHIPS,
  findReplaceAllLabel,
  findReplaceApplyBody,
  findReplaceMatchesLabel,
  findReplacePreviewBody,
  findReplaceVisibleRows,
  toggleFindReplaceScope,
  type FindReplaceResult,
  type FindReplaceScope,
} from '@/lib/find-replace';

/** Project dialog: find/replace labels in report, tables, and questions (Paper 9e). */
export function FindReplaceDialog({
  datasetId,
  open,
  onOpenChange,
  onApplied,
}: {
  datasetId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplied?: (result: FindReplaceResult) => void;
}) {
  const [find, setFind] = useState('');
  const [replace, setReplace] = useState('');
  const [scopes, setScopes] = useState<FindReplaceScope[]>(DEFAULT_FIND_REPLACE_SCOPES);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [preview, setPreview] = useState<FindReplaceResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setFind('');
    setReplace('');
    setScopes(DEFAULT_FIND_REPLACE_SCOPES);
    setCaseSensitive(false);
    setPreview(null);
    setError('');
    setBusy(false);
  }, [open, datasetId]);

  const scan = useCallback(
    async (
      nextFind: string,
      nextScopes: FindReplaceScope[],
      nextCase: boolean,
      nextReplace: string
    ) => {
      if (!datasetId || !nextFind.trim()) {
        setPreview(null);
        return;
      }
      setBusy(true);
      setError('');
      try {
        const result = await flowJson<FindReplaceResult>(`/datasets/${datasetId}/find-replace`, {
          method: 'POST',
          body: findReplacePreviewBody({
            find: nextFind,
            replace: nextReplace,
            scopes: nextScopes,
            caseSensitive: nextCase,
          }),
        });
        setPreview(result);
      } catch (err) {
        setPreview(null);
        setError(err instanceof Error ? err.message : 'Could not search labels');
      } finally {
        setBusy(false);
      }
    },
    [datasetId]
  );

  useEffect(() => {
    if (!open || !datasetId) return;
    const handle = window.setTimeout(() => {
      void scan(find, scopes, caseSensitive, replace);
    }, 220);
    return () => window.clearTimeout(handle);
  }, [open, datasetId, find, scopes, caseSensitive, replace, scan]);

  async function apply(matchIndex?: number) {
    if (!datasetId || !find.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await flowJson<FindReplaceResult>(`/datasets/${datasetId}/find-replace`, {
        method: 'POST',
        body: findReplaceApplyBody({
          find,
          replace,
          scopes,
          caseSensitive,
          matchIndex,
        }),
      });
      onApplied?.(result);
      if (matchIndex != null) {
        await scan(find, scopes, caseSensitive, replace);
      } else {
        onOpenChange(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not replace labels');
    } finally {
      setBusy(false);
    }
  }

  const nMatches = preview?.n_matches ?? 0;
  const rows = findReplaceVisibleRows(preview?.matches, find);
  const canReplace = Boolean(datasetId && find.trim() && nMatches > 0 && !busy);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="find-replace-dialog" aria-describedby="find-replace-note">
        <DialogTitle className="find-replace-eyebrow">Find and replace · ⌘F</DialogTitle>

        <div className="find-replace-fields">
          <Input
            className="find-replace-input"
            data-active={Boolean(find.trim()) || undefined}
            value={find}
            onChange={event => setFind(event.target.value)}
            placeholder="Find"
            aria-label="Find"
            autoFocus
          />
          <Input
            className="find-replace-input"
            value={replace}
            onChange={event => setReplace(event.target.value)}
            placeholder="Replace with"
            aria-label="Replace with"
          />
        </div>

        <div className="find-replace-chips" role="group" aria-label="Where to search">
          {FIND_REPLACE_SCOPE_CHIPS.map(chip => (
            <Button
              key={chip.scope}
              type="button"
              className="find-replace-chip"
              data-active={scopes.includes(chip.scope)}
              aria-pressed={scopes.includes(chip.scope)}
              disabled={busy}
              onClick={() => setScopes(current => toggleFindReplaceScope(current, chip.scope))}
            >
              {chip.label}
            </Button>
          ))}
          <Button
            type="button"
            className="find-replace-chip"
            data-active={caseSensitive}
            aria-pressed={caseSensitive}
            disabled={busy}
            onClick={() => setCaseSensitive(value => !value)}
          >
            Match case
          </Button>
        </div>

        <div className="find-replace-results" aria-busy={busy}>
          <div className="find-replace-results-head">
            {!find.trim()
              ? 'Type to search labels'
              : busy && !preview
                ? '…'
                : findReplaceMatchesLabel(nMatches)}
          </div>
          {find.trim() ? (
            <ul className="find-replace-results-list">
              {rows.length ? (
                rows.map(row => (
                  <li key={row.key} data-overflow={row.overflow ? 'true' : undefined}>
                    {row.line}
                  </li>
                ))
              ) : (
                <li data-overflow="true">{busy ? 'Searching…' : 'No matches'}</li>
              )}
            </ul>
          ) : null}
        </div>

        {error ? <p className="find-replace-error">{error}</p> : null}

        <div className="find-replace-foot">
          <Button
            type="button"
            className="find-replace-secondary"
            disabled={!canReplace}
            onClick={() => void apply(0)}
          >
            Replace one
          </Button>
          <Button
            type="button"
            className="find-replace-primary"
            disabled={!canReplace}
            onClick={() => void apply()}
          >
            {findReplaceAllLabel(nMatches)}
          </Button>
        </div>

        <DialogDescription id="find-replace-note" className="find-replace-note">
          Replacing changes labels only, never data. One Undo reverses it.
        </DialogDescription>
      </DialogContent>
    </Dialog>
  );
}
