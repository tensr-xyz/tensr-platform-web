import type { AnalysisKey } from '@/lib/analysis-definitions';
import { isAnalysisKey, ANALYSIS_LABELS } from '@/lib/analysis-definitions';

export type AgentAnalysisPlan = {
  analysisType: string;
  spec: Record<string, unknown>;
  rationale?: string;
  /** True when this plan was auto-suggested after another analysis — must not chain further. */
  isChained?: boolean;
};

export type AgentDataAction = {
  actionType: string;
  spec: Record<string, unknown>;
  rationale?: string;
  autoExecute?: boolean;
};

/** One of the four agent-driven data-prep playbook steps (Track C step 2), in run order. */
export type PrepPlaybookStep = 'missing_data' | 'duplicates' | 'outliers' | 'type_fix';

/** A concrete existing data_ops endpoint to POST once the user confirms a playbook step. */
export type PlaybookProposedAction = {
  endpoint: string;
  method?: string;
  body: Record<string, unknown>;
};

export type ChatPendingActionStatus =
  | 'pending'
  | 'planning'
  | 'running'
  | 'failed'
  | 'accepted'
  | 'skipped'
  | 'expired';

/** Statuses where the approval card is shown and may accept input. */
export const INTERACTIVE_APPROVAL_STATUSES: ChatPendingActionStatus[] = [
  'pending',
  'planning',
  'running',
  'failed',
];

export type ChatPendingAction =
  | {
      kind: 'analysis_plan';
      status: ChatPendingActionStatus;
      plan: AgentAnalysisPlan;
      /** Redundant guard — set on chained follow-up cards so the flag survives plan merges. */
      isChained?: boolean;
      errorMessage?: string;
    }
  | {
      kind: 'analysis_menu';
      status: ChatPendingActionStatus;
      op: AnalysisKey;
      menuName: string;
      /** Original user message — used to plan variables when Accept is clicked. */
      triggerMessage: string;
      errorMessage?: string;
    }
  | {
      kind: 'data_action';
      status: ChatPendingActionStatus;
      action: AgentDataAction;
      errorMessage?: string;
    }
  | {
      kind: 'prep_playbook';
      status: ChatPendingActionStatus;
      step: PrepPlaybookStep;
      stepIndex: number;
      totalSteps: number;
      title: string;
      summaryText: string;
      /** null when the step found nothing to fix — Accept just advances to the next step. */
      proposedAction: PlaybookProposedAction | null;
      /** Dataset this step inspected — becomes the base for the next inspect call. */
      datasetId: string;
      /** Original user message that started the playbook (fed into the closing report). */
      triggerMessage: string;
      /** Human-readable outcome of every step completed so far in this run. */
      logEntries: string[];
      isLastStep: boolean;
      errorMessage?: string;
    }
  | {
      kind: 'agent_tool_approval';
      status: ChatPendingActionStatus;
      toolCallId: string;
      name: string;
      args: Record<string, unknown>;
      rationale?: string;
      whyThisTest?: string;
      triggerMessage: string;
      errorMessage?: string;
    }
  | {
      kind: 'proposed_action';
      status: ChatPendingActionStatus;
      title: string;
      summaryText?: string;
      proposedAction: PlaybookProposedAction;
      errorMessage?: string;
    };

const PLANNER_TYPE_TO_OP: Record<string, AnalysisKey> = {
  regression: 'linear_regression',
  anova: 'anova_oneway',
  correlations: 'correlation',
};

export function plannerTypeToOp(analysisType: string): AnalysisKey | null {
  if (isAnalysisKey(analysisType)) return analysisType;
  return PLANNER_TYPE_TO_OP[analysisType] ?? null;
}

/** Map planner spec fields to the analysis setup modal / API body shape. */
export function plannerSpecToSetupBody(
  analysisType: string,
  spec: Record<string, unknown>
): Record<string, unknown> {
  if (analysisType === 'regression') {
    const predictors = (spec.predictors as string[] | undefined) ?? [];
    return {
      dependent: spec.dependent,
      independents: predictors,
    };
  }
  if (analysisType === 'anova') {
    const group = spec.independent ?? (spec.groups as string[] | undefined)?.[0];
    return {
      group_column: group,
      value_column: spec.dependent,
    };
  }
  if (analysisType === 'correlations') {
    const variables =
      (spec.variables as string[] | undefined) ?? (spec.predictors as string[] | undefined) ?? [];
    return { columns: variables };
  }
  return { ...spec };
}

export function formatPlanVariablesLine(plan: AgentAnalysisPlan): string {
  const spec = plan.spec || {};
  if (isAnalysisKey(plan.analysisType)) {
    const keys = Object.entries(spec)
      .filter(([, v]) => v != null && v !== '')
      .slice(0, 4)
      .map(([k, v]) => `${k}=${Array.isArray(v) ? (v as string[]).join(',') : String(v)}`);
    return keys.join(' · ');
  }
  if (plan.analysisType === 'regression') {
    const inds = (spec.predictors as string[] | undefined) ?? [];
    const dep = spec.dependent;
    if (dep && inds.length) return `${dep} ~ ${inds.join(', ')}`;
    return String(dep ?? inds.join(', ') ?? '');
  }
  if (plan.analysisType === 'anova') {
    const g = spec.independent ?? (spec.groups as string[] | undefined)?.[0];
    return [spec.dependent, g].filter(Boolean).join(' by ');
  }
  if (plan.analysisType === 'correlations') {
    const v =
      (spec.variables as string[] | undefined) ?? (spec.predictors as string[] | undefined) ?? [];
    return v.join(', ');
  }
  return '';
}

/** Pending analysis suggestion cards (follow-up or exploratory) awaiting Accept. */
export function isPendingSuggestionAction(action: ChatPendingAction | undefined): boolean {
  return action?.kind === 'analysis_plan' && action.status === 'pending';
}
