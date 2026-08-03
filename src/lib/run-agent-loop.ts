import { apiClient } from '@/lib/api-client';
import { chartFromAnalysisEnvelope } from '@/lib/agent-chart-from-dataset';
import type { AnalysisReportChart } from '@/lib/analysis-report-types';
import type { AgentMode } from '@/stores/agent-mode-store';
import type { Tab } from '@/stores/tabs-store';
import { getDatasetIdFromTab } from '@/lib/workspace-dataset';
import type {
  ChatPendingAction,
  PlaybookProposedAction,
  PrepPlaybookStep,
} from '@/lib/chat-pending-action';
import type { ChatMessage } from '@/stores/chat-store';

export type AgentLoopOpenDataset = {
  dataset_id: string;
  label?: string | null;
  filename?: string | null;
};

export type AgentLoopApprovedToolCall = {
  tool_call_id: string;
  name: string;
  args: Record<string, unknown>;
  rationale?: string;
  why_this_test?: string;
  confidence?: number;
};

export type AgentLoopToolResult = {
  name: string;
  args?: Record<string, unknown>;
  result?: Record<string, unknown>;
};

export type AgentLoopResponse = {
  status: 'ok' | 'clarification' | 'awaiting_approval' | 'error' | 'llm_unavailable' | string;
  mode: AgentMode;
  answer_markdown?: string;
  clarification_questions?: string[];
  pending_approvals?: AgentLoopApprovedToolCall[];
  pipeline?: boolean;
  approval_batch?: boolean;
  pipeline_halted?: boolean;
  failed_step_index?: number;
  reapprove_pipeline?: boolean;
  tool_trace?: Array<Record<string, unknown>>;
  tool_results?: AgentLoopToolResult[];
  tools_available?: string[];
  confidence?: number;
  step_limit_reached?: boolean;
  approved_execution?: boolean;
  provenance?: Record<string, unknown>;
};

export type RunAgentLoopParams = {
  message: string;
  mode: AgentMode;
  datasetId?: string | null;
  openDatasets?: AgentLoopOpenDataset[];
  conversationHistory?: Array<{ role: string; content: string }>;
  glossary?: string | null;
  approvedToolCall?: AgentLoopApprovedToolCall | null;
  /** Full Plan-mode pipeline from a single approval. */
  approvedToolCalls?: AgentLoopApprovedToolCall[] | null;
};

export function collectOpenDatasetsFromTabs(tabs: Tab[]): AgentLoopOpenDataset[] {
  const seen = new Set<string>();
  const out: AgentLoopOpenDataset[] = [];

  for (const tab of tabs) {
    const datasetId = getDatasetIdFromTab(tab);
    if (!datasetId || seen.has(datasetId)) continue;
    seen.add(datasetId);
    out.push({
      dataset_id: datasetId,
      label: tab.name,
      filename: tab.name,
    });
  }

  return out;
}

export async function runAgentLoop(params: RunAgentLoopParams): Promise<AgentLoopResponse> {
  return apiClient.assistant.agentLoop({
    message: params.message,
    mode: params.mode,
    datasetId: params.datasetId ?? null,
    openDatasets: params.openDatasets ?? [],
    conversationHistory: params.conversationHistory ?? [],
    glossary: params.glossary ?? null,
    approvedToolCall: params.approvedToolCall ?? null,
    approvedToolCalls: params.approvedToolCalls ?? null,
  });
}

export function chartsFromToolResults(
  toolResults: AgentLoopToolResult[] | undefined
): AnalysisReportChart[] {
  if (!toolResults?.length) return [];

  const charts: AnalysisReportChart[] = [];
  for (const entry of toolResults) {
    const result = entry.result;
    if (!result) continue;

    if (result.chart && typeof result.chart === 'object') {
      charts.push(result.chart as AnalysisReportChart);
    }

    if (entry.name === 'run_analysis' && result.result && typeof result.result === 'object') {
      const fromAnalysis = chartFromAnalysisEnvelope(result.result as Record<string, unknown>);
      if (fromAnalysis) charts.push(fromAnalysis);
    }
  }

  return charts;
}

function pendingActionFromPrepPlaybookResult(
  result: Record<string, unknown>,
  triggerMessage: string,
  datasetId: string
): ChatPendingAction | undefined {
  if (result.intent_kind !== 'playbook' && !result.step) return undefined;
  if (result.status === 'clean') return undefined;

  const proposed = result.proposed_action as PlaybookProposedAction | null | undefined;
  if (!proposed && result.status !== 'clean') {
    // Clean step with no mutation — caller may advance separately.
  }

  const step = String(result.step ?? 'missing_data') as PrepPlaybookStep;
  return {
    kind: 'prep_playbook',
    status: 'pending',
    step,
    stepIndex: Number(result.step_index ?? 0),
    totalSteps: Number(result.total_steps ?? 4),
    title: String(result.title ?? 'Data prep'),
    summaryText: String(result.summary ?? ''),
    proposedAction: proposed ?? null,
    datasetId,
    triggerMessage,
    logEntries: [],
    isLastStep: Boolean(result.is_last_step),
  };
}

function pendingActionFromDataEditResult(
  result: Record<string, unknown>
): ChatPendingAction | undefined {
  const proposed = result.proposed_action as PlaybookProposedAction | undefined;
  if (!proposed) {
    if (result.requires_confirm && result.filters) {
      return {
        kind: 'data_action',
        status: 'pending',
        action: {
          actionType: String(result.action_type ?? 'filter_apply'),
          spec: (result.action_spec as Record<string, unknown>) ?? {},
          rationale: result.answer_markdown ? String(result.answer_markdown) : undefined,
        },
      };
    }
    return undefined;
  }

  return {
    kind: 'proposed_action',
    status: 'pending',
    title: String(result.operation ?? 'Dataset change'),
    summaryText: result.answer_markdown ? String(result.answer_markdown) : undefined,
    proposedAction: proposed,
  };
}

export type DeriveLoopMessageContext = {
  triggerMessage: string;
  datasetId: string | null;
};

/** Map an agent-loop API response to chat message fields + optional pending action. */
export function deriveMessageUpdateFromLoopResponse(
  response: AgentLoopResponse,
  context: DeriveLoopMessageContext
): Partial<Omit<ChatMessage, 'id'>> {
  const answer = response.answer_markdown?.trim() || '_No answer returned._';
  const charts = chartsFromToolResults(response.tool_results);

  if (response.status === 'clarification') {
    const questions = response.clarification_questions?.filter(Boolean) ?? [];
    const questionBlock =
      questions.length > 0 ? `\n\n${questions.map(q => `- ${q}`).join('\n')}` : '';
    return {
      content: `${answer}${questionBlock}`.trim(),
      charts: charts.length ? charts : undefined,
      isStreaming: false,
    };
  }

  if (response.status === 'awaiting_approval') {
    const approvals = response.pending_approvals ?? [];
    const primary = approvals[0];
    if (primary) {
      return {
        content: answer,
        isStreaming: false,
        pendingAction: {
          kind: 'agent_tool_approval',
          status: 'pending',
          toolCallId: primary.tool_call_id,
          name: primary.name,
          args: primary.args,
          rationale: primary.rationale,
          whyThisTest: primary.why_this_test,
          triggerMessage: context.triggerMessage,
          pipelineSteps: approvals.length > 1 ? approvals : undefined,
        },
      };
    }
  }

  let pendingAction: ChatPendingAction | undefined;

  for (const entry of response.tool_results ?? []) {
    const result = entry.result;
    if (!result) continue;

    if (entry.name === 'start_prep_playbook' && context.datasetId) {
      const dsId = String(result.dataset_id ?? entry.args?.dataset_id ?? context.datasetId);
      pendingAction =
        pendingActionFromPrepPlaybookResult(result, context.triggerMessage, dsId) ?? pendingAction;
    }

    if (entry.name === 'data_edit') {
      pendingAction = pendingActionFromDataEditResult(result) ?? pendingAction;
    }
  }

  return {
    content: answer,
    charts: charts.length ? charts : undefined,
    isStreaming: false,
    pendingAction,
  };
}
