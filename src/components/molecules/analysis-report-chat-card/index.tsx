'use client';

import { useState } from 'react';

type Props = {
  title: string;
  summary: string;
  /** Return a sentence when the click cannot open a new view. */
  onOpen: () => string | void | Promise<string | void>;
};

/** Chat stand-in for a report that already opened in its own tab. */
export function AnalysisReportChatCard({ title, summary, onOpen }: Props) {
  const [notice, setNotice] = useState<string | null>(null);
  return (
    <div
      data-testid="analysis-report-summary-card"
      className="mt-2 rounded-lg border border-border bg-card px-3 py-2.5"
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <p className="mt-1 text-sm leading-snug text-foreground">{summary}</p>
      <button
        type="button"
        data-testid="analysis-report-open-tab"
        className="mt-2 text-sm font-medium text-primary hover:underline"
        onClick={() => {
          const result = onOpen();
          if (result && typeof (result as Promise<string | void>).then === 'function') {
            void (result as Promise<string | void>).then(message => setNotice(message || null));
            return;
          }
          setNotice((result as string | void) || null);
        }}
      >
        Open report
      </button>
      {notice ? (
        <p role="status" className="mt-1 text-xs text-muted-foreground">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
