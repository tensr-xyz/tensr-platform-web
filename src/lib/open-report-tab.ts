import { useTabsStore, ViewType } from '@/stores/tabs-store';

export type OpenReportOutcome =
  | { ok: true; alreadyOpen: boolean; reportMissing: boolean }
  | { ok: false; reason: 'missing_tab' };

/** Switch to a report tab. A missing tab is a failure, not a silent no-op. */
export function openReportTab(tabId: string): OpenReportOutcome {
  const trimmed = tabId.trim();
  if (!trimmed) return { ok: false, reason: 'missing_tab' };
  const { tabs, activeTabId, setActiveTab } = useTabsStore.getState();
  const tab = tabs.find(item => item.id === trimmed);
  if (!tab) return { ok: false, reason: 'missing_tab' };
  const reportMissing =
    (tab.type === ViewType.ANALYSIS_RESULT || tab.type === ViewType.ANALYSIS_REPORT) &&
    !tab.data?.analysisReport;
  setActiveTab(trimmed);
  return { ok: true, alreadyOpen: activeTabId === trimmed, reportMissing };
}
