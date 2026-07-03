'use client';

import * as React from 'react';
import type { SchemaColumn } from '@/lib/analysis-report-types';
import { cn } from '@/utils';
import { Button } from '@/components/atoms/button';

type Slot = {
  id: string;
  label: string;
  children: React.ReactNode;
};

type Props = {
  variables: SchemaColumn[];
  slots: Slot[];
  onReset?: () => void;
  statisticsDialog?: React.ReactNode;
  optionsDialog?: React.ReactNode;
  className?: string;
};

export function SpssDialogLayout({
  variables,
  slots,
  onReset,
  statisticsDialog,
  optionsDialog,
  className,
}: Props) {
  return (
    <div className={cn('flex min-h-[280px] flex-col gap-3', className)}>
      <div className="flex min-h-0 flex-1 gap-3">
        <aside className="w-[38%] shrink-0 overflow-hidden rounded-md border border-border bg-muted/20">
          <p className="border-b border-border px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Variables
          </p>
          <ul className="max-h-[320px] overflow-y-auto p-1 text-xs">
            {variables.map(v => (
              <li
                key={v.name}
                className="cursor-default rounded px-2 py-1 hover:bg-muted/60"
                title={v.name}
              >
                <span className="font-medium">{v.label || v.name}</span>
                {v.label ? (
                  <span className="ml-1 text-[10px] text-muted-foreground">({v.name})</span>
                ) : null}
                {v.measure ? (
                  <span className="ml-1 rounded bg-primary/10 px-1 text-[9px] text-primary">
                    {v.measure}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto">
          {slots.map(slot => (
            <div key={slot.id} className="rounded-md border border-border p-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {slot.label}
              </p>
              {slot.children}
            </div>
          ))}
        </div>
      </div>
      {(statisticsDialog || optionsDialog) && (
        <div className="flex flex-wrap gap-2 border-t border-border pt-2">
          {statisticsDialog}
          {optionsDialog}
        </div>
      )}
      {onReset ? (
        <div className="hidden">
          <Button type="button" variant="ghost" size="sm" onClick={onReset}>
            Reset
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** Missing value handling — SPSS Options sub-dialog content */
export function MissingValuesOptions({
  value,
  onChange,
}: {
  value: 'listwise' | 'pairwise';
  onChange: (v: 'listwise' | 'pairwise') => void;
}) {
  return (
    <div className="space-y-2 text-xs">
      <p className="font-medium">Missing values</p>
      <label className="flex items-center gap-2">
        <input type="radio" checked={value === 'listwise'} onChange={() => onChange('listwise')} />
        Exclude cases listwise
      </label>
      <label className="flex items-center gap-2">
        <input type="radio" checked={value === 'pairwise'} onChange={() => onChange('pairwise')} />
        Exclude cases analysis by analysis (pairwise)
      </label>
    </div>
  );
}
