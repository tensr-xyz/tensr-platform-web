import { apiClient } from '@/lib/api-client';
import { ApiRequestError } from '@/lib/api-error';
import type { AgentConversationTurn } from '@/lib/agent-conversation-history';
import type { AnalysisReport } from '@/lib/analysis-report-types';
import { formatAnalysisReportForAgentChat } from '@/lib/format-agent-analysis-report';
import type { AgentAnalysisPlan, ChatPendingAction } from '@/lib/chat-pending-action';
import type { AnalyzeResponse } from '@/lib/analysis-report-types';
import { openAnalysisResultTab } from '@/lib/open-analysis-result-tab';
import type { AnalysisKey } from '@/lib/analysis-definitions';
import { isAnalysisKey } from '@/lib/analysis-definitions';
import { interpretProgressMessage } from '@/lib/agent-analysis-progress';
import { streamAgentAnalysisRun } from '@/lib/stream-agent-analysis';
import { resolveChatAction } from '@/lib/chat-actions';

export type ParseIntentResult = {
  status: string;
  interpretation: string;
  analysis_type?: string | null;
  request_body?: Record<string, unknown> | null;
  plan_summary?: string | null;
  clarification_questions?: string[];
  validation_errors?: string[];
  reason_if_unsupported?: string | null;
  intent_kind?: 'analysis' | 'action' | null;
  action_type?: string | null;
  action_spec?: Record<string, unknown> | null;
  auto_execute?: boolean;
};

export type ParseIntentAssistantUpdate =
  | { type: 'plan'; content: string; plan: AgentAnalysisPlan; autoExecute?: boolean }
  | {
      type: 'action';
      content: string;
      action: import('@/lib/chat-pending-action').AgentDataAction;
    }
  | { type: 'clarification'; content: string }
  | { type: 'unsupported'; content: string }
  | {
      type: 'no_plan';
      content: string;
      menuOverride?: { op: AnalysisKey; menuName: string };
    };

const RETRYABLE_ASSISTANT_STATUSES = new Set([502, 503, 504]);

export async function parseIntentForDataset(
  datasetId: string,
  message: string,
  conversationHistory?: AgentConversationTurn[],
  glossary?: string | null
): Promise<ParseIntentResult> {
  const maxAttempts = 3;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await apiClient.assistant.parseIntent({
        datasetId,
        message,
        conversationHistory,
        glossary: glossary ?? null,
      });
    } catch (error) {
      lastError = error;
      const status = error instanceof ApiRequestError ? error.status : 0;
      if (RETRYABLE_ASSISTANT_STATUSES.has(status) && attempt < maxAttempts - 1) {
        await new Promise<void>(resolve => {
          window.setTimeout(resolve, 1200 * (attempt + 1));
        });
        continue;
      }
      throw error;
    }
  }

  throw lastError;
}

export function assistantUpdateFromParseIntent(
  intent: ParseIntentResult,
  menuName: string,
  triggerMessage?: string
): ParseIntentAssistantUpdate {
  if (intent.status === 'plan' && (intent.intent_kind === 'action' || intent.action_type)) {
    if (intent.action_type) {
      return {
        type: 'action',
        content: intent.interpretation || `I'll run **${intent.action_type.replace(/_/g, ' ')}**.`,
        action: {
          actionType: intent.action_type,
          spec: intent.action_spec ?? {},
          rationale: intent.interpretation,
          autoExecute: Boolean(intent.auto_execute),
        },
      };
    }
  }

  if (intent.status === 'plan') {
    const plan = planFromParseIntent(intent);
    if (plan) {
      return {
        type: 'plan',
        content: intent.interpretation || `**${menuName}**`,
        plan,
        autoExecute: Boolean(intent.auto_execute),
      };
    }
  }

  if (intent.status === 'clarification' || intent.status === 'validation_failed') {
    const qs = intent.clarification_questions?.length
      ? intent.clarification_questions
      : intent.validation_errors;
    return {
      type: 'clarification',
      content: `${intent.interpretation}\n\n${(qs ?? []).map(q => `- ${q}`).join('\n')}`,
    };
  }

  if (intent.status === 'unsupported') {
    if (triggerMessage?.trim()) {
      const fallbackAction = resolveChatAction(triggerMessage);
      if (fallbackAction.kind === 'analysis') {
        return {
          type: 'no_plan',
          content: `I'll set up **${fallbackAction.menuName}** for your request.`,
          menuOverride: { op: fallbackAction.op, menuName: fallbackAction.menuName },
        };
      }
    }
    return {
      type: 'unsupported',
      content:
        intent.interpretation ||
        intent.reason_if_unsupported ||
        'That analysis is not supported yet. Try the Analyze menu or rephrase.',
    };
  }

  return {
    type: 'no_plan',
    content: intent.interpretation || `**${menuName}**`,
  };
}

export function menuFallbackFromParseUpdate(
  update: ParseIntentAssistantUpdate,
  menuFallback: { op: AnalysisKey; menuName: string; triggerMessage: string }
): { op: AnalysisKey; menuName: string; triggerMessage: string } {
  if (update.type === 'no_plan' && update.menuOverride) {
    return { ...menuFallback, ...update.menuOverride };
  }
  return menuFallback;
}

export function pendingActionFromParseIntentUpdate(
  update: ParseIntentAssistantUpdate,
  menuFallback: { op: AnalysisKey; menuName: string; triggerMessage: string }
): ChatPendingAction | undefined {
  if (update.type === 'plan') {
    // Explicit unambiguous analyses auto-run; skip the approval card.
    if (update.autoExecute) {
      return undefined;
    }
    return { kind: 'analysis_plan', status: 'pending', plan: update.plan };
  }
  if (update.type === 'action') {
    // Read actions auto-execute in the panel; filter preview becomes confirm-to-apply.
    if (update.action.autoExecute && update.action.actionType !== 'filter_preview') {
      return undefined;
    }
    return { kind: 'data_action', status: 'pending', action: update.action };
  }
  if (update.type === 'no_plan') {
    const fb = menuFallbackFromParseUpdate(update, menuFallback);
    return { kind: 'analysis_menu', status: 'pending', ...fb };
  }
  return undefined;
}

export async function runAgentAnalysisPlan(
  datasetId: string,
  plan: AgentAnalysisPlan,
  handlers?: {
    onProgress?: (step: string, message: string) => void;
    signal?: AbortSignal;
  }
): Promise<Record<string, unknown> | undefined> {
  const spec = plan.spec;
  const op = plan.analysisType;

  const resolvedOp = isAnalysisKey(op)
    ? op
    : op === 'regression'
      ? 'linear_regression'
      : op === 'anova'
        ? 'anova_oneway'
        : op === 'correlations'
          ? 'correlation'
          : op;

  const resolvedSpec =
    op === 'regression'
      ? {
          dependent: spec.dependent as string,
          independents: (spec.predictors as string[] | undefined) ?? [],
        }
      : op === 'anova'
        ? {
            group_column:
              (spec.independent as string) || (spec.groups as string[] | undefined)?.[0],
            value_column: spec.dependent as string,
          }
        : op === 'correlations'
          ? {
              columns:
                (spec.variables as string[] | undefined) ??
                (spec.predictors as string[] | undefined) ??
                [],
            }
          : spec;

  if (
    !isAnalysisKey(resolvedOp) &&
    op !== 'regression' &&
    op !== 'anova' &&
    op !== 'correlations'
  ) {
    return undefined;
  }

  const emit = (step: string, message: string) => {
    handlers?.onProgress?.(step, message);
  };

  try {
    emit('validating', interpretProgressMessage(plan, 'validating'));

    return await streamAgentAnalysisRun(datasetId, resolvedOp, resolvedSpec, {
      onProgress: ({ step, message }) => {
        emit(step, interpretProgressMessage(plan, step, message));
      },
      signal: handlers?.signal,
    });
  } catch (streamError) {
    const status = streamError instanceof ApiRequestError ? streamError.status : 0;
    const streamUnavailable = status === 404 || status === 405;
    if (!streamUnavailable) {
      throw streamError;
    }

    emit('validating', interpretProgressMessage(plan, 'validating'));
    emit('running', interpretProgressMessage(plan, 'running'));
    const envelope = await apiClient.datasets.analyze.run(datasetId, resolvedOp, resolvedSpec);
    emit('building', interpretProgressMessage(plan, 'building'));
    return envelope;
  }
}

export function analysisResultMarkdown(analysisResult: Record<string, unknown> | undefined): {
  markdown: string;
  summary: string;
} {
  const report = analysisResult?.report as AnalysisReport | undefined;
  if (!report) {
    const fallback = 'Analysis completed. Open the results tab for the full report.';
    return { markdown: fallback, summary: fallback };
  }

  const summary = report.summary || 'Analysis completed.';
  return {
    markdown: formatAnalysisReportForAgentChat(report),
    summary,
  };
}

export const AGENT_OP_MAP: Record<string, string> = {
  regression: 'linear_regression',
  anova: 'anova_oneway',
  correlations: 'correlation',
};

export function openResultTabForPlan(
  plan: AgentAnalysisPlan,
  analysisResult: Record<string, unknown>,
  datasetId: string,
  sourceTabName: string | undefined,
  spec: Record<string, unknown>
) {
  const op = isAnalysisKey(plan.analysisType)
    ? plan.analysisType
    : (AGENT_OP_MAP[plan.analysisType] ?? plan.analysisType);
  openAnalysisResultTab({
    op,
    envelope: analysisResult as AnalyzeResponse,
    parameters: spec,
    sourceDatasetId: datasetId,
    sourceTabName,
  });
}

export function planFromParseIntent(res: ParseIntentResult): AgentAnalysisPlan | null {
  if (res.status !== 'plan' || !res.analysis_type || !res.request_body) {
    return null;
  }
  return {
    analysisType: res.analysis_type,
    spec: res.request_body,
    rationale: res.interpretation,
  };
}

export type SuggestAnalysisResult = {
  analysis_type: string;
  rationale: string;
  request_body: Record<string, unknown>;
};

export async function fetchExploratorySuggestions(
  datasetId: string,
  conversationHistory?: AgentConversationTurn[]
): Promise<SuggestAnalysisResult[]> {
  const res = await apiClient.assistant.suggestAnalyses({
    datasetId,
    conversationHistory,
  });
  return res.suggestions ?? [];
}

export function suggestionToPlan(item: SuggestAnalysisResult): AgentAnalysisPlan {
  return {
    analysisType: item.analysis_type,
    spec: item.request_body,
    rationale: item.rationale,
  };
}

export {
  suggestFollowUpPlans,
  suggestFollowUpPlan,
  resetFollowUpSuggestionDedup,
} from '@/lib/suggest-follow-up-plan';
export type { SuggestedFollowUp } from '@/lib/suggest-follow-up-plan';
