/**
 * Production menu — launch menubar (Data, Transform, Analyze).
 */
import {
  Calculator,
  Database,
  MessageCircle,
  Filter,
  TrendingUp as ChartLine,
  Blocks,
} from 'lucide-react';
import type { ReactNode } from 'react';

type MenuSection = Record<string, string[]>;
type MenuItem = { icon: ReactNode; sections: MenuSection };
type MenuItems = Record<string, MenuItem>;

export const PRODUCTION_MENU_ITEMS: MenuItems = {
  agent: {
    icon: <MessageCircle className="h-4 w-4" />,
    sections: {},
  },
  actions: {
    icon: <Filter className="h-4 w-4" />,
    sections: {},
  },
  graph_options: {
    icon: <ChartLine className="h-4 w-4" />,
    sections: {},
  },
  plugins: {
    icon: <Blocks className="h-4 w-4" />,
    sections: {},
  },
  data: {
    icon: <Database className="h-4 w-4" />,
    sections: {
      'Import & Export': ['Import Data', 'Export Data'],
      'Data preparation': [
        'Merge Datasets',
        'Handle Missing Data',
        'Find Duplicates',
        'Data Quality Report',
      ],
    },
  },
  transform: {
    icon: <Database className="h-4 w-4" />,
    sections: {
      Transform: [
        'Compute Variable',
        'Recode Variables',
        'Shift Values',
        'Standardize Variables',
        'Visual Binning',
        'Lag Cases',
        'Lead Cases',
        'Rank Cases',
      ],
    },
  },
  analyze: {
    icon: <Calculator className="h-4 w-4" />,
    sections: {
      'Descriptive Statistics': ['Descriptives'],
      'Compare Means': [
        'Independent-Samples T Test',
        'Paired-Samples T Test',
        'One-Sample T Test',
        'One-Way ANOVA',
      ],
      'Nonparametric Tests': [
        'Mann-Whitney U',
        'Kruskal-Wallis H',
        'Wilcoxon Signed-Rank',
        'Friedman Test',
        'Kolmogorov-Smirnov',
        "Cochran's Q",
      ],
      Reliability: ['Reliability'],
      Scale: ["Fleiss' Kappa", 'Weighted Kappa', "Kendall's W"],
      Correlate: [
        'Bivariate Correlations',
        'Partial Correlation',
        'Goodman-Kruskal Gamma',
        "Somers' D",
        'Goodman-Kruskal Lambda',
        'Cochran-Armitage Trend Test',
      ],
      'Dimension Reduction': [
        'Principal Component Analysis',
        'Exploratory Factor Analysis',
        'Multidimensional Scaling (MDS)',
      ],
      'General Linear Model': [
        'Two-Way ANOVA',
        'Repeated Measures ANOVA',
        'Mixed ANOVA',
        'Multivariate ANOVA',
        'ANCOVA',
      ],
      Classification: ['Discriminant Analysis', 'Cluster Analysis', 'Decision Tree Classification'],
      Regression: [
        'Linear Regression',
        'Hierarchical Multiple Regression',
        'Moderation Analysis',
        'Binary Logistic Regression',
        'Poisson Regression',
        'Negative Binomial Regression',
        'Ordinal Regression',
      ],
      Agreement: ["Cohen's Kappa"],
      'Normality & related': ['Shapiro–Wilk Test'],
      'Regression (extended)': ['Probit Regression'],
      'Descriptive Statistics (tables)': [
        'Chi-square',
        "Fisher's Exact Test",
        'Odds Ratio',
        'Relative Risk',
      ],
      Network: ['Network'],
    },
  },
  visualization: {
    icon: <Calculator className="h-4 w-4" />,
    sections: {
      Charts: [
        'Bar Chart',
        'Line Chart',
        'Scatter Chart',
        'Histogram',
        'Boxplot',
        'Pie Chart',
        'Area Chart',
      ],
    },
  },
  time_series: {
    icon: <Calculator className="h-4 w-4" />,
    sections: {},
  },
  ml_ai: {
    icon: <Calculator className="h-4 w-4" />,
    sections: {
      Classification: ['Random Forest Classification', 'Gradient Boosting (Classification)'],
      Regression: ['Random Forest Regression', 'Gradient Boosting (Regression)'],
    },
  },
  multivariate: {
    icon: <Calculator className="h-4 w-4" />,
    sections: {
      'Mixed Models': [
        'Mixed Model',
        'Linear Mixed Model (LMM)',
        'Generalized Linear Mixed Model (GLMM)',
        'Multilevel Modelling (HLM)',
        'GEE (clustered binary)',
      ],
      'Factor & SEM': ['Confirmatory Factor Analysis (CFA)', 'Structural Equation Modelling (SEM)'],
      'Latent Structure': ['Latent Class Analysis (LCA)'],
    },
  },
};

/** SPSS menu label → tensr-api analysis operation */
export const PRODUCTION_ANALYSIS_LABELS: Record<
  string,
  import('@/lib/analysis-definitions').AnalysisKey
> = {
  Descriptives: 'descriptives',
  'Independent-Samples T Test': 'ttest_independent',
  'Paired-Samples T Test': 'ttest_paired',
  'One-Sample T Test': 'ttest_one_sample',
  'One-Way ANOVA': 'anova_oneway',
  'Mann-Whitney U': 'mann_whitney_u',
  'Kruskal-Wallis H': 'kruskal_wallis',
  'Bivariate Correlations': 'correlation',
  'Linear Regression': 'linear_regression',
  'Binary Logistic Regression': 'logistic_regression',
  'Chi-square': 'chi_square',
  Crosstabs: 'chi_square',
  'Wilcoxon Signed-Rank': 'wilcoxon_signed_rank',
  'Friedman Test': 'friedman',
  'Kolmogorov-Smirnov': 'kolmogorov_smirnov',
  Reliability: 'reliability',
  'Partial Correlation': 'partial_correlation',
  'Principal Component Analysis': 'pca',
  PCA: 'pca',
  'Two-Way ANOVA': 'anova_twoway',
  'Repeated Measures ANOVA': 'anova_repeated',
  'Poisson Regression': 'poisson_regression',
  "Cohen's Kappa": 'cohens_kappa',
  'Exploratory Factor Analysis': 'efa',
  EFA: 'efa',
  'Discriminant Analysis': 'discriminant_analysis',
  'Cluster Analysis': 'cluster_analysis',
  'Multivariate ANOVA': 'manova',
  MANOVA: 'manova',
  ANCOVA: 'ancova',
  'Decision Tree Classification': 'decision_tree',
  'Decision Trees': 'decision_tree',
  'Shapiro–Wilk Test': 'shapiro_wilk',
  'Probit Regression': 'probit_regression',
  'Negative Binomial Regression': 'negative_binomial_regression',
  'Ordinal Regression': 'ordinal_regression',
  "Cochran's Q": 'cochrans_q',
  'Multidimensional Scaling (MDS)': 'multidimensional_scaling',
  'Random Forest Classification': 'random_forest_classification',
  'Random Forest Regression': 'random_forest_regression',
  'Gradient Boosting (Classification)': 'gradient_boosting',
  'Gradient Boosting (Regression)': 'gradient_boosting',
  'Linear Mixed Model (LMM)': 'linear_mixed_model',
  'Generalized Linear Mixed Model (GLMM)': 'generalized_linear_mixed_model',
  'Multilevel Modelling (HLM)': 'multilevel_modelling',
  'Confirmatory Factor Analysis (CFA)': 'confirmatory_factor_analysis',
  'Structural Equation Modelling (SEM)': 'structural_equation_modelling',
  "Fleiss' Kappa": 'fleiss_kappa',
  'Weighted Kappa': 'weighted_kappa',
  "Kendall's W": 'kendalls_w',
  "Fisher's Exact Test": 'fishers_exact',
  'Odds Ratio': 'odds_ratio',
  'Relative Risk': 'relative_risk',
  'Goodman-Kruskal Gamma': 'goodman_kruskal_gamma',
  "Somers' D": 'somers_d',
  'Goodman-Kruskal Lambda': 'goodman_kruskal_lambda',
  'Cochran-Armitage Trend Test': 'cochran_armitage',
  'Hierarchical Multiple Regression': 'hierarchical_regression',
  'Mixed ANOVA': 'anova_mixed',
  'Moderation Analysis': 'moderation_analysis',
  'Mixed Model': 'mixed_model',
  'GEE (clustered binary)': 'gee',
  Network: 'network',
  'Latent Class Analysis (LCA)': 'latent_class_analysis',
};
