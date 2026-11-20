'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ChoiceSelect } from '@/components/ui/select';
import { flowJson } from '@/lib/flow-api';
import {
  DEFAULT_MERGE_SMALL_MAX_PCT,
  mergeSmallConfirmLabel,
  mergeSmallPreviewRows,
  mergeSmallRowDetail,
  mergeSmallThresholdOptions,
  parseMergeSmallMaxPct,
  type MergeSmallMaxPct,
  type MergeSmallPreview,
} from '@/lib/merge-small-answers';

/** Responses column-menu dialog: merge answers at or under a size threshold (Paper 9d). */
export function MergeSmallAnswersDialog({
  datasetId,
  column,
  questionLabel,
  open,
  onOpenChange,
  onApplied,
}: {
  datasetId?: string;
  column: string;
  questionLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplied?: (datasetId: string) => void;
}) {
  const [maxPct, setMaxPct] = useState<MergeSmallMaxPct>(DEFAULT_MERGE_SMALL_MAX_PCT);
  const [combinedLabel, setCombinedLabel] = useState('Other');
  const [preview, setPreview] = useState<MergeSmallPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !datasetId || !column) return;
    let live = true;
    setBusy(true);
    setError('');
    setPreview(null);
    setMaxPct(DEFAULT_MERGE_SMALL_MAX_PCT);
    setCombinedLabel('Other');
    void flowJson<MergeSmallPreview>(`/datasets/${datasetId}/merge-small-categories/preview`, {
      method: 'POST',
      body: JSON.stringify({
        column,
        max_pct: DEFAULT_MERGE_SMALL_MAX_PCT,
        combined_label: 'Other',
      }),
    })
      .then(result => {
        if (!live) return;
        setPreview(result);
        if (result.combined_label) setCombinedLabel(String(result.combined_label));
      })
      .catch(err => {
        if (!live) return;
        setError(err instanceof Error ? err.message : 'Could not preview merges');
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
    };
  }, [open, datasetId, column]);

  async function rescan(nextPct: MergeSmallMaxPct, nextLabel: string) {
    if (!datasetId || !column) return;
    setMaxPct(nextPct);
    setCombinedLabel(nextLabel);
    setBusy(true);
    setError('');
    try {
      const result = await flowJson<MergeSmallPreview>(
        `/datasets/${datasetId}/merge-small-categories/preview`,
        {
          method: 'POST',
          body: JSON.stringify({
            column,
            max_pct: nextPct,
            combined_label: nextLabel.trim() || 'Other',
          }),
        }
      );
      setPreview(result);
      if (!nextLabel.trim() && result.combined_label) {
        setCombinedLabel(String(result.combined_label));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not preview merges');
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!datasetId || !column || busy) return;
    const n = preview?.small_categories?.length || 0;
    if (!n) return;
    setBusy(true);
    setError('');
    try {
      const saved = await flowJson<{ dataset_id?: string }>(
        `/datasets/${datasetId}/merge-small-categories`,
        {
          method: 'POST',
          body: JSON.stringify({
            column,
            max_pct: maxPct,
            combined_label: combinedLabel.trim() || 'Other',
          }),
        }
      );
      const next = String(saved.dataset_id || '');
      onOpenChange(false);
      if (next) onApplied?.(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not merge answers');
    } finally {
      setBusy(false);
    }
  }

  const rows = mergeSmallPreviewRows(preview);
  const mergeCount = preview?.small_categories?.length || 0;
  const targetLabel = combinedLabel.trim() || preview?.combined_label || 'Other';
  const confirm = mergeSmallConfirmLabel(mergeCount);
  const question = questionLabel.trim() || column;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="merge-small-dialog" aria-describedby="merge-small-copy">
        <p className="merge-small-eyebrow">Responses → column menu → Merge small answers</p>
        <DialogTitle className="merge-small-title">
          Merge small answers into &quot;Other&quot;
        </DialogTitle>
        <DialogDescription id="merge-small-copy" className="merge-small-question">
          Question: {question}
        </DialogDescription>

        <div className="merge-small-threshold">
          <span>Answers under</span>
          <ChoiceSelect
            className="merge-small-select"
            aria-label="Size threshold"
            value={String(maxPct)}
            disabled={busy}
            options={mergeSmallThresholdOptions()}
            onValueChange={value => void rescan(parseMergeSmallMaxPct(value), combinedLabel)}
          />
          <span>of answers</span>
        </div>

        <div className="merge-small-rows" aria-busy={busy}>
          {rows.length ? (
            rows.map(row => (
              <div key={`${row.value}-${row.label}`} className="merge-small-row">
                <span>{row.label}</span>
                <span
                  className="merge-small-row-detail"
                  data-merge={row.action === 'merge' ? 'true' : undefined}
                >
                  {mergeSmallRowDetail(row, targetLabel)}
                </span>
              </div>
            ))
          ) : (
            <p className="merge-small-empty">
              {busy ? '…' : preview?.summary || 'No small answers at this threshold.'}
            </p>
          )}
        </div>

        <div className="merge-small-name">
          <span>Name</span>
          <Input
            className="merge-small-name-input"
            aria-label="Combined answer name"
            value={combinedLabel}
            disabled={busy}
            onChange={event => setCombinedLabel(event.target.value)}
            onBlur={() => {
              const next = combinedLabel.trim() || 'Other';
              if (next !== combinedLabel) setCombinedLabel(next);
              void rescan(maxPct, next);
            }}
          />
        </div>

        <p className="merge-small-note">
          Saves a new version. The original answers stay in the file.
        </p>

        {error ? <p className="merge-small-error">{error}</p> : null}

        <div className="merge-small-foot">
          <Button
            type="button"
            className="merge-small-secondary"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="merge-small-primary"
            disabled={busy || mergeCount === 0}
            onClick={() => void apply()}
          >
            {confirm}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
