import type { AgentAnalysisPlan } from '@/lib/chat-pending-action';
import { ANALYSIS_LABELS, type AnalysisKey, isAnalysisKey } from '@/lib/analysis-definitions';

export const ANALYSIS_PLANNING_MESSAGE =
  'Let me look at your columns and figure out the best way to run this…';

export function analysisLabelForPlan(plan: AgentAnalysisPlan): string {
  if (isAnalysisKey(plan.analysisType)) {
    return ANALYSIS_LABELS[plan.analysisType as AnalysisKey];
  }
  return plan.analysisType.replace(/_/g, ' ');
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function asStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const cols = v.map(x => String(x).trim()).filter(Boolean);
  return cols.length ? cols : undefined;
}

function joinColumnNames(cols: string[]): string {
  if (cols.length <= 1) return cols[0] ?? '';
  if (cols.length === 2) return `${cols[0]} and ${cols[1]}`;
  return cols.join(', ');
}

/** Column names for the "Checking … look right" progress line (spec-field order). */
function checkingColumnsPhrase(plan: AgentAnalysisPlan): string | null {
  const spec = plan.spec ?? {};

  const columns = asStringArray(spec.columns);
  if (columns?.length) return joinColumnNames(columns);

  const dep = str(spec.dependent);
  const inds =
    asStringArray(spec.independents) ?? asStringArray(spec.predictors as string[] | undefined);
  if (dep && inds?.length) return joinColumnNames([dep, ...inds]);

  const colA = str(spec.column_a);
  const colB = str(spec.column_b);
  if (colA && colB) return `${colA} and ${colB}`;

  const fa = str(spec.factor_a);
  const fb = str(spec.factor_b);
  const vc = str(spec.value_column);
  if (fa && fb && vc) return `${fa}, ${fb} and ${vc}`;

  const group =
    str(spec.group_column) ??
    str(spec.independent as string | undefined) ??
    str(spec.group_variable);
  const value =
    str(spec.value_column) ??
    str(spec.dependent) ??
    str(spec.dependent_variable) ??
    str(spec.outcome_column);
  if (group && value && group !== value) return joinColumnNames([value, group]);

  const before = str(spec.before_column);
  const after = str(spec.after_column);
  if (before && after) return `${before} and ${after}`;

  return null;
}

/** Phrase for the "running on …" progress line (group comparisons). */
function runningTargetPhrase(plan: AgentAnalysisPlan): string | null {
  const spec = plan.spec ?? {};
  const t = plan.analysisType;

  if (t === 'anova_twoway') {
    const fa = str(spec.factor_a);
    const fb = str(spec.factor_b);
    const vc = str(spec.value_column);
    if (fa && fb && vc) return `**${vc}** by **${fa}** and **${fb}**`;
  }

  const group =
    str(spec.group_column) ??
    str(spec.independent as string | undefined) ??
    str(spec.group_variable);
  const value = str(spec.value_column) ?? str(spec.dependent) ?? str(spec.dependent_variable);
  if (group && value) return `**${value}** by **${group}**`;

  const cols = checkingColumnsPhrase(plan);
  if (cols) return cols;

  return null;
}

function mentionsTtestSubstitution(plan: AgentAnalysisPlan): boolean {
  const blob = `${plan.rationale ?? ''} ${plan.analysisType}`.toLowerCase();
  return (
    blob.includes('t-test') ||
    blob.includes('t test') ||
    blob.includes('ttest') ||
    (plan.analysisType === 'anova_oneway' && blob.includes('t-test'))
  );
}

/** Colleague-style thinking narration for inline progress (not pipeline logs). */
export function interpretProgressMessage(
  plan: AgentAnalysisPlan,
  step: string,
  backendMessage?: string
): string {
  const label = analysisLabelForPlan(plan);
  const spec = plan.spec ?? {};
  const backend = backendMessage?.trim().toLowerCase() ?? '';

  if (step === 'validating' || backend.includes('validat')) {
    const group =
      str(spec.group_column) ??
      str(spec.independent as string | undefined) ??
      str(spec.group_variable);
    if (mentionsTtestSubstitution(plan) && plan.analysisType === 'anova_oneway' && group) {
      return `You asked for a t-test but **${group}** has more than two levels — I'll switch to one-way ANOVA, which compares means across all groups…`;
    }
    const checking = checkingColumnsPhrase(plan);
    if (checking) {
      return `Checking ${checking} look right for a ${label}…`;
    }
    return `Checking your columns look right for a ${label}…`;
  }

  if (step === 'running' || backend.includes('running')) {
    const t = plan.analysisType;
    if (t === 'linear_regression' || t === 'regression') {
      const dep = str(spec.dependent);
      const inds =
        asStringArray(spec.independents) ?? asStringArray(spec.predictors as string[] | undefined);
      if (dep && inds?.length) {
        const indStr = inds.length > 4 ? `${inds.slice(0, 4).join(', ')}…` : inds.join(', ');
        return `Running ${label} predicting **${dep}** from ${indStr}…`;
      }
    }
    const target = runningTargetPhrase(plan);
    if (target) {
      return `Columns look good — running the ${label} on ${target} now…`;
    }
    return `Everything checks out — running the ${label} now…`;
  }

  if (
    backend.includes('assembling') ||
    backend.includes('summary') ||
    backend.includes('group means')
  ) {
    return `Assembling the summary, group means table, and chart…`;
  }

  if (backend.includes('putting together') || backend.includes('tables and visualization')) {
    return `Putting together the group means and boxplot…`;
  }

  if (backend.includes('final') || backend.includes('wrapping')) {
    return `Wrapping up the report…`;
  }

  if (step === 'building' || backend.includes('building') || backend.includes('report')) {
    return `Pulling together the key statistics for the summary…`;
  }

  if (backendMessage?.trim()) {
    return backendMessage.trim();
  }

  return `Working through the ${label}…`;
}

/** @deprecated use interpretProgressMessage */
export function defaultProgressMessage(
  plan: AgentAnalysisPlan,
  step: string,
  backendMessage?: string
): string {
  return interpretProgressMessage(plan, step, backendMessage);
}
