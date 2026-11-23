'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/rest';
import { flowJson } from '@/lib/flow-api';
import type { DataChecksReport } from '@/lib/dataset-data-ops';
import {
  dataCheckCards,
  dataChecksFooterNote,
  dataChecksPassedLine,
  dataChecksTitle,
  type DataCheckCard,
} from '@/lib/data-checks-panel';

/** Paper 10h · Responses → Check data. Lists construction and straight-lining findings. */
export function DataChecksDialog({
  datasetId,
  open,
  onOpenChange,
  onShow,
}: {
  datasetId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShow?: (card: DataCheckCard) => void;
}) {
  const [report, setReport] = useState<DataChecksReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !datasetId) return;
    let live = true;
    setBusy(true);
    setError('');
    setReport(null);
    void flowJson<DataChecksReport>(`/datasets/${datasetId}/data-checks`)
      .then(next => {
        if (!live) return;
        setReport(next);
      })
      .catch(err => {
        if (!live) return;
        setError(err instanceof Error ? err.message : 'Could not run data checks');
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
    };
  }, [open, datasetId]);

  const cards = dataCheckCards(report);
  const passed = dataChecksPassedLine(report);
  const title = dataChecksTitle(cards.length, { loading: busy });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="data-checks-dialog" aria-describedby="data-checks-note">
        <DialogTitle className="data-checks-eyebrow">Responses → Check data</DialogTitle>
        <div className="data-checks-title" aria-live="polite">
          {title}
        </div>

        {busy ? (
          <div className="data-checks-list" aria-busy="true">
            <Skeleton className="data-checks-skeleton" />
            <Skeleton className="data-checks-skeleton" />
            <Skeleton className="data-checks-skeleton short" />
          </div>
        ) : null}

        {!busy && error ? <p className="flow-error">{error}</p> : null}

        {!busy && !error ? (
          <div className="data-checks-list">
            {cards.map(card => (
              <div key={card.id} className="data-checks-card">
                <div className="data-checks-card-title">{card.title}</div>
                {card.detail ? <div className="data-checks-card-detail">{card.detail}</div> : null}
                {onShow ? (
                  <Button
                    type="button"
                    className="data-checks-card-action"
                    onClick={() => {
                      onShow(card);
                      onOpenChange(false);
                    }}
                  >
                    {card.showLabel}
                  </Button>
                ) : (
                  <div className="data-checks-card-action-static">{card.showLabel}</div>
                )}
              </div>
            ))}
            {passed ? <div className="data-checks-passed">{passed}</div> : null}
            {!cards.length && !passed ? (
              <div className="data-checks-passed">✓ No construction or straight-lining issues</div>
            ) : null}
          </div>
        ) : null}

        <p id="data-checks-note" className="data-checks-note">
          {dataChecksFooterNote()}
        </p>
      </DialogContent>
    </Dialog>
  );
}
