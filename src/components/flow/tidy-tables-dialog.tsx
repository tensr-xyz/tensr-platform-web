'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { flowJson } from '@/lib/flow-api';
import {
  DEFAULT_TIDY_CRITERIA,
  type TidyCriteria,
  type TidyDecision,
  type TidyMode,
  type TidyScanResult,
  tidyConfirmLabel,
  tidyNeedsRebuildCount,
  tidyNeedsRebuildNote,
  tidyReasonRows,
  tidyScanBody,
} from '@/lib/tidy-tables';

const MODES: { value: TidyMode; label: string; warn?: boolean }[] = [
  { value: 'park', label: 'Move to "Parked"' },
  { value: 'hide', label: 'Hide from report' },
  { value: 'delete', label: 'Delete', warn: true },
];

/** Tables screen overlay for parking, hiding, or deleting dull/broken tables (Paper 9b). */
export function TidyTablesDialog({
  datasetId,
  open,
  onOpenChange,
  onApplied,
}: {
  datasetId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplied?: () => void;
}) {
  const [criteria, setCriteria] = useState<TidyCriteria>(DEFAULT_TIDY_CRITERIA);
  const [scan, setScan] = useState<TidyScanResult | null>(null);
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !datasetId) return;
    let live = true;
    setBusy(true);
    setError('');
    setReview(false);
    setScan(null);
    setCriteria(DEFAULT_TIDY_CRITERIA);
    void flowJson<TidyScanResult>(`/datasets/${datasetId}/tables/prune`, {
      method: 'POST',
      body: tidyScanBody(DEFAULT_TIDY_CRITERIA, true),
    })
      .then(result => {
        if (!live) return;
        setScan(result);
      })
      .catch(err => {
        if (!live) return;
        setError(err instanceof Error ? err.message : 'Could not scan tables');
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
    };
  }, [open, datasetId]);

  async function rescan(next: TidyCriteria) {
    if (!datasetId) return;
    setCriteria(next);
    setBusy(true);
    setError('');
    try {
      const result = await flowJson<TidyScanResult>(`/datasets/${datasetId}/tables/prune`, {
        method: 'POST',
        body: tidyScanBody(next, true),
      });
      setScan(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not scan tables');
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!datasetId || busy) return;
    setBusy(true);
    setError('');
    try {
      await flowJson<TidyScanResult>(`/datasets/${datasetId}/tables/prune`, {
        method: 'POST',
        body: tidyScanBody(criteria, false),
      });
      onOpenChange(false);
      onApplied?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not tidy tables');
    } finally {
      setBusy(false);
    }
  }

  const rows = tidyReasonRows(scan, criteria);
  const nTables = scan?.n_tables ?? 0;
  const nPruned = scan?.n_pruned ?? 0;
  const nNeedsRebuild = tidyNeedsRebuildCount(scan);
  const rebuildNote = tidyNeedsRebuildNote(nNeedsRebuild);
  const decisions = (scan?.decisions || []).filter((item): item is TidyDecision =>
    Boolean(item && item.action && item.action !== 'keep')
  );
  const confirm = tidyConfirmLabel(scan, criteria.mode);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="tidy-dialog flow-modal" aria-describedby="tidy-tables-copy">
        <div className="tidy-dialog-head flow-modal-head">
          <DialogTitle className="tidy-dialog-title">Tidy tables</DialogTitle>
          <span className="tidy-dialog-count">
            {busy && !scan ? '…' : `${nTables} ${nTables === 1 ? 'table' : 'tables'}`}
          </span>
        </div>
        <div className="flow-modal-body">
          <DialogDescription id="tidy-tables-copy" className="tidy-dialog-copy">
            Find tables that aren&apos;t worth keeping. Nothing is deleted until you choose.
          </DialogDescription>

          <div className="tidy-dialog-reasons" aria-busy={busy}>
            {rows.map(row => (
              <div
                key={row.reason}
                className="tidy-dialog-reason"
                data-warn={row.reason === 'broken' && row.count > 0 ? 'true' : undefined}
              >
                <span>{row.label}</span>
                <span className="tidy-dialog-reason-n">{row.count}</span>
              </div>
            ))}
            {rebuildNote ? <p className="tidy-dialog-rebuild-note">{rebuildNote}</p> : null}
          </div>

          <div className="tidy-dialog-then">
            <span>Then</span>
            <div className="tidy-dialog-modes" role="group" aria-label="What to do">
              {MODES.map(mode => (
                <Button
                  key={mode.value}
                  type="button"
                  className="tidy-dialog-mode"
                  data-active={criteria.mode === mode.value}
                  data-warn={mode.warn ? 'true' : undefined}
                  aria-pressed={criteria.mode === mode.value}
                  disabled={busy}
                  onClick={() => void rescan({ ...criteria, mode: mode.value })}
                >
                  {mode.label}
                </Button>
              ))}
            </div>
          </div>

          {review ? (
            <ul className="tidy-dialog-list">
              {decisions.length ? (
                decisions.map(item => (
                  <li key={String(item.id || item.label)}>
                    <span>{item.label || item.id || 'Table'}</span>
                    <span className="tidy-dialog-list-reason">{item.detail || item.reason}</span>
                  </li>
                ))
              ) : (
                <li className="tidy-dialog-empty">Nothing matches these checks.</li>
              )}
            </ul>
          ) : null}

          {error ? <p className="tidy-dialog-error">{error}</p> : null}
        </div>

        <div className="tidy-dialog-foot flow-modal-foot">
          <Button
            type="button"
            className="tidy-dialog-secondary"
            disabled={busy}
            onClick={() => setReview(current => !current)}
          >
            {review ? 'Hide list' : 'Review list first'}
          </Button>
          <Button
            type="button"
            className="tidy-dialog-primary"
            disabled={busy || nPruned < 1}
            onClick={() => void apply()}
          >
            {busy && scan ? 'Working…' : confirm}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
