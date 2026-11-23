'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/rest';
import { cn } from '@/utils';

/** One checklist row in the Paper 5d "In each cell" popover. */
export type CellStatOption = {
  id: string;
  label: string;
  kinds: string[];
  /** Shown only when the active weight projects to a population. */
  projectionOnly?: boolean;
  hint?: string;
};

export const CELL_STAT_OPTIONS: CellStatOption[] = [
  { id: 'column_pct', label: 'Column %', kinds: ['column_proportion'] },
  {
    id: 'projected',
    label: 'Projected 000s',
    kinds: ['projected_thousands'],
    projectionOnly: true,
    hint: 'projection weight only',
  },
  { id: 'index', label: 'Index vs Total', kinds: ['index'] },
  { id: 'unweighted', label: 'Unweighted n', kinds: ['unweighted_base'] },
  { id: 'row_pct', label: 'Row %', kinds: ['row_proportion'] },
  { id: 'total_pct', label: 'Total %', kinds: ['total_proportion'] },
  { id: 'count', label: 'Weighted count', kinds: ['count'] },
  {
    id: 'inferential',
    label: 'z-statistic · standard error',
    kinds: ['z_statistic', 'standard_error'],
  },
  {
    id: 'bases',
    label: 'Effective base · missing count',
    kinds: ['effective_base', 'missing_count'],
  },
  {
    id: 'ci',
    label: '95% confidence interval',
    kinds: ['confidence_interval'],
  },
];

/** Options visible for this weight: Projected 000s only on a projection weight. */
export function cellStatOptionsForWeight(isProjection: boolean): CellStatOption[] {
  return CELL_STAT_OPTIONS.filter(option => !option.projectionOnly || isProjection);
}

/** Ordered option ids that are currently ticked from the selected statistic kinds. */
export function selectedCellStatIds(statistics: string[], isProjection: boolean): string[] {
  const kinds = new Set(statistics);
  const ids: string[] = [];
  for (const option of cellStatOptionsForWeight(isProjection)) {
    if (option.kinds.every(kind => kinds.has(kind))) ids.push(option.id);
  }
  return ids;
}

/** Flatten ordered option ids into API statistic kinds, preserving display order. */
export function statisticsFromCellStatIds(
  orderedIds: string[],
  isProjection: boolean,
  meanOn = false
): string[] {
  const byId = new Map(cellStatOptionsForWeight(isProjection).map(option => [option.id, option]));
  const out: string[] = [];
  for (const id of orderedIds) {
    const option = byId.get(id);
    if (!option) continue;
    for (const kind of option.kinds) {
      if (!out.includes(kind)) out.push(kind);
    }
  }
  if (!out.length) out.push('column_proportion');
  if (meanOn && !out.includes('column_mean')) out.push('column_mean');
  return out;
}

/** Reorder a selected id list by dragging one id onto another. */
export function reorderCellStatIds(ids: string[], fromId: string, toId: string): string[] {
  if (fromId === toId) return ids;
  const from = ids.indexOf(fromId);
  const to = ids.indexOf(toId);
  if (from < 0 || to < 0) return ids;
  const next = [...ids];
  next.splice(from, 1);
  next.splice(to, 0, fromId);
  return next;
}

export type SummaryColumnKind = 'average' | 'total';

/** Paper 5d: In each cell checklist, preview, summary toggles, apply scope. */
export function CellStatsPopover({
  open,
  onOpenChange,
  statistics,
  isProjection,
  meanOn,
  summaryColumns,
  tableCount,
  preview,
  onApply,
  trigger,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statistics: string[];
  isProjection: boolean;
  meanOn: boolean;
  summaryColumns: SummaryColumnKind[];
  tableCount: number;
  preview?: { percent: string; detail: string; base: string; letter?: string };
  onApply: (next: {
    statistics: string[];
    summaryColumns: SummaryColumnKind[];
    scope: 'this' | 'all';
  }) => void;
  trigger: React.ReactNode;
}) {
  const options = useMemo(() => cellStatOptionsForWeight(isProjection), [isProjection]);
  const [draftIds, setDraftIds] = useState<string[]>(() =>
    selectedCellStatIds(statistics, isProjection)
  );
  const [draftSummaries, setDraftSummaries] = useState<SummaryColumnKind[]>(summaryColumns);
  const [dragging, setDragging] = useState<string | null>(null);

  function syncOpen(next: boolean) {
    if (next) {
      setDraftIds(selectedCellStatIds(statistics, isProjection));
      setDraftSummaries(summaryColumns);
      setDragging(null);
    }
    onOpenChange(next);
  }

  function toggleId(id: string) {
    setDraftIds(current => {
      if (current.includes(id)) {
        const next = current.filter(item => item !== id);
        return next.length ? next : current;
      }
      return [...current, id];
    });
  }

  function toggleSummary(kind: SummaryColumnKind) {
    setDraftSummaries(current =>
      current.includes(kind) ? current.filter(item => item !== kind) : [...current, kind]
    );
  }

  const orderRank = new Map(draftIds.map((id, index) => [id, index + 1]));

  return (
    <Popover open={open} onOpenChange={syncOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" sideOffset={8} className="cell-stats-popover">
        <div className="cell-stats-popover-head">
          <span>In each cell</span>
          <span className="flow-muted">Drag to reorder</span>
        </div>
        <div className="cell-stats-list" role="list">
          {options.map(option => {
            const checked = draftIds.includes(option.id);
            const rank = orderRank.get(option.id);
            return (
              <div
                key={option.id}
                role="listitem"
                className={cn('cell-stats-row', checked && 'is-on')}
                draggable={checked}
                onDragStart={() => setDragging(option.id)}
                onDragOver={event => {
                  if (!dragging || !checked) return;
                  event.preventDefault();
                }}
                onDrop={event => {
                  event.preventDefault();
                  if (!dragging) return;
                  setDraftIds(current => reorderCellStatIds(current, dragging, option.id));
                  setDragging(null);
                }}
                onDragEnd={() => setDragging(null)}
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => toggleId(option.id)}
                  aria-label={option.label}
                />
                <span className="cell-stats-row-label">{option.label}</span>
                {checked ? (
                  <span className="cell-stats-rank">
                    {rank}
                    {option.hint ? ` · ${option.hint}` : ''}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
        <div className="cell-stats-preview">
          <span className="flow-muted">Preview · stacked, one per line</span>
          <span className="flow-cell-stack cell-stats-preview-stack">
            <span className="flow-cell-stack-primary">
              {preview?.percent || '42%'}
              {preview?.letter ? <span className="grid-letter"> {preview.letter}</span> : null}
            </span>
            {preview?.detail ? (
              <span className="flow-cell-stack-muted">{preview.detail}</span>
            ) : (
              <span className="flow-cell-stack-muted">1,014k · 105</span>
            )}
            {preview?.base ? (
              <span className="flow-cell-stack-muted">{preview.base}</span>
            ) : (
              <span className="flow-cell-stack-muted">n 212</span>
            )}
          </span>
        </div>
        <div className="cell-stats-summaries">
          <span className="flow-muted">Summary columns and spans</span>
          <div className="cell-stats-summary-chips">
            <Button
              type="button"
              className="cell-stats-chip"
              data-active={draftSummaries.includes('average')}
              onClick={() => toggleSummary('average')}
            >
              + Average column
            </Button>
            <Button
              type="button"
              className="cell-stats-chip"
              data-active={draftSummaries.includes('total')}
              onClick={() => toggleSummary('total')}
            >
              + NET of columns
            </Button>
            <Button
              type="button"
              className="cell-stats-chip"
              disabled
              title="Needs design for custom spans"
            >
              + Span header
            </Button>
          </div>
          <div className="cell-stats-apply">
            <Button
              type="button"
              className="cell-stats-apply-btn"
              onClick={() => {
                onApply({
                  statistics: statisticsFromCellStatIds(draftIds, isProjection, meanOn),
                  summaryColumns: draftSummaries,
                  scope: 'this',
                });
                onOpenChange(false);
              }}
            >
              Apply to this table
            </Button>
            <Button
              type="button"
              className="cell-stats-apply-btn accent"
              disabled={tableCount < 2}
              onClick={() => {
                onApply({
                  statistics: statisticsFromCellStatIds(draftIds, isProjection, meanOn),
                  summaryColumns: draftSummaries,
                  scope: 'all',
                });
                onOpenChange(false);
              }}
            >
              Apply to all {tableCount} tables
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
