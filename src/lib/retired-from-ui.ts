import { ANALYSIS_LABELS, type AnalysisKey } from '@/lib/analysis-definitions';

/**
 * Analysis ops that still exist on tensr-api but must not be launched from the
 * workspace (broken wizard or removed false door).
 * Saved reports can still open; new runs and setup wizards cannot.
 */
export const RETIRED_FROM_UI_OPS = new Set<AnalysisKey>([
  'stepwise_regression',
  'loglinear',
  'mcnemar',
  'code_open_text',
]);

export function isRetiredFromUi(op: string | null | undefined): op is AnalysisKey {
  return !!op && RETIRED_FROM_UI_OPS.has(op as AnalysisKey);
}

export function retiredFromUiLabel(op: string): string {
  return ANALYSIS_LABELS[op as AnalysisKey] || op.replace(/_/g, ' ');
}

export function retiredFromUiUserMessage(op: string): string {
  const label = retiredFromUiLabel(op);
  return `${label} is no longer offered in the workspace. Saved reports still open; new runs cannot be started from the menu, search, or the agent.`;
}
