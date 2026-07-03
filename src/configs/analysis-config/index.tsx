import { JSX, ReactNode, Suspense, lazy } from 'react';
import {
  Calculator,
  Database,
  Filter,
  TrendingUp as ChartLine,
  TableProperties,
  Wrench,
  Blocks,
  FileText,
  Brain,
  TrendingUp,
  BarChart3 as ChartBar,
  AreaChart as ChartArea,
  ScatterChart as ChartScatter,
  Activity,
  Zap,
  Code,
  Settings,
} from 'lucide-react';
import {
  createAnalysisLauncher,
  AnalysisUnavailable,
} from '@/components/templates/analysis/analysis-launcher';
import type { AnalysisKey } from '@/lib/analysis-definitions';
import { ExportDialog } from '@/components/templates/data';
import ComputeVariablesDialog from '@/components/templates/transform/compute-variable';
import CountValuesDialog from '@/components/templates/transform/count-values';
import ShiftValuesDialog from '@/components/templates/transform/shift-values';
import { MessageCircle } from 'lucide-react';
import { PRODUCTION_MENU_ITEMS } from './production-menu';

export type MenuSection = Record<string, string[]>;

export interface MenuItem {
  icon: ReactNode;
  sections: MenuSection;
}

export type MenuItems = Record<string, MenuItem>;

export type AnalysisComponent = ({ children }: { children: ReactNode }) => JSX.Element | null;

// Lazy wrapper for FilePickerWrapper to avoid circular dependency
// Uses React.lazy to dynamically import only when component is rendered
const LazyFilePickerWrapperInternal = lazy(() =>
  import('@/components/molecules/file-picker').then(module => ({
    default: module.FilePickerWrapper,
  }))
);

const LazyFilePickerWrapper: AnalysisComponent = ({ children }) => {
  return (
    <Suspense fallback={null}>
      <LazyFilePickerWrapperInternal>{children}</LazyFilePickerWrapperInternal>
    </Suspense>
  );
};

const L = (op: AnalysisKey) => createAnalysisLauncher(op);
const U = (featureName: string): AnalysisComponent => {
  const Comp = ({ children }: { children: ReactNode }) => (
    <AnalysisUnavailable featureName={featureName}>{children}</AnalysisUnavailable>
  );
  return Comp;
};

const DescriptivesLauncher = L('descriptives');
const CorrelationLauncher = L('correlation');
const AnovaLauncher = L('anova_oneway');
const OneSampleLauncher = L('ttest_one_sample');
const IndependentTLauncher = L('ttest_independent');
const PairedTLauncher = L('ttest_paired');
const MannWhitneyLauncher = L('mann_whitney_u');
const KruskalLauncher = L('kruskal_wallis');
const LinearRegLauncher = L('linear_regression');
const LogisticRegLauncher = L('logistic_regression');
const ChiSquareLauncher = L('chi_square');

export {
  ANALYSIS_OP_BY_MENU_NAME,
  getAnalysisOpForMenuName,
  getMenuItemComponent,
} from './menu-registry';

export const ANALYSIS_COMPONENTS: Record<string, AnalysisComponent> = {
  // Descriptive Statistics
  'Compare Means': DescriptivesLauncher,
  'One Way Anova': AnovaLauncher,
  'One Sample T-Test': OneSampleLauncher,
  'Descriptive Statistics': DescriptivesLauncher,
  Frequencies: DescriptivesLauncher,
  Descriptives: DescriptivesLauncher,
  'One-Way ANOVA': AnovaLauncher,
  'Independent-Samples T Test': IndependentTLauncher,
  'Paired-Samples T Test': PairedTLauncher,
  'One-Sample T Test': OneSampleLauncher,
  'Bivariate Correlations': CorrelationLauncher,
  'Binary Logistic Regression': LogisticRegLauncher,
  Crosstabs: ChiSquareLauncher,
  'Chi-Square Test': ChiSquareLauncher,
  Explore: DescriptivesLauncher,
  'Ratio Statistics': DescriptivesLauncher,
  'Custom Tables': DescriptivesLauncher,
  'Pivot Tables': DescriptivesLauncher,

  // Correlation & Regression
  'Correlation Analysis': CorrelationLauncher,
  'Linear Regression': LinearRegLauncher,
  'Partial Correlation': L('partial_correlation'),
  PCA: L('pca'),
  'Principal Component Analysis': L('pca'),
  'Exploratory Factor Analysis': L('efa'),
  EFA: L('efa'),
  'Two-Way ANOVA': L('anova_twoway'),
  'Repeated Measures ANOVA': L('anova_repeated'),
  'Multivariate ANOVA': L('manova'),
  MANOVA: L('manova'),
  ANCOVA: L('ancova'),
  'Discriminant Analysis': L('discriminant_analysis'),
  'Cluster Analysis': L('cluster_analysis'),
  'Decision Tree Classification': L('decision_tree'),
  'Decision Trees': L('decision_tree'),
  'Poisson Regression': L('poisson_regression'),
  "Cohen's Kappa": L('cohens_kappa'),
  'Multiple Regression': LinearRegLauncher,
  'Logistic Regression': LogisticRegLauncher,
  'Probit Regression': L('probit_regression'),

  // Non-parametric Tests
  'Mann-Whitney U': MannWhitneyLauncher,
  'Wilcoxon Signed-Rank': L('wilcoxon_signed_rank'),
  'Kruskal-Wallis H': KruskalLauncher,
  'Independent Samples T-Test': IndependentTLauncher,
  'Paired Samples T-Test': PairedTLauncher,
  'Friedman Test': L('friedman'),
  'Sign Test': L('sign_test'),
  'Runs Test': L('runs_test'),
  'Kolmogorov-Smirnov': L('kolmogorov_smirnov'),

  // Advanced Analytics
  'Factor Analysis': U('Factor analysis'),
  'Reliability Analysis': L('reliability_cronbach'),
  'Multidimensional Scaling (MDS)': L('multidimensional_scaling'),
  'Correspondence Analysis': U('Correspondence analysis'),
  'Survival Analysis': U('Survival analysis'),
  'Time Series Analysis': U('Time series analysis'),
  'Mixed Models': U('Mixed models'),
  'Hierarchical Linear Modeling': U('Hierarchical linear modeling'),
  'Structural Equation Modeling': U('Structural equation modeling'),
  'Path Analysis': U('Path analysis'),
  'Confirmatory Factor Analysis': U('Confirmatory factor analysis'),

  // Machine Learning
  Classification: L('decision_tree'),
  Regression: U('Machine learning regression'),
  'Ensemble Methods': U('Ensemble methods'),
  'Support Vector Machines': U('Support vector machines'),
  'Neural Networks': U('Neural networks'),
  'Random Forest': U('Random forest'),
  'Gradient Boosting': U('Gradient boosting'),
  'Dimensionality Reduction': U('Dimensionality reduction'),
  'Association Rules': U('Association rules'),
  'Anomaly Detection': U('Anomaly detection'),
  'Topic Modeling': U('Topic modeling'),
  'Market Basket Analysis': U('Market basket analysis'),
  'Model Selection': U('Model selection'),
  'Hyperparameter Tuning': U('Hyperparameter tuning'),
  'Cross-validation': U('Cross-validation'),
  'Model Evaluation': U('Model evaluation'),
  'Model Deployment': U('Model deployment'),
  'A/B Testing': U('A/B testing'),

  // Data Visualization
  'Data Visualization': U('Data visualization'),
  'Bar Charts': U('Visualization'),
  'Pie Charts': U('Visualization'),
  'Line Charts': U('Visualization'),
  'Area Charts': U('Visualization'),
  'Dot Plots': U('Visualization'),
  Histograms: U('Visualization'),
  Boxplots: U('Visualization'),
  'Violin Plots': U('Visualization'),
  Scatterplots: U('Visualization'),
  '3D Scatterplots': U('Visualization'),
  'Density Plots': U('Visualization'),
  'Frequency Polygons': U('Visualization'),
  'Error Bars': U('Visualization'),
  'Time Series Plots': U('Visualization'),
  'Control Charts': U('Visualization'),
  'Survival Curves': U('Visualization'),
  'ROC Curves': U('Visualization'),
  'Q-Q Plots': U('Visualization'),
  'P-P Plots': U('Visualization'),

  // Data Operations
  'Import Data': LazyFilePickerWrapper,
  'Export Data': ExportDialog,
  'Standardize Values': U('Standardize Values'),
  'Data Quality Report': U('Data Quality Report'),
  'Compute Variable': ComputeVariablesDialog,
  'Count Values': CountValuesDialog,
  'Shift Values': ShiftValuesDialog,

  // Transform Operations
  'Create Dummy Variables': ComputeVariablesDialog,
  'Create New Variables': ComputeVariablesDialog,
  'Reshape Data': ComputeVariablesDialog,
  'Aggregate Data': ComputeVariablesDialog,
  'Transpose Data': ComputeVariablesDialog,
  'Sample Data': ComputeVariablesDialog,
  'Feature Engineering': ComputeVariablesDialog,
  'String Functions': ComputeVariablesDialog,
  'Date/Time Functions': ComputeVariablesDialog,
  'Weight Cases': ComputeVariablesDialog,
  'Split Files': ComputeVariablesDialog,
  'Propensity Matching': ComputeVariablesDialog,
  'Case Control Matching': ComputeVariablesDialog,
  'Rake Weights': ComputeVariablesDialog,
  'Text Processing': ComputeVariablesDialog,
  'Conditional Logic': ComputeVariablesDialog,
  'Percentile Calculations': ComputeVariablesDialog,
  'Automatic Recode': U('Automatic recode'),
  'Extended Recode': U('Extended recode'),
  'Rank Cases': U('Rank'),
  'Lag Cases': U('Lag'),
  'Lead Cases': U('Lead'),
  'Random Number Generator': ComputeVariablesDialog,
  'Create Time Series': U('Time series'),
  'Date and Time Wizard': U('Time series'),
  'Replace Missing Values': U('Replace Missing Values'),
  'Time Intervals': U('Time series'),
  'Seasonal Adjustments': U('Time series'),
  'Restructure Data': ComputeVariablesDialog,
  'Stack/Unstack': ComputeVariablesDialog,
  'Split/Combine': ComputeVariablesDialog,
  'Merge Files': U('Merge Files'),
  'Add Cases': U('Add Cases'),
  'Add Variables': U('Add Variables'),
  'Match Files': U('Match Files'),

  // Syntax
  'Syntax Editor': U('Visualization'),
  'Command Language': U('Visualization'),
  Macros: U('Visualization'),
  Scripts: U('Visualization'),
  'Batch Processing': U('Visualization'),
  'Syntax Validation': U('Visualization'),
  'Reproducible Analysis': U('Visualization'),
  'Version Control': U('Visualization'),
  'Template Creation': U('Visualization'),
  'Batch Jobs': U('Visualization'),
  'Scheduled Tasks': U('Visualization'),

  // Utilities
  'Variable Sets': U('Visualization'),
  'Variable Properties': U('Visualization'),
  'Variable Groups': U('Visualization'),
  'Measurement Levels': U('Visualization'),
  'Value Labels': U('Visualization'),
  'Table Appearance': U('Visualization'),
  'Output Formatting': U('Visualization'),
  'Export Settings': ExportDialog,
  'Report Templates': U('Visualization'),
  'Automated Reporting': U('Visualization'),
  'Interactive Dashboards': U('Visualization'),
  'Save Chart Template': U('Visualization'),
  'Load Template': U('Visualization'),
  'Manage Templates': U('Visualization'),
  'Theme Management': U('Visualization'),
  'Color Palettes': U('Visualization'),
  'Run Script': U('Visualization'),
  'Scoring Rules': U('Visualization'),
  'Workflow Automation': U('Visualization'),
  'Task Scheduling': U('Visualization'),
  'Multi-user Access': U('Visualization'),
  'Role-based Permissions': U('Visualization'),
  'Sharing Results': U('Visualization'),
  'Team Workspaces': U('Visualization'),
} as const;

export const MENU_ITEMS: MenuItems = PRODUCTION_MENU_ITEMS;
