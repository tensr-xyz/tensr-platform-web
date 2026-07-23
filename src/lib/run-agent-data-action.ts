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
    kind?: string;
    x_label?: string;
    y_label?: string;
    series?: Array<{ name?: string; x?: string[]; y?: number[]; values?: number[] }>;
    categories?: string[];
  };
  error?: string;
  repair?: {
    reason?: string;
    suggested_columns?: string[];
    suggested_spec?: Record<string, unknown> | null;
  };
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

const WORD_N = 'one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty';

export function shouldRouteMessageToDataIntent(message: string): boolean {
  const text = message.trim();
  if (!text) return false;
  return (
    /\b(how many|count|number of|total rows?|row count)\b/i.test(text) ||
    /\b(filter|show only|where|rows with|participants who)\b/i.test(text) ||
    /\b(players?|rows?|records?)\s+with\b/i.test(text) ||
    /\b(more than|less than|greater than|at least|over|under)\s+\d+/i.test(text) ||
    /[A-Za-z_][A-Za-z0-9_]*\s*(>=|<=|>|<)\s*-?\d+/i.test(text) ||
    /\b(sum|total|average|mean|median)\b/i.test(text) ||
    /\b(difference between|compare .* (revenue|total|sales|amount))\b/i.test(text) ||
    /\b(chart|graph|plot|histogram|bar chart|line chart|line graph)\b/i.test(text) ||
    /\b(make a|create a|draw a).*(chart|graph|plot)\b/i.test(text) ||
    new RegExp(
      String.raw`\b(top|bottom)\s+(\d+|${WORD_N})\b|\b(highest|lowest|most|least|best|worst|scorers?|leaders?)\b`,
      'i'
    ).test(text) ||
    /\b(show|list|get|give)\s+(me\s+)?.+\s+for\s+(the\s+)?(top|bottom|highest|lowest)\b/i.test(
      text
    ) ||
    // Name / value lookup: "PF for LeBron", "what's LeBron's PTS"
    /\b[A-Za-z_][A-Za-z0-9_]*\s+for\s+[A-Z][\w.'-]+/i.test(text) ||
    /\bwhat(?:'s| is)\s+.+'s\s+[A-Za-z0-9_]+/i.test(text)
  );
}
