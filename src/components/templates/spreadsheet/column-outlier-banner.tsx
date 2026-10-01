'use client';

import { Button } from '@/components/atoms/button';

export type OutlierMethod = 'cap' | 'remove' | 'flag';

export function ColumnOutlierBanner({
  columnId,
  flagged,
  nRows,
  busy,
  onApply,
  onDismiss,
}: {
  columnId: string;
  flagged: number;
  nRows: number;
  busy: boolean;
  onApply: (method: OutlierMethod) => void;
  onDismiss: () => void;
}) {
  return (
    <div
      data-testid="outlier-actions"
      className="flex flex-wrap items-center gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
    >
      <span>
        Flagged {flagged} of {nRows} rows in {columnId} (IQR). Highlighted in the sheet.
      </span>
      {flagged > 0 ? (
        <>
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid="outlier-action-flag"
            disabled={busy}
            onClick={() => onApply('flag')}
          >
            Flag
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid="outlier-action-cap"
            disabled={busy}
            onClick={() => onApply('cap')}
          >
            Cap
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid="outlier-action-remove"
            disabled={busy}
            onClick={() => onApply('remove')}
          >
            Remove
          </Button>
        </>
      ) : null}
      <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onDismiss}>
        Dismiss
      </Button>
    </div>
  );
}
