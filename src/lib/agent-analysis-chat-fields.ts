import type { AnalysisReport } from '@/lib/analysis-report-types';

/** Short chat stand-in once the full report is open in its own tab. */
export type AnalysisReportChatCard = {
  tabId: string;
  title: string;
  summary: string;
};

export function reportCardForOpenedTab(opts: {
  tabId: string | null | undefined;
  title?: string | null;
  summary?: string | null;
}): AnalysisReportChatCard | null {
  const tabId = opts.tabId?.trim();
  if (!tabId) return null;
  return {
    tabId,
    title: (opts.title || 'Analysis report').trim() || 'Analysis report',
    summary:
      (opts.summary || 'Open the report tab for the full table.').trim() ||
      'Open the report tab for the full table.',
  };
}

/** Build chat fields after a successful run_analysis so Plan and report don't double-render. */
export function chatFieldsAfterRunAnalysis(opts: {
  /** Pre-Approve message body (Plan / Why markdown). */
  priorContent: string;
  planSummary?: string | null;
  whyThisTest?: string | null;
  reportMarkdown: string;
}): { content: string; resultMarkdown: string } {
  const reportMarkdown = opts.reportMarkdown.trim();
  const prior = opts.priorContent.trim();
  const planBits = [
    opts.planSummary?.trim() ? `**Plan:** ${opts.planSummary.trim()}` : '',
    opts.whyThisTest?.trim() ? `**Why this test:** ${opts.whyThisTest.trim()}` : '',
  ].filter(Boolean);
  const rebuiltPlan = planBits.join('\n\n');
  // Prefer structured Plan/Why over the awaiting-approval stub ("Paused for approval: …")
  // or answer_markdown that is only why_this_test.
  const priorIsApprovalStub = /^paused for approval:/i.test(prior);
  const priorIsWhyOnly =
    Boolean(opts.whyThisTest?.trim()) &&
    prior.replace(/\s+/g, ' ').trim().toLowerCase() ===
      opts.whyThisTest!.trim().replace(/\s+/g, ' ').toLowerCase();
  const planContent =
    rebuiltPlan && (priorIsApprovalStub || priorIsWhyOnly || !prior)
      ? rebuiltPlan
      : prior || rebuiltPlan;

  // ChatMessageBody renders BOTH content and resultMarkdown. If they match, the
  // full report appears twice. Keep plan in content; report only in resultMarkdown.
  if (planContent && planContent === reportMarkdown) {
    return { content: '', resultMarkdown: reportMarkdown };
  }
  return {
    content: planContent,
    resultMarkdown: reportMarkdown,
  };
}

/** Prefer Plan text that still carries exploration / rejected-alternative prose. */
export function preferRicherPlan(a?: string | null, b?: string | null): string {
  const x = (a || '').trim();
  const y = (b || '').trim();
  if (!x) return y;
  if (!y) return x;
  const score = (s: string) =>
    (/Exploration step/i.test(s) ? 4 : 0) + (/Rejected/i.test(s) ? 2 : 0) + s.length / 1000;
  return score(x) >= score(y) ? x : y;
}

type PriorApprovalPlan = {
  rationale?: string;
  whyThisTest?: string;
  pipelineSteps?: Array<{
    name: string;
    args: Record<string, unknown>;
    rationale?: string;
    why_this_test?: string;
  }>;
};

/**
 * The approved plan text for one run_analysis result. A multi-step approval
 * keeps step 1's rationale on the pending action, so each result takes the
 * text of its own pipeline step (nth step of the same analysis_type).
 */
export function priorPlanForResult(
  prior: PriorApprovalPlan | null | undefined,
  analysisType: string,
  occurrence = 0
): { plan: string | null; whyThisTest: string | null } {
  if (!prior) return { plan: null, whyThisTest: null };
  const steps = prior.pipelineSteps ?? [];
  if (steps.length > 0) {
    const step = steps.filter(
      s => s.name === 'run_analysis' && String(s.args?.analysis_type ?? '') === analysisType
    )[occurrence];
    return {
      plan: step?.rationale?.trim() || null,
      whyThisTest: step?.why_this_test?.trim() || null,
    };
  }
  return {
    plan: prior.rationale?.trim() || null,
    whyThisTest: prior.whyThisTest?.trim() || null,
  };
}

export function attachApproachToReport(
  report: AnalysisReport | null | undefined,
  opts: {
    plan?: string | null;
    whyThisTest?: string | null;
    exploration?: string | null;
    rejectedAlternative?: string | null;
    /** Raw tool trace; shown only under "Show technical details". */
    trace?: string | null;
  }
): AnalysisReport | null | undefined {
  if (!report) return report;
  const existing = report.approach || {};
  const plan = preferRicherPlan(opts.plan, existing.plan);
  const why = (opts.whyThisTest || existing.why_this_test || '').trim();
  const exploration = (opts.exploration || existing.exploration || '').trim();
  const rejected = (opts.rejectedAlternative || existing.rejected_alternative || '').trim();
  const trace = (report.session_trace || opts.trace || '').trim();
  if (!plan && !why && !exploration && !rejected && !trace) return report;
  return {
    ...report,
    ...(trace ? { session_trace: trace } : {}),
    approach: {
      ...existing,
      ...(plan ? { plan } : {}),
      ...(why ? { why_this_test: why } : {}),
      ...(exploration ? { exploration } : {}),
      ...(rejected ? { rejected_alternative: rejected } : {}),
    },
  };
}

/** Dev-only: log exactly what the chat pane will render (dupe detection). */
export function logAgentChatRenderPayload(payload: {
  content: string;
  resultMarkdown: string;
}): void {
  if (process.env.NODE_ENV === 'production') return;
  const content = payload.content.trim();
  const result = payload.resultMarkdown.trim();
  // eslint-disable-next-line no-console
  console.debug('[agent-chat-render]', {
    contentChars: content.length,
    resultChars: result.length,
    contentEqualsResult: Boolean(content && result && content === result),
    contentPreview: content.slice(0, 120),
    resultPreview: result.slice(0, 120),
  });
}
