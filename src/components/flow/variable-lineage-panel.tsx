'use client';

import { Button } from '@/components/ui/button';
import {
  removedRespondentsSummary,
  type LineageItem,
  type RemovedCase,
} from '@/components/flow/variable-lineage';

/** Paper 10d · Built from / Used by + Removed respondents with Restore. */
export function VariableLineagePanel({
  label,
  builtFrom,
  usedBy,
  removedCases,
  restoring = false,
  onRestore,
}: {
  label: string;
  builtFrom: LineageItem[];
  usedBy: LineageItem[];
  removedCases: RemovedCase[];
  restoring?: boolean;
  onRestore?: (caseIds: string[]) => void;
}) {
  const removedSummary = removedRespondentsSummary(removedCases);
  return (
    <div className="variable-lineage" aria-label="Used in">
      <div className="variable-lineage-eyebrow">Used in</div>
      <h3 className="variable-lineage-title">{label}</h3>
      <div className="variable-lineage-cols">
        <div className="variable-lineage-col">
          <div className="variable-lineage-heading">Built from</div>
          {builtFrom.length ? (
            builtFrom.map(item => (
              <div
                key={`built-${item.kind}-${item.name || item.title}`}
                className="variable-lineage-card"
              >
                {item.detail && item.kind === 'column'
                  ? `${item.title}${item.detail ? ` · ${item.detail}` : ''}`
                  : item.title}
              </div>
            ))
          ) : (
            <div className="variable-lineage-empty">No earlier inputs.</div>
          )}
        </div>
        <div className="variable-lineage-col">
          <div className="variable-lineage-heading">Used by</div>
          {usedBy.length ? (
            usedBy.map(item => (
              <div
                key={`used-${item.kind}-${item.id || item.title}`}
                className={
                  item.stale
                    ? 'variable-lineage-card variable-lineage-warn'
                    : 'variable-lineage-card'
                }
              >
                {item.title}
              </div>
            ))
          ) : (
            <div className="variable-lineage-empty">Not used in a table or derived column yet.</div>
          )}
        </div>
      </div>
      {usedBy.length ? (
        <p className="variable-lineage-note">
          Deleting or recoding this question warns you about everything listed under &ldquo;Used
          by&rdquo; first.
        </p>
      ) : null}
      {removedSummary ? (
        <>
          <div className="variable-lineage-rule" />
          <div className="variable-lineage-heading">Removed respondents</div>
          <div className="variable-removed">
            <span>{removedSummary}</span>
            {onRestore ? (
              <Button
                type="button"
                className="variable-restore"
                disabled={restoring}
                onClick={() => onRestore(removedCases.map(item => item.case_id))}
              >
                Restore
              </Button>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
