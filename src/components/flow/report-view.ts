/** Report tab sub-views: Slides (editor), Overview (brief + deliverables), Outputs. */

export type ReportView = 'slides' | 'overview' | 'outputs';

export const REPORT_VIEW_OPTIONS: { value: ReportView; label: string }[] = [
  { value: 'slides', label: 'Slides' },
  { value: 'overview', label: 'Overview' },
  { value: 'outputs', label: 'Outputs' },
];

/**
 * Overview (Paper 6a) paints Deliverables immediately. Key findings keep a
 * separate skeleton until `/overview` returns — never blank the whole page.
 */
export const REPORT_OVERVIEW_BOOT = {
  phase: 'ready' as const,
  findingsPhase: 'loading' as const,
};

const STORAGE_PREFIX = 'tensr-report-view:';

export function reportViewStorageKey(projectId: string): string {
  return `${STORAGE_PREFIX}${projectId}`;
}

/** Map URL `pane` (legacy `report` → overview) to a view. */
export function reportViewFromPaneParam(pane: string | null): ReportView | null {
  if (pane === 'outputs') return 'outputs';
  if (pane === 'slides') return 'slides';
  if (pane === 'overview' || pane === 'report') return 'overview';
  return null;
}

export function readStoredReportView(projectId: string): ReportView | null {
  if (typeof window === 'undefined' || !projectId) return null;
  try {
    const raw = window.localStorage.getItem(reportViewStorageKey(projectId));
    if (raw === 'slides' || raw === 'overview' || raw === 'outputs') return raw;
  } catch {
    /* private mode */
  }
  return null;
}

/** Persist only a view the user picked on the Slides | Overview | Outputs switcher. */
export function writeStoredReportView(projectId: string, view: ReportView): void {
  if (typeof window === 'undefined' || !projectId) return;
  try {
    window.localStorage.setItem(reportViewStorageKey(projectId), view);
  } catch {
    /* private mode */
  }
}

/**
 * URL pane wins (deep link from chat / Open / Add to report).
 * Otherwise the last switcher choice for this project, else Overview.
 */
export function initialReportView(projectId: string, paneParam: string | null): ReportView {
  return reportViewFromPaneParam(paneParam) || readStoredReportView(projectId) || 'overview';
}

/** Report URL for a specific view (and optional output run to select). */
export function reportViewHref(
  projectHref: string,
  view: ReportView,
  runId?: string | null
): string {
  const base = `${projectHref}/report?pane=${view}`;
  if (view === 'outputs' && runId) {
    return `${base}&run=${encodeURIComponent(runId)}`;
  }
  return base;
}
