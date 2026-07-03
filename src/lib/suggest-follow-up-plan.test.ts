import {
  suggestFollowUpPlan,
  isChainedCompletion,
  resetFollowUpSuggestionDedup,
} from './suggest-follow-up-plan';

const basePlan = { analysisType: 'anova_oneway', spec: {} };

function envelope(
  result: Record<string, unknown>,
  report?: Record<string, unknown>,
  runId?: string
) {
  return {
    result,
    report: report ?? {},
    ...(runId ? { run_id: runId } : {}),
  };
}

describe('suggestFollowUpPlan', () => {
  beforeEach(() => {
    resetFollowUpSuggestionDedup();
  });

  it('returns null for chained plans', () => {
    expect(
      suggestFollowUpPlan(
        envelope({ p_value: 0.01, levene_test: { p_value: 0.5 } }),
        'anova_oneway',
        { group_column: 'g', value_column: 'v' },
        { ...basePlan, isChained: true }
      )
    ).toBeNull();
  });

  it('does not suggest Tukey when post_hoc is already in result', () => {
    expect(
      suggestFollowUpPlan(
        envelope({
          p_value: 0.01,
          levene_test: { p_value: 0.5 },
          post_hoc: { method: 'tukey_hsd', pairwise: [{ group1: 'A', group2: 'B' }] },
        }),
        'anova_oneway',
        { group_column: 'g', value_column: 'v', post_hoc: 'none' }
      )
    ).toBeNull();
  });

  it('does not suggest Welch when use_welch was already true', () => {
    expect(
      suggestFollowUpPlan(
        envelope({ p_value: 0.2, levene_test: { p_value: 0.01 }, use_welch: true }),
        'anova_oneway',
        { group_column: 'g', value_column: 'v', use_welch: true }
      )
    ).not.toBeNull();
    expect(
      suggestFollowUpPlan(
        envelope({ p_value: 0.2, levene_test: { p_value: 0.01 }, use_welch: true }),
        'anova_oneway',
        { group_column: 'g', value_column: 'v', use_welch: true }
      )?.plan?.analysisType
    ).toBe('kruskal_wallis');
  });

  it('suggests Welch ANOVA when Levene violated and classic ANOVA was run', () => {
    const followUp = suggestFollowUpPlan(
      envelope({ p_value: 0.2, levene_test: { p_value: 0.01 } }),
      'anova_oneway',
      { group_column: 'g', value_column: 'v' }
    );
    expect(followUp?.plan?.analysisType).toBe('anova_oneway');
    expect(followUp?.plan?.spec).toMatchObject({ use_welch: true });
    expect(followUp?.plan?.isChained).toBe(true);
  });

  it('does not suggest Shapiro after linear regression', () => {
    expect(
      suggestFollowUpPlan(
        envelope({
          p_value: 0.01,
          diagnostics: { jarque_bera_p_value: 0.001 },
        }),
        'linear_regression',
        { dependent: 'y', independents: ['x1'], collinearity_diagnostics: true }
      )
    ).toBeNull();
  });

  it('suggests collinearity re-run when VIF was not computed', () => {
    const followUp = suggestFollowUpPlan(
      envelope({
        p_value: 0.01,
        diagnostics: { jarque_bera_p_value: 0.001 },
      }),
      'linear_regression',
      { dependent: 'y', independents: ['x1', 'x2'] }
    );
    expect(followUp?.plan?.analysisType).toBe('linear_regression');
    expect(followUp?.plan?.spec).toMatchObject({ collinearity_diagnostics: true });
    expect(followUp?.plan?.isChained).toBe(true);
    expect(followUp?.rationale).toMatch(/Jarque-Bera/i);
  });

  it('returns null after a chained Welch ANOVA completes', () => {
    const welchEnvelope = envelope({
      p_value: 0.2,
      use_welch: true,
      levene_test: { p_value: 0.01 },
    });
    const chainedPlan = {
      analysisType: 'anova_oneway',
      spec: { group_column: 'g', value_column: 'v', use_welch: true },
      isChained: true,
    };
    expect(
      suggestFollowUpPlan(welchEnvelope, 'anova_oneway', chainedPlan.spec, chainedPlan)
    ).toBeNull();
  });

  it('shows a warning instead of Kruskal-Wallis when a group has n < 2', () => {
    const followUp = suggestFollowUpPlan(
      envelope({
        p_value: 0.2,
        levene_test: { p_value: 0.01 },
        group_descriptives: [
          { group: 'A', n: 10 },
          { group: 'SF-PF', n: 1 },
        ],
      }),
      'anova_oneway',
      { group_column: 'g', value_column: 'v' }
    );
    expect(followUp?.warningOnly).toBe(true);
    expect(followUp?.plan).toBeUndefined();
    expect(followUp?.rationale).toMatch(/SF-PF, n=1/i);
  });

  it('suggests Mann-Whitney after t-test with Levene violation', () => {
    const followUp = suggestFollowUpPlan(
      envelope({ p_value: 0.03, levene_test: { p_value: 0.01 } }),
      'ttest_independent',
      { group_column: 'g', value_column: 'v' }
    );
    expect(followUp?.plan?.analysisType).toBe('mann_whitney_u');
    expect(followUp?.plan?.isChained).toBe(true);
  });

  it('deduplicates follow-up suggestions for the same run_id', () => {
    const env = { ...envelope({ p_value: 0.01 }), run_id: 'run-abc' };
    const first = suggestFollowUpPlan(env, 'linear_regression', {
      dependent: 'y',
      independents: ['x1', 'x2'],
    });
    const second = suggestFollowUpPlan(env, 'linear_regression', {
      dependent: 'y',
      independents: ['x1', 'x2'],
    });
    expect(first?.plan?.analysisType).toBe('linear_regression');
    expect(second).toBeNull();
  });

  it('isChainedCompletion detects flag on plan or spec', () => {
    expect(isChainedCompletion({ analysisType: 'anova_oneway', spec: {}, isChained: true })).toBe(
      true
    );
    expect(isChainedCompletion(undefined, { isChained: true })).toBe(true);
    expect(isChainedCompletion({ analysisType: 'anova_oneway', spec: {} })).toBe(false);
  });

  it('suggests Wilcoxon when paired t-test is significant and Jarque-Bera violated', () => {
    const followUp = suggestFollowUpPlan(
      envelope({
        p_value: 0.01,
        diagnostics: { jarque_bera_p_value: 0.01 },
      }),
      'ttest_paired',
      { before_column: 'FG', after_column: 'FGA' }
    );
    expect(followUp?.plan?.analysisType).toBe('wilcoxon_signed_rank');
    expect(followUp?.plan?.isChained).toBe(true);
  });

  it('returns null when paired t-test is significant but normality is met', () => {
    expect(
      suggestFollowUpPlan(
        envelope({
          p_value: 0.01,
          diagnostics: { jarque_bera_p_value: 0.2 },
        }),
        'ttest_paired',
        { before_column: 'FG', after_column: 'FGA' }
      )
    ).toBeNull();
  });

  it('returns null for significant one-sample t-test', () => {
    expect(
      suggestFollowUpPlan(envelope({ p_value: 0.01 }), 'ttest_one_sample', {
        value_column: 'PTS',
        hypothesized_mean: 10,
      })
    ).toBeNull();
  });

  it('warns about Friedman post-hoc when significant', () => {
    const followUp = suggestFollowUpPlan(envelope({ p_value: 0.001, chi_square: 12 }), 'friedman', {
      measure_columns: ['FG', 'FGA', 'FT'],
    });
    expect(followUp?.warningOnly).toBe(true);
    expect(followUp?.plan).toBeUndefined();
    expect(followUp?.rationale).toMatch(/post-hoc/i);
  });

  it('returns null for significant Wilcoxon signed-rank', () => {
    expect(
      suggestFollowUpPlan(envelope({ p_value: 0.01 }), 'wilcoxon_signed_rank', {
        before_column: 'FG',
        after_column: 'FGA',
      })
    ).toBeNull();
  });

  it('returns null for significant Mann-Whitney U', () => {
    expect(
      suggestFollowUpPlan(envelope({ p_value: 0.01 }), 'mann_whitney_u', {
        group_column: 'Pos',
        value_column: 'PTS',
      })
    ).toBeNull();
  });

  it('suggests Kruskal-Wallis post-hoc when significant and assumptions met', () => {
    const followUp = suggestFollowUpPlan(
      envelope({
        p_value: 0.01,
        group_descriptives: [
          { group: 'A', n: 10 },
          { group: 'B', n: 12 },
        ],
      }),
      'kruskal_wallis',
      { group_column: 'Pos', value_column: 'PTS' }
    );
    expect(followUp?.plan?.analysisType).toBe('kruskal_wallis');
    expect(followUp?.plan?.spec).toMatchObject({ post_hoc: true });
    expect(followUp?.plan?.isChained).toBe(true);
  });

  it('returns null for significant Kolmogorov-Smirnov', () => {
    expect(
      suggestFollowUpPlan(envelope({ p_value: 0.001, statistic: 0.4 }), 'kolmogorov_smirnov', {
        test_type: 'two_sample',
        column_a: 'PTS',
        column_b: 'AST',
      })
    ).toBeNull();
  });

  it('warns when Cohen kappa is below substantial agreement', () => {
    const followUp = suggestFollowUpPlan(envelope({ kappa: 0.35, p_value: 0.01 }), 'cohens_kappa', {
      column_a: 'rater_a',
      column_b: 'rater_b',
    });
    expect(followUp?.warningOnly).toBe(true);
    expect(followUp?.rationale).toMatch(/contingency table/i);
  });

  it('warns when Cronbach alpha is below .70 with item removal hint', () => {
    const followUp = suggestFollowUpPlan(
      envelope({
        cronbach_alpha: 0.55,
        item_statistics: [
          { item: 'FG', alpha_if_deleted: 0.62 },
          { item: 'FGA', alpha_if_deleted: 0.71 },
        ],
      }),
      'reliability_cronbach',
      { columns: ['FG', 'FGA', 'FT'] }
    );
    expect(followUp?.warningOnly).toBe(true);
    expect(followUp?.rationale).toMatch(/FGA/);
  });

  it('returns null for substantial Cohen kappa', () => {
    expect(
      suggestFollowUpPlan(envelope({ kappa: 0.75 }), 'cohens_kappa', {
        column_a: 'a',
        column_b: 'b',
      })
    ).toBeNull();
  });

  it('returns null for canonical correlation', () => {
    expect(
      suggestFollowUpPlan(envelope({ canonical_correlations: [0.8] }), 'canonical_correlation', {
        set_a: ['x1'],
        set_b: ['y1'],
      })
    ).toBeNull();
  });

  it('returns null for significant partial correlation', () => {
    expect(
      suggestFollowUpPlan(envelope({ p_value: 0.01, r: 0.4 }), 'partial_correlation', {
        column_x: 'PTS',
        column_y: 'AST',
        control_columns: ['TRB'],
      })
    ).toBeNull();
  });

  it('suggests partial correlation after significant bivariate correlation with 3+ variables', () => {
    const followUp = suggestFollowUpPlan(
      envelope({
        columns: ['PTS', 'AST', 'TRB'],
        p_values: {
          PTS: { AST: 0.01, TRB: 0.2 },
          AST: { PTS: 0.01, TRB: 0.3 },
          TRB: { PTS: 0.2, AST: 0.3 },
        },
      }),
      'correlation',
      { columns: ['PTS', 'AST', 'TRB'] }
    );
    expect(followUp?.plan?.analysisType).toBe('partial_correlation');
    expect(followUp?.plan?.isChained).toBe(true);
    expect(followUp?.plan?.spec).toMatchObject({
      column_x: 'PTS',
      column_y: 'AST',
      control_columns: ['TRB'],
    });
  });

  it('warns about ROC for logistic regression without classification output', () => {
    const followUp = suggestFollowUpPlan(
      envelope({ pseudo_r_squared: 0.2 }),
      'logistic_regression',
      { dependent: 'y', independents: ['x1'] }
    );
    expect(followUp?.warningOnly).toBe(true);
    expect(followUp?.rationale).toMatch(/ROC/i);
  });

  it('returns null for linear mixed model', () => {
    expect(
      suggestFollowUpPlan(envelope({ log_likelihood: -100 }), 'linear_mixed_model', {
        dependent: 'y',
        fixed_effects: ['x1'],
        group_column: 'g',
      })
    ).toBeNull();
  });

  it('suggests CFA after EFA', () => {
    const followUp = suggestFollowUpPlan(envelope({ n_factors: 2 }), 'efa', {
      columns: ['FG', 'FGA', 'FT', 'FTA'],
    });
    expect(followUp?.plan?.analysisType).toBe('confirmatory_factor_analysis');
    expect(followUp?.plan?.isChained).toBe(true);
    expect(followUp?.plan?.spec).toMatchObject({
      indicators: ['FG', 'FGA', 'FT', 'FTA'],
      model_spec: 'F1 =~ FG + FGA + FT + FTA',
    });
  });

  it('suggests cluster analysis after discriminant analysis', () => {
    const followUp = suggestFollowUpPlan(
      envelope({ classification_accuracy: 0.9 }),
      'discriminant_analysis',
      { group_column: 'Pos', columns: ['PTS', 'AST'] }
    );
    expect(followUp?.plan?.analysisType).toBe('cluster_analysis');
    expect(followUp?.plan?.isChained).toBe(true);
  });

  it('does not suggest a follow-up after cluster analysis', () => {
    const followUp = suggestFollowUpPlan(envelope({ n_clusters: 3 }), 'cluster_analysis', {
      columns: ['PTS', 'AST'],
      method: 'kmeans',
      n_clusters: 3,
    });
    expect(followUp).toBeNull();
  });

  it('does not chain from a chained Wilcoxon result', () => {
    expect(
      suggestFollowUpPlan(
        envelope({ p_value: 0.01 }),
        'wilcoxon_signed_rank',
        { before_column: 'FG', after_column: 'FGA' },
        {
          analysisType: 'wilcoxon_signed_rank',
          spec: { before_column: 'FG', after_column: 'FGA' },
          isChained: true,
        }
      )
    ).toBeNull();
  });
});
