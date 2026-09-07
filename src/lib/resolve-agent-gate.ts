/**
 * Pure replica of agent-panel `handleSendMessage` gate order for offline eval.
 *
 * Chat always POSTs /assistant/agent-loop (no menu/dialog steal). Order:
 *   1. Prep playbook
 *   2. Data-intent
 *   3. Exploratory suggestions
 *   4. Analysis-question
 *   5. Data-quality scan (requires hasActiveTabData)
 *   Fallback: tutor
 *
 * Baseline eval assumes a dataset is open (datasetIdForIntent present), matching
 * the typical workspace session used in usability probes.
 */

import { shouldSuggestExploratoryAnalyses } from '@/lib/agent-exploratory-intent';
import { shouldRouteToInlineChart } from '@/lib/chart-intent';
import { isPrepPlaybookTrigger } from '@/lib/prep-playbook';
import { shouldRouteMessageToDataIntent } from '@/lib/run-agent-data-action';

/** Labels used by the offline routing eval corpus. */
export type AgentGateLabel =
  | 'prep-playbook'
  | 'data-intent'
  | 'exploratory'
  | 'analysis-question'
  | 'data-quality'
  | 'tutor';

export type ResolveAgentGateOptions = {
  /** Mirrors `datasetIdForIntent` truthiness. Default true for baseline. */
  hasDatasetId?: boolean;
  /** Mirrors `activeTab?.data` for Gate 5. Default true for baseline. */
  hasActiveTabData?: boolean;
};

const ANALYSIS_QUESTION_RE =
  /(predict|analyze|analys|relationship|correlation|regression|anova|compare|difference|effect|impact|test|wilcoxon|mann|kruskal|chi|crosstab|pca|cluster|factor|reliability|normality|shapiro|sign test|mcnemar|probit|logistic|poisson|ttest|t-test|kappa|cohen|spearman|kendall|canonical|discriminant|manova|ancova|glmm|mixed model|survival|kaplan|cox|arima)/i;

const DATA_QUALITY_RE =
  /(data quality|quality scan|check data|data issues|scan data|data problems)/i;

/**
 * Resolve which handleSendMessage branch would own this message.
 * Does not call the network; exploratory/analysis "would call API" is still labeled.
 */
export function resolveGateInOrder(
  message: string,
  options: ResolveAgentGateOptions = {}
): AgentGateLabel {
  const text = (message || '').trim();
  if (!text) return 'tutor';

  const hasDatasetId = options.hasDatasetId !== false;
  const hasActiveTabData = options.hasActiveTabData !== false;
  const inlineChart = shouldRouteToInlineChart(text);

  // Gate 1 — prep playbook
  if (hasDatasetId && isPrepPlaybookTrigger(text)) return 'prep-playbook';

  // Gate 2 — data-intent
  if (hasDatasetId && shouldRouteMessageToDataIntent(text)) return 'data-intent';

  // Gate 3 — exploratory
  if (hasDatasetId && !inlineChart && shouldSuggestExploratoryAnalyses(text)) {
    return 'exploratory';
  }

  // Gate 4 — analysis-question (follow-up helpers omitted: no thread in baseline)
  if (hasDatasetId && !inlineChart && ANALYSIS_QUESTION_RE.test(text)) {
    return 'analysis-question';
  }

  // Gate 5 — data-quality (requires activeTab.data specifically)
  if (DATA_QUALITY_RE.test(text) && hasActiveTabData) return 'data-quality';

  return 'tutor';
}
