import type { AnalysisKey } from '@/lib/analysis-definitions';
import { isAnalysisKey } from '@/lib/analysis-definitions';
import type { AnalysisReport } from '@/lib/analysis-report-types';
import type { AgentAnalysisPlan } from '@/lib/chat-pending-action';

export type SuggestedFollowUp = {
  plan?: AgentAnalysisPlan;
  rationale: string;
  /** Chat-only warning — no Accept/Skip plan card. */
  warningOnly?: boolean;
};

/** Prevents duplicate follow-up cards when completion handlers run twice for the same run. */
let lastSuggestedRunId: string | null = null;

export function resetFollowUpSuggestionDedup(): void {
  lastSuggestedRunId = null;
}

function parseP(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function rawResult(envelope: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!envelope) return {};
  const result = envelope.result;
  return result && typeof result === 'object' ? (result as Record<string, unknown>) : {};
}

function reportFromEnvelope(
  envelope: Record<string, unknown> | undefined
): AnalysisReport | undefined {
  const report = envelope?.report;
  return report && typeof report === 'object' ? (report as AnalysisReport) : undefined;
}

/** Params used for the completed run — prefer report.analysis_spec.inputs, fall back to completedSpec. */
function effectiveSpec(
  envelope: Record<string, unknown> | undefined,
  completedSpec: Record<string, unknown>
): Record<string, unknown> {
  const inputs = reportFromEnvelope(envelope)?.analysis_spec?.inputs;
  if (inputs && typeof inputs === 'object') {
    return { ...completedSpec, ...(inputs as Record<string, unknown>) };
  }
  return completedSpec;
}

function leveneP(raw: Record<string, unknown>): number | null {
  const ht = raw.homogeneity_test ?? raw.levene_test;
  if (ht && typeof ht === 'object') {
    return parseP((ht as Record<string, unknown>).p_value);
  }
  return null;
}

function hasPostHocResults(raw: Record<string, unknown>): boolean {
  const ph = raw.post_hoc;
  if (ph == null || ph === false) return false;
  if (typeof ph === 'object') {
    const pairwise = (ph as Record<string, unknown>).pairwise;
    if (Array.isArray(pairwise) && pairwise.length > 0) return true;
    return Object.keys(ph as object).length > 0;
  }
  return Boolean(ph);
}

function welchAlreadyRun(spec: Record<string, unknown>, raw: Record<string, unknown>): boolean {
  return Boolean(spec.use_welch) || raw.use_welch === true;
}

function anyGroupNBelowTwo(raw: Record<string, unknown>): boolean {
  const gd = raw.group_descriptives;
  if (!Array.isArray(gd)) return false;
  return gd.some(row => {
    if (!row || typeof row !== 'object') return false;
    const n = Number((row as Record<string, unknown>).n);
    return Number.isFinite(n) && n < 2;
  });
}

function jarqueBeraP(raw: Record<string, unknown>): number | null {
  const top = parseP(raw.jarque_bera_p_value);
  if (top != null) return top;
  const diag = raw.diagnostics;
  if (!diag || typeof diag !== 'object') return null;
  return parseP((diag as Record<string, unknown>).jarque_bera_p_value);
}

function parseNum(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function pickPairedColumns(spec: Record<string, unknown>): { before?: string; after?: string } {
  return {
    before: str(spec.before_column),
    after: str(spec.after_column),
  };
}

function measureColumns(spec: Record<string, unknown>, raw: Record<string, unknown>): string[] {
  const fromSpec = spec.measure_columns;
  if (Array.isArray(fromSpec) && fromSpec.length) {
    return fromSpec.map(String);
  }
  const fromRaw = raw.measure_columns;
  if (Array.isArray(fromRaw) && fromRaw.length) {
    return fromRaw.map(String);
  }
  return [];
}

function correlationColumns(spec: Record<string, unknown>, raw: Record<string, unknown>): string[] {
  const fromRaw = raw.columns;
  if (Array.isArray(fromRaw) && fromRaw.length >= 2) return fromRaw.map(String);
  const fromSpec = spec.columns;
  if (Array.isArray(fromSpec) && fromSpec.length >= 2) return fromSpec.map(String);
  return [];
}

/** First significant pair (i < j) when 3+ variables; needs p_values or significant matrix in result. */
function firstSignificantCorrelationPair(
  raw: Record<string, unknown>,
  cols: string[]
): { column_x: string; column_y: string; control: string } | null {
  if (cols.length < 3) return null;
  const pvals = raw.p_values;
  const sig = raw.significant;
  for (let i = 0; i < cols.length; i++) {
    for (let j = i + 1; j < cols.length; j++) {
      const a = cols[i];
      const b = cols[j];
      let significant = false;
      if (sig && typeof sig === 'object') {
        const row = (sig as Record<string, Record<string, boolean>>)[a];
        if (row?.[b]) significant = true;
      }
      if (!significant && pvals && typeof pvals === 'object') {
        const row = (pvals as Record<string, Record<string, unknown>>)[a];
        const p = parseP(row?.[b]);
        if (p != null && p < 0.05) significant = true;
      }
      if (significant) {
        const control = cols.find(c => c !== a && c !== b);
        if (control) return { column_x: a, column_y: b, control };
      }
    }
  }
  return null;
}

function kappaValue(raw: Record<string, unknown>): number | null {
  return parseNum(raw.kappa);
}

function cronbachAlpha(raw: Record<string, unknown>): number | null {
  return parseNum(raw.cronbach_alpha);
}

function itemWithHighestAlphaIfDeleted(raw: Record<string, unknown>): string | null {
  const stats = raw.item_statistics;
  if (!Array.isArray(stats)) return null;
  let bestItem: string | null = null;
  let bestAlpha: number | null = null;
  for (const row of stats) {
    if (!row || typeof row !== 'object') continue;
    const item = str((row as Record<string, unknown>).item);
    const alpha = parseNum((row as Record<string, unknown>).alpha_if_deleted);
    if (!item || alpha == null) continue;
    if (bestAlpha == null || alpha > bestAlpha) {
      bestAlpha = alpha;
      bestItem = item;
    }
  }
  return bestItem;
}

function hasRocOrClassificationReport(
  raw: Record<string, unknown>,
  envelope: Record<string, unknown> | undefined
): boolean {
  if (parseNum(raw.roc_auc) != null || raw.confusion_matrix != null) return true;
  const report = reportFromEnvelope(envelope);
  const charts = report?.charts ?? (report?.chart ? [report.chart] : []);
  if (Array.isArray(charts)) {
    return charts.some(ch => {
      if (!ch || typeof ch !== 'object') return false;
      const kind = String((ch as Record<string, unknown>).kind ?? '');
      return kind.includes('roc') || kind.includes('confusion');
    });
  }
  return false;
}

function buildCfaSpecFromIndicators(cols: string[]): Record<string, unknown> {
  const indicators = cols.slice(0, Math.min(cols.length, 12));
  return {
    indicators,
    model_spec: `F1 =~ ${indicators.join(' + ')}`,
  };
}

function hasCollinearityResults(raw: Record<string, unknown>): boolean {
  const col = raw.collinearity;
  if (!col || typeof col !== 'object') return false;
  const vif = (col as Record<string, unknown>).vif;
  return Array.isArray(vif) ? vif.length > 0 : Object.keys(col as object).length > 0;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function pickGroupValue(spec: Record<string, unknown>): { group?: string; value?: string } {
  return {
    group: str(spec.group_column) ?? str(spec.group_variable),
    value: str(spec.value_column) ?? str(spec.dependent_variable) ?? str(spec.dependent),
  };
}

function chainedFollowUp(
  analysisType: string,
  spec: Record<string, unknown>,
  rationale: string
): SuggestedFollowUp {
  return {
    plan: { analysisType, spec, rationale, isChained: true },
    rationale,
  };
}

function warningFollowUp(rationale: string): SuggestedFollowUp {
  return { rationale, warningOnly: true };
}

function smallGroups(raw: Record<string, unknown>): { group: string; n: number }[] {
  const gd = raw.group_descriptives;
  if (!Array.isArray(gd)) return [];
  return gd
    .map(row => {
      if (!row || typeof row !== 'object') return null;
      const group = String((row as Record<string, unknown>).group ?? '').trim();
      const n = Number((row as Record<string, unknown>).n);
      if (!group || !Number.isFinite(n)) return null;
      return { group, n };
    })
    .filter((row): row is { group: string; n: number } => row != null && row.n < 2);
}

function smallGroupComparisonWarning(raw: Record<string, unknown>): string {
  const small = smallGroups(raw);
  if (!small.length) return '';
  const parts = small.map(s => `${s.group}, n=${s.n}`).join('; ');
  return (
    `One or more groups have fewer than 2 observations (${parts}) — non-parametric tests also require at least 2 per group. ` +
    'Consider removing single-observation groups before running group comparisons.'
  );
}

/** True when this run was itself a chained follow-up — no further chaining allowed. */
export function isChainedCompletion(
  completedPlan?: AgentAnalysisPlan,
  completedSpec?: Record<string, unknown>
): boolean {
  if (completedPlan?.isChained === true) return true;
  if (completedSpec?.isChained === true) return true;
  return false;
}

function jarqueBeraWarning(raw: Record<string, unknown>): string {
  const jbP = jarqueBeraP(raw);
  if (jbP == null || jbP >= 0.05) return '';
  return ' Residual normality may be violated (Jarque-Bera p < .05) — interpret coefficients cautiously.';
}

/**
 * Deterministic follow-up from a completed analysis. Returns at most one suggestion.
 * Never chains off a chained result (`completedPlan.isChained`).
 * Inspects envelope.result, report.assumption_checks, and analysis_spec.inputs before suggesting.
 */
export function suggestFollowUpPlan(
  envelope: Record<string, unknown> | undefined,
  analysisKey: string,
  completedSpec: Record<string, unknown>,
  completedPlan?: AgentAnalysisPlan
): SuggestedFollowUp | null {
  if (!envelope?.result) return null;

  const runId = envelope.run_id;
  if (typeof runId === 'string' && runId === lastSuggestedRunId) return null;
  if (typeof runId === 'string') lastSuggestedRunId = runId;

  if (isChainedCompletion(completedPlan, completedSpec)) return null;

  const raw = rawResult(envelope);
  const spec = effectiveSpec(envelope, completedSpec);
  if (isChainedCompletion(completedPlan, spec)) return null;
  const key = analysisKey as AnalysisKey;
  if (!isAnalysisKey(key)) return null;

  const { group, value } = pickGroupValue(spec);
  const p = parseP(raw.p_value);
  const levP = leveneP(raw);
  const leveneViolated = levP != null && levP < 0.05;
  const assumptionsMet = levP == null || levP >= 0.05;

  // Priority 1 — assumption violation that invalidates the parametric result
  if (key === 'anova_oneway' && group && value && leveneViolated) {
    if (anyGroupNBelowTwo(raw)) {
      const warning = smallGroupComparisonWarning(raw);
      if (warning) return warningFollowUp(warning);
    }
    if (!welchAlreadyRun(spec, raw)) {
      const postHoc = str(spec.post_hoc);
      return chainedFollowUp(
        'anova_oneway',
        {
          group_column: group,
          value_column: value,
          use_welch: true,
          post_hoc: postHoc && postHoc !== 'none' ? postHoc : 'none',
          homogeneity_test: spec.homogeneity_test ?? 'levene',
        },
        "Levene's test suggests unequal variances — Welch's ANOVA is more appropriate when homogeneity is violated."
      );
    }
    return chainedFollowUp(
      'kruskal_wallis',
      { group_column: group, value_column: value, post_hoc: true },
      'Variances may still be unequal — Kruskal-Wallis is a non-parametric alternative that does not assume normality or equal variances.'
    );
  }

  if (key === 'ttest_independent' && group && value && leveneViolated) {
    // Levene + both variance rows + Shapiro (enrich) are already in the envelope — only Mann-Whitney is new.
    return chainedFollowUp(
      'mann_whitney_u',
      { group_column: group, value_column: value },
      "Levene's test indicates unequal variances — Mann-Whitney U is a non-parametric alternative that does not assume equal variances."
    );
  }

  // Priority 2 — significant result that warrants follow-up
  if (key === 'anova_oneway' && group && value && assumptionsMet) {
    const postHocParam = str(spec.post_hoc);
    const postHocAlreadyRun = hasPostHocResults(raw) || postHocParam === 'tukey';
    if (p != null && p < 0.05 && !postHocAlreadyRun && !welchAlreadyRun(spec, raw)) {
      return chainedFollowUp(
        'anova_oneway',
        {
          group_column: group,
          value_column: value,
          post_hoc: 'tukey',
          homogeneity_test: spec.homogeneity_test ?? 'levene',
          use_welch: false,
        },
        'Your ANOVA is significant — Tukey post-hoc will show which specific pairs of group means differ.'
      );
    }
  }

  if (key === 'kruskal_wallis' && group && value) {
    const postHocRequested = Boolean(spec.post_hoc);
    const kwAssumptionsMet = !anyGroupNBelowTwo(raw);
    if (p != null && p < 0.05 && kwAssumptionsMet && !hasPostHocResults(raw) && !postHocRequested) {
      return chainedFollowUp(
        'kruskal_wallis',
        { group_column: group, value_column: value, post_hoc: true },
        'Kruskal-Wallis is significant — pairwise post-hoc comparisons will show which groups differ.'
      );
    }
  }

  if (key === 'ttest_paired') {
    const { before, after } = pickPairedColumns(spec);
    if (before && after && p != null && p < 0.05) {
      const jbP = jarqueBeraP(raw);
      if (jbP != null && jbP < 0.05) {
        return chainedFollowUp(
          'wilcoxon_signed_rank',
          {
            before_column: before,
            after_column: after,
            confidence_level: spec.confidence_level ?? 0.95,
          },
          'Paired differences may be non-normal (Jarque-Bera p < .05) — Wilcoxon signed-rank is a non-parametric alternative.'
        );
      }
    }
  }

  if (key === 'friedman') {
    const measures = measureColumns(spec, raw);
    if (p != null && p < 0.05 && measures.length >= 3) {
      return warningFollowUp(
        `Friedman test is significant across **${measures.join(', ')}** — pairwise post-hoc comparisons ` +
          '(Wilcoxon signed-rank on each pair, with multiple-comparison correction) are recommended to identify which measures differ.'
      );
    }
  }

  if (key === 'correlation') {
    const cols = correlationColumns(spec, raw);
    const pair = firstSignificantCorrelationPair(raw, cols);
    if (pair) {
      return chainedFollowUp(
        'partial_correlation',
        {
          column_x: pair.column_x,
          column_y: pair.column_y,
          control_columns: [pair.control],
          method: spec.method ?? 'pearson',
        },
        `A significant correlation was found — partial correlation controlling for **${pair.control}** tests whether the **${pair.column_x}**–**${pair.column_y}** association remains after accounting for that variable.`
      );
    }
  }

  if (key === 'cohens_kappa') {
    const kappa = kappaValue(raw);
    if (kappa != null && kappa < 0.6) {
      return warningFollowUp(
        `Cohen's κ = ${kappa.toFixed(3)} indicates less than substantial agreement (Landis & Koch: κ < .60). ` +
          'Review the contingency table for cells with the lowest observed agreement and consider recoding categories or revising rater guidelines.'
      );
    }
  }

  if (key === 'reliability_cronbach') {
    const alpha = cronbachAlpha(raw);
    const dropItem = itemWithHighestAlphaIfDeleted(raw);
    if (alpha != null && alpha < 0.7) {
      const dropNote = dropItem
        ? ` Removing **${dropItem}** would raise α the most (highest α-if-deleted) — inspect that item before dropping it.`
        : '';
      return warningFollowUp(
        `Cronbach's α = ${alpha.toFixed(3)} is below the conventional .70 threshold for acceptable internal consistency.${dropNote}`
      );
    }
  }

  if (key === 'logistic_regression') {
    if (!hasRocOrClassificationReport(raw, envelope)) {
      return warningFollowUp(
        'Review classification performance with a ROC curve or confusion matrix at your chosen cutoff — coefficients alone do not show how well the model separates the two outcome classes.'
      );
    }
  }

  if (key === 'discriminant_analysis') {
    const cols = (spec.columns as string[] | undefined) ?? [];
    if (cols.length >= 2) {
      return chainedFollowUp(
        'cluster_analysis',
        {
          columns: cols,
          method: 'kmeans',
          n_clusters: Math.min(4, Math.max(2, cols.length)),
          standardize: true,
        },
        'Discriminant analysis uses known group labels — k-means clustering explores unsupervised group structure in the same predictors without requiring labels.'
      );
    }
  }

  if (key === 'cluster_analysis') {
    return null;
  }

  // Priority 3 — natural next step in a research pipeline
  if (key === 'linear_regression') {
    const dep = str(spec.dependent) ?? str(spec.dependent_variable);
    const independents = (spec.independents as string[] | undefined) ?? [];
    const collinearityRequested = Boolean(spec.collinearity_diagnostics);
    if (dep && independents.length >= 2 && !collinearityRequested && !hasCollinearityResults(raw)) {
      const jbNote = jarqueBeraWarning(raw);
      return chainedFollowUp(
        'linear_regression',
        {
          dependent: dep,
          independents,
          method: spec.method ?? 'enter',
          confidence_level: spec.confidence_level ?? 0.95,
          collinearity_diagnostics: true,
        },
        `Multicollinearity was not checked in this run — re-run with VIF/tolerance diagnostics.${jbNote}`
      );
    }
    // Residual normality (Jarque-Bera) is already in result.diagnostics — no Shapiro chain.
    return null;
  }

  if (key === 'pca') {
    const cols = (spec.columns as string[] | undefined) ?? [];
    if (cols.length >= 3) {
      const dep = cols[0];
      const preds = cols.slice(1, Math.min(6, cols.length));
      return chainedFollowUp(
        'linear_regression',
        { dependent: dep, independents: preds, method: 'enter' },
        `Factor structure from PCA can inform prediction — linear regression on **${dep}** using the component variables tests how they relate to the outcome together.`
      );
    }
  }

  if (key === 'efa') {
    const cols = (spec.columns as string[] | undefined) ?? [];
    if (cols.length >= 2) {
      return chainedFollowUp(
        'confirmatory_factor_analysis',
        buildCfaSpecFromIndicators(cols),
        'Exploratory factor analysis suggests a structure — confirmatory factor analysis (CFA) tests whether that factor model fits in a new sample or holdout.'
      );
    }
  }

  // cluster_analysis → anova profiling requires cluster labels in the dataset (not persisted today)
  //
  // Backlog — future chaining triggers (not implemented):
  // - anova_twoway significant → post-hoc per factor
  // - anova_repeated significant → pairwise comparisons
  // - kaplan_meier always → Cox regression
  // - random_forest_classification always → discriminant analysis comparison
  // - confirmatory_factor_analysis good fit → SEM
  return null;
}

/** @deprecated Prefer suggestFollowUpPlan — returns 0 or 1 suggestion. */
export function suggestFollowUpPlans(
  envelope: Record<string, unknown> | undefined,
  analysisKey: string,
  completedSpec: Record<string, unknown>,
  completedPlan?: AgentAnalysisPlan
): SuggestedFollowUp[] {
  const one = suggestFollowUpPlan(envelope, analysisKey, completedSpec, completedPlan);
  return one ? [one] : [];
}
