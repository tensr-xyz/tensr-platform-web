import type { AnalysisReport } from '@/lib/analysis-report-types';

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

export function attachApproachToReport(
  report: AnalysisReport | null | undefined,
  opts: { plan?: string | null; whyThisTest?: string | null }
): AnalysisReport | null | undefined {
  if (!report) return report;
  const plan = (opts.plan || '').trim();
  const why = (opts.whyThisTest || '').trim();
  if (!plan && !why) return report;
  if (report.approach?.plan || report.approach?.why_this_test) {
    return report;
  }
  return {
    ...report,
    approach: {
      ...(plan ? { plan } : {}),
      ...(why ? { why_this_test: why } : {}),
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
