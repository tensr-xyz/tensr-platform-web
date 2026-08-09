import type { AnalysisReport } from '@/lib/analysis-report-types';
import { ANALYSIS_LABELS, type AnalysisKey } from '@/lib/analysis-definitions';
import { formatAnalysisRunTabLabel } from '@/lib/open-analysis-result-tab';
import { useTabsStore, ViewType } from '@/stores/tabs-store';

export type AnalysisChainRelation = 'chained_diagnostic' | 'chained_from_primary';

export type AnalysisRelatedLink = {
  tabId: string;
  label: string;
  relation: AnalysisChainRelation;
  analysisFingerprint?: string;
  runId?: string;
};

export type OpenedAnalysisTab = {
  tabId: string;
  isEnrichment: boolean;
  label: string;
  fingerprint: string;
  runId?: string;
};

/** Human label for a results tab / See also link. */
export function analysisTabLabel(
  analysisType: string,
  requestBody: Record<string, unknown>
): string {
  return formatAnalysisRunTabLabel(analysisType, requestBody);
}

/** One-line chat note when a chained enrichment step finishes. */
export function enrichmentCompletionNote(
  analysisType: string,
  requestBody: Record<string, unknown>
): string {
  const label = analysisTabLabel(analysisType, requestBody);
  const kind =
    ANALYSIS_LABELS[analysisType as AnalysisKey] || analysisType.replace(/_/g, ' ').toLowerCase();
  const kindLower = kind.toLowerCase();
  if (analysisType === 'correlation' || kindLower.includes('correlation')) {
    return `Also ran a correlation diagnostic — see the **${label}** tab.`;
  }
  return `Also ran ${kindLower} — see the **${label}** tab.`;
}

export function relatedLinkDisplayLabel(link: AnalysisRelatedLink): string {
  if (link.relation === 'chained_diagnostic') {
    return `${link.label} (chained diagnostic)`;
  }
  return `${link.label} (primary analysis)`;
}

/** Wire primary ↔ enrichment tabs opened in the same agent-loop turn. */
export function wireAnalysisChainLinks(opened: OpenedAnalysisTab[]): void {
  const primaries = opened.filter(o => !o.isEnrichment && o.tabId);
  const enrichments = opened.filter(o => o.isEnrichment && o.tabId);
  if (!primaries.length || !enrichments.length) return;

  const patchRelated = (tabId: string, links: AnalysisRelatedLink[]) => {
    const { updateTab, tabs } = useTabsStore.getState();
    const tab = tabs.find(t => t.id === tabId);
    if (!tab?.data) return;
    const report = tab.data.analysisReport as AnalysisReport | undefined;
    const nextReport = report
      ? {
          ...report,
          related_analyses: links.map(
            ({ tabId: id, label, relation, analysisFingerprint, runId }) => ({
              tab_id: id,
              label,
              relation,
              analysis_fingerprint: analysisFingerprint,
              run_id: runId,
            })
          ),
        }
      : report;
    updateTab(tabId, {
      data: {
        ...tab.data,
        analysisRelated: links,
        ...(nextReport ? { analysisReport: nextReport } : {}),
      },
    });
  };

  for (const primary of primaries) {
    patchRelated(
      primary.tabId,
      enrichments.map(e => ({
        tabId: e.tabId,
        label: e.label,
        relation: 'chained_diagnostic' as const,
        analysisFingerprint: e.fingerprint,
        runId: e.runId,
      }))
    );
  }

  // Each enrichment points back at the first primary in this turn's batch.
  const primary = primaries[0];
  for (const enrich of enrichments) {
    patchRelated(enrich.tabId, [
      {
        tabId: primary.tabId,
        label: primary.label,
        relation: 'chained_from_primary',
        analysisFingerprint: primary.fingerprint,
        runId: primary.runId,
      },
    ]);
  }
}

/** Activate a related results tab by id, fingerprint, or run id. */
export function activateRelatedAnalysisTab(link: {
  tabId?: string;
  analysisFingerprint?: string;
  runId?: string;
  analysis_fingerprint?: string;
  run_id?: string;
}): boolean {
  const { tabs, setActiveTab } = useTabsStore.getState();
  const fingerprint = link.analysisFingerprint || link.analysis_fingerprint;
  const runId = link.runId || link.run_id;
  const hit =
    (link.tabId && tabs.find(t => t.id === link.tabId)) ||
    (fingerprint &&
      tabs.find(
        t => t.type === ViewType.ANALYSIS_RESULT && t.data?.analysisFingerprint === fingerprint
      )) ||
    (runId &&
      tabs.find(t => t.type === ViewType.ANALYSIS_RESULT && t.data?.analysisRunId === runId));
  if (!hit) return false;
  setActiveTab(hit.id);
  return true;
}

/** Resolve related links from tab data and/or report payload. */
export function relatedLinksFromReportAndTab(opts: {
  tabRelated?: AnalysisRelatedLink[] | null;
  report?: AnalysisReport | null;
}): AnalysisRelatedLink[] {
  if (opts.tabRelated?.length) return opts.tabRelated;
  const fromReport = opts.report?.related_analyses;
  if (!fromReport?.length) return [];
  return fromReport.map(r => ({
    tabId: r.tab_id || '',
    label: r.label,
    relation: r.relation,
    analysisFingerprint: r.analysis_fingerprint,
    runId: r.run_id,
  }));
}
