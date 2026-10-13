'use client';

type Props = {
  title: string;
  summary: string;
  onOpen: () => void;
};

/** Chat stand-in for a report that already opened in its own tab. */
export function AnalysisReportChatCard({ title, summary, onOpen }: Props) {
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
        onClick={onOpen}
      >
        Open report
      </button>
    </div>
  );
}
