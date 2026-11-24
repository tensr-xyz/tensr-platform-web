'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/rest';
import { flowJson } from '@/lib/flow-api';
import { variablePanelKind } from '@/lib/sheet-cell-format';
import { VariablePreviewCard, type PreviewBar } from '@/components/flow/variable-preview-card';
import {
  rememberResponsesFocus,
  type ColumnDependencies,
} from '@/components/flow/variable-lineage';

type ValuePage = {
  counts?: Record<string, number>;
  value_labels?: Record<string, string>;
  missing?: number;
  n?: number;
};

function barsFromCounts(page: ValuePage | null): PreviewBar[] {
  if (!page?.counts) return [];
  const total = Math.max(
    1,
    Number(page.n) || Object.values(page.counts).reduce((a, b) => a + b, 0)
  );
  const labels = page.value_labels || {};
  return Object.entries(page.counts)
    .map(([code, count]) => ({
      label: String(labels[code] || code),
      percent: (Number(count) / total) * 100,
    }))
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 6);
}

/** Clickable question name → Paper 10d preview card. */
export function VariablePreviewTrigger({
  datasetId,
  projectId,
  column,
  label,
  kind,
  fileName,
  className,
  children,
  /** Real columns when `column` is a multi-response / brand-list set name. */
  memberColumns,
}: {
  datasetId?: string;
  projectId?: string;
  column: string;
  label: string;
  kind?: string;
  fileName?: string;
  className?: string;
  children?: ReactNode;
  memberColumns?: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [bars, setBars] = useState<PreviewBar[]>([]);
  const [fileNote, setFileNote] = useState('');
  const [usedByCount, setUsedByCount] = useState(0);
  const [resolvedKind, setResolvedKind] = useState(kind || '');

  const memberKey = (memberColumns || []).map(String).filter(Boolean).join('\0');

  useEffect(() => {
    if (!open || !datasetId || !column) return;
    let cancelled = false;
    const members = memberKey ? memberKey.split('\0') : [];
    const primary = flowJson<ValuePage>(
      `/datasets/${datasetId}/columns/${encodeURIComponent(column)}/values`
    ).catch(() => null);
    const fallbacks =
      members.length > 0
        ? Promise.all(
            members
              .slice(0, 8)
              .map(name =>
                flowJson<ValuePage>(
                  `/datasets/${datasetId}/columns/${encodeURIComponent(name)}/values`
                ).catch(() => null)
              )
          )
        : Promise.resolve([] as (ValuePage | null)[]);
    void Promise.all([
      primary,
      fallbacks,
      flowJson<ColumnDependencies>(
        `/datasets/${datasetId}/columns/${encodeURIComponent(members[0] || column)}/dependencies`
      ).catch(() => null),
    ]).then(([values, memberPages, deps]) => {
      if (cancelled) return;
      let page = values;
      // A set name is not a file column — use member pages so answered is not 0.
      if ((!page || !page.n) && memberPages.some(Boolean)) {
        const pages = memberPages.filter(Boolean) as ValuePage[];
        const n = Math.max(...pages.map(item => Number(item.n || 0)), 0);
        const missing = Math.min(...pages.map(item => Number(item.missing || 0)), n);
        const counts: Record<string, number> = {};
        const labels: Record<string, string> = {};
        pages.forEach((item, index) => {
          const name = members[index] || `item_${index + 1}`;
          const selected = Object.entries(item.counts || {}).find(([code]) => {
            const text = String(item.value_labels?.[code] || code)
              .trim()
              .toLowerCase();
            return text === 'selected' || text === 'yes' || code === '1';
          });
          const count = selected ? Number(selected[1] || 0) : 0;
          counts[name] = count;
          labels[name] = String(item.value_labels?.[name] || name);
        });
        page = { n, missing, counts, value_labels: labels };
      }
      const nextBars = barsFromCounts(page);
      setBars(nextBars);
      const answered = Math.max(0, Number(page?.n || 0) - Number(page?.missing || 0));
      const skipped = Number(page?.missing || 0);
      const file = fileName || 'This file';
      setFileNote(
        skipped
          ? `${file} · ${answered.toLocaleString('en-GB')} answered · ${skipped.toLocaleString('en-GB')} skipped`
          : `${file} · ${answered.toLocaleString('en-GB')} answered`
      );
      setUsedByCount(deps?.used_by_count || 0);
      if (!kind) {
        setResolvedKind(
          variablePanelKind(
            {
              value_labels: page?.value_labels || null,
            },
            nextBars.length
          )
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, datasetId, column, fileName, kind, memberKey]);

  const goResponses = (showLineage: boolean) => {
    if (!projectId) return;
    rememberResponsesFocus(projectId, { column, showLineage });
    setOpen(false);
    router.push(`/flow/p/${projectId}/responses`);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          className={className || 'tables-chip-label'}
          onClick={event => event.stopPropagation()}
        >
          {children || label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={8} className="variable-preview-popover">
        <VariablePreviewCard
          label={label}
          kind={resolvedKind || kind || ''}
          fileNote={fileNote}
          bars={bars}
          usedByCount={usedByCount}
          onOpenInResponses={projectId ? () => goResponses(false) : undefined}
          onUsedIn={projectId ? () => goResponses(true) : undefined}
        />
      </PopoverContent>
    </Popover>
  );
}
