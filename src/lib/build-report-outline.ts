import type { AnalysisReport } from '@/lib/analysis-report-types';

export type ReportOutlineItem = {
  id: string;
  label: string;
  badge?: string;
  badgeClassName?: string;
};

export function buildReportOutline(report: AnalysisReport): ReportOutlineItem[] {
  const items: ReportOutlineItem[] = [];

  if (report.trust.warnings.length > 0) {
    items.push({
      id: 'warnings',
      label: 'Warnings',
      badge: String(report.trust.warnings.length),
      badgeClassName: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    });
  }

  if (report.summary) {
    items.push({ id: 'interpretation', label: 'Interpretation' });
  }

  if (report.metrics.length > 0) {
    items.push({ id: 'metrics', label: 'Key metrics' });
  }

  if (report.chart) {
    items.push({
      id: 'chart',
      label: report.chart.title || 'Chart',
    });
  }

  report.tables.forEach((t, i) => {
    items.push({
      id: `table-${t.id}`,
      label: i === 0 ? 'Primary result' : t.title,
    });
    if (t.interpretation) {
      items.push({
        id: `table-${t.id}-interpretation`,
        label: `${t.title} interpretation`,
      });
    }
  });

  if (report.assumption_checks?.warnings?.length) {
    items.push({
      id: 'assumptions',
      label: 'Assumption checks',
      badge: 'Review',
      badgeClassName: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    });
  }

  return items;
}

export function scrollToReportSection(sectionId: string) {
  const el = document.getElementById(`report-section-${sectionId}`);
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
