'use client';

import { Button } from '@/components/ui/button';
import type { NumberTrace } from '@/lib/number-trace';

/** Paper 9f · number trace: where a table figure came from. */
export function NumberTracePopover({
  trace,
  onShowRespondents,
  onComment,
}: {
  trace: NumberTrace;
  onShowRespondents?: () => void;
  onComment?: () => void;
}) {
  return (
    <div className="number-trace" aria-label="Number trace">
      <div className="number-trace-head">
        <span className="number-trace-value">{trace.value}</span>
        <span className="number-trace-context">{trace.context}</span>
      </div>
      <div className="number-trace-rows">
        {trace.rows.map(row => (
          <div key={row.label} className="number-trace-row">
            <span className="number-trace-label">{row.label}</span>
            <span
              className={
                row.accent ? 'number-trace-detail number-trace-accent' : 'number-trace-detail'
              }
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>
      <div className="number-trace-actions">
        {onShowRespondents ? (
          <Button className="flow-btn" type="button" onClick={onShowRespondents}>
            {trace.showRespondentsLabel}
          </Button>
        ) : null}
        {onComment ? (
          <Button className="flow-btn" type="button" onClick={onComment}>
            Comment
          </Button>
        ) : null}
      </div>
    </div>
  );
}
