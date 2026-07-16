import { apiClient } from '@/lib/api-client';
import type { ParseIntentResult } from '@/lib/run-agent-analysis-plan';
import type { AgentDataAction, ChatPendingAction } from '@/lib/chat-pending-action';

export type ExecuteActionResult = {
  ok: boolean;
  action_type: string;
  answer_markdown: string;
  answer_summary?: string;
  filters?: Array<{ columnId: string; operator: string; value: unknown }>;
  matched_rows?: number;
  total_rows?: number;
  requires_confirm?: boolean;
  apply_to_ui?: boolean;
  chart?: {
    id?: string;
    title?: string;
    chart_type?: string;
    x_label?: string;
    y_label?: string;
    series?: Array<{ name?: string; x?: string[]; y?: number[] }>;
  };
  error?: string;
};

export function isDataActionIntent(intent: ParseIntentResult): boolean {
  return intent.intent_kind === 'action' || Boolean(intent.action_type && intent.status === 'plan');
}

export function dataActionFromIntent(intent: ParseIntentResult): AgentDataAction | null {
  if (!intent.action_type) return null;
  return {
    actionType: intent.action_type,
    spec: intent.action_spec ?? {},
    rationale: intent.interpretation,
    autoExecute: Boolean(intent.auto_execute),
  };
}

export async function executeDataActionForDataset(
  datasetId: string,
  action: AgentDataAction
): Promise<ExecuteActionResult> {
  return apiClient.assistant.executeAction({
    datasetId,
    actionType: action.actionType,
    actionSpec: action.spec,
  });
}

/** Filter preview → pending confirm to apply filters to the sheet. */
export function pendingFilterApplyFromResult(
  action: AgentDataAction,
  result: ExecuteActionResult
): ChatPendingAction | undefined {
  const filters = result.filters ?? [];
  if (!filters.length) return undefined;
  if (action.actionType !== 'filter_preview' && action.actionType !== 'filter_apply') {
    return undefined;
  }
  return {
    kind: 'data_action',
    status: 'pending',
    action: {
      actionType: 'filter_apply',
      spec: { ...action.spec, filters },
      rationale: result.answer_summary || action.rationale,
      autoExecute: false,
    },
  };
}

export function shouldRouteMessageToDataIntent(message: string): boolean {
  const text = message.trim();
  if (!text) return false;
  return (
    /\b(how many|count|number of|total rows?|row count)\b/i.test(text) ||
    /\b(filter|show only|where|rows with|participants who)\b/i.test(text) ||
    /\b(sum|total|average|mean|median)\b/i.test(text) ||
    /\b(difference between|compare .* (revenue|total|sales|amount))\b/i.test(text) ||
    /\b(chart|graph|plot|histogram|bar chart|line chart|line graph)\b/i.test(text) ||
    /\b(make a|create a|draw a).*(chart|graph|plot)\b/i.test(text)
  );
}
