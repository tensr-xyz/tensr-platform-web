'use client';

import { Button } from '@/components/ui/button';
import { usedInPlacesLabel } from '@/components/flow/variable-lineage';

export type PreviewBar = {
  label: string;
  percent: number;
};

/** Paper 10d · hover/click preview for a question name outside Responses. */
export function VariablePreviewCard({
  label,
  kind,
  fileNote,
  bars,
  usedByCount = 0,
  onOpenInResponses,
  onUsedIn,
}: {
  label: string;
  kind: string;
  fileNote: string;
  bars: PreviewBar[];
  usedByCount?: number;
  onOpenInResponses?: () => void;
  onUsedIn?: () => void;
}) {
  const max = Math.max(1, ...bars.map(bar => bar.percent));
  return (
    <div className="variable-preview" aria-label="Variable preview">
      <div className="variable-preview-eyebrow">Click any question name</div>
      <div className="variable-preview-head">
        <span className="variable-preview-title">{label}</span>
        {kind ? <span className="variable-preview-kind">{kind}</span> : null}
      </div>
      {fileNote ? <div className="variable-preview-file">{fileNote}</div> : null}
      <div className="variable-preview-bars">
        {bars.map(bar => (
          <div key={bar.label} className="variable-preview-bar">
            <span className="variable-preview-bar-label">{bar.label}</span>
            <span
              className="variable-preview-bar-track"
              style={{ width: `${Math.max(4, Math.round((bar.percent / max) * 126))}px` }}
            />
            <span className="variable-preview-bar-pct">{Math.round(bar.percent)}%</span>
          </div>
        ))}
      </div>
      <div className="variable-preview-actions">
        {onOpenInResponses ? (
          <Button className="flow-btn" type="button" onClick={onOpenInResponses}>
            Open in Responses
          </Button>
        ) : null}
        {onUsedIn ? (
          <Button className="flow-btn" type="button" onClick={onUsedIn}>
            {usedInPlacesLabel(usedByCount)}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
