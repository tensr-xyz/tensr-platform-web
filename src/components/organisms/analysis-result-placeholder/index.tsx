'use client';

import React from 'react';
import { BarChart2, Loader2 } from 'lucide-react';

type Props = {
  title: string;
  analysisOp?: string;
  parameters?: Record<string, unknown>;
  sourceDatasetId?: string;
};

export function AnalysisResultPlaceholder({
  title,
  analysisOp,
  parameters = {},
  sourceDatasetId,
}: Props) {
  const paramEntries = Object.entries(parameters).filter(
    ([, v]) => v !== undefined && v !== null && v !== ''
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-muted/15">
      <div className="shrink-0 border-b border-border bg-background px-6 py-4">
        <div className="flex items-center gap-2">
          <BarChart2 className="size-4 text-primary" aria-hidden />
          <h1 className="text-base font-medium text-foreground">{title}</h1>
        </div>
        {analysisOp ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Analysis: <span className="font-mono text-foreground/80">{analysisOp}</span>
            {sourceDatasetId ? (
              <>
                {' '}
                · Dataset <span className="font-mono">{sourceDatasetId.slice(0, 8)}…</span>
              </>
            ) : null}
          </p>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-8 py-12">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="size-5 animate-spin text-primary" aria-hidden />
          <span className="text-sm font-medium text-foreground">Results loading</span>
        </div>
        <p className="max-w-md text-center text-xs leading-relaxed text-muted-foreground">
          The full analysis report view will render here. This tab is pinned to your run so you can
          return when results are ready.
        </p>

        {paramEntries.length > 0 ? (
          <div className="w-full max-w-lg rounded-lg border border-border bg-card p-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Parameters
            </p>
            <dl className="grid gap-1.5 text-xs">
              {paramEntries.map(([key, value]) => (
                <div key={key} className="flex gap-2">
                  <dt className="shrink-0 font-mono text-muted-foreground">{key}</dt>
                  <dd className="min-w-0 truncate text-foreground">
                    {Array.isArray(value) ? value.join(', ') : String(value)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
      </div>
    </div>
  );
}
