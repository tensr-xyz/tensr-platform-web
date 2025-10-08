// Agent System Types - Comprehensive Statistical Analysis Support

export interface AnalysisTask {
  id: string;
  name: string;
  category: AnalysisCategory;
  description: string;
  dataRequirements: DataRequirements;
  userIntents: string[];
  outputFormats: OutputFormat[];
  complexity: 'basic' | 'intermediate' | 'advanced';
  estimatedTime: number; // seconds
  libraries: string[];
}

export type AnalysisCategory =
  | 'descriptive'
  | 'correlation'
  | 'regression'
  | 'clustering'
  | 'hypothesis_testing'
  | 'time_series'
  | 'classification'
  | 'dimensionality_reduction'
  | 'distribution_analysis'
  | 'anova'
  | 'non_parametric';

export interface DataRequirements {
  minSampleSize: number;
  maxSampleSize?: number;
  requiredDataTypes: DataType[];
  optionalDataTypes?: DataType[];
  assumptions: string[];
  missingDataHandling: 'remove' | 'impute' | 'fail';
  outlierHandling: 'include' | 'remove' | 'flag';
}

export type DataType = 'numeric' | 'categorical' | 'ordinal' | 'binary' | 'datetime' | 'text';

export interface OutputFormat {
  type: 'table' | 'chart' | 'text' | 'model' | 'file';
  format: string;
  description: string;
}

export interface AnalysisRequest {
  taskId: string;
  dataset: DatasetContext;
  parameters: Record<string, any>;
  userQuery: string;
  conversationHistory: Message[];
}

export interface DatasetContext {
  schema: ColumnInfo[];
  sampleData: Record<string, any>[];
  columnStats: Record<string, ColumnStatistics>;
  dataQuality: DataQualityScore;
  totalRows: number;
  totalColumns: number;
}

export interface ColumnInfo {
  name: string;
  dataType: DataType;
  uniqueValues: number;
  missingCount: number;
  missingPercentage: number;
}

export interface ColumnStatistics {
  numeric?: NumericStats;
  categorical?: CategoricalStats;
  distribution?: DistributionInfo;
}

export interface NumericStats {
  mean: number;
  median: number;
  std: number;
  min: number;
  max: number;
  q1: number;
  q3: number;
  skewness: number;
  kurtosis: number;
}

export interface CategoricalStats {
  topValues: ValueFrequency[];
  entropy: number;
  giniIndex: number;
}

export interface ValueFrequency {
  value: string;
  count: number;
  percentage: number;
}

export interface DistributionInfo {
  type: 'normal' | 'skewed' | 'uniform' | 'bimodal' | 'unknown';
  confidence: number;
}

export interface DataQualityScore {
  overall: number; // 0-100
  completeness: number;
  consistency: number;
  accuracy: number;
  issues: DataQualityIssue[];
}

export interface DataQualityIssue {
  type: 'missing_data' | 'outliers' | 'inconsistency' | 'duplicates';
  severity: 'low' | 'medium' | 'high';
  description: string;
  affectedColumns: string[];
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  analysisTask?: string;
  codeGenerated?: string;
  resultsShown?: boolean;
  userFeedback?: 'positive' | 'negative' | 'neutral';
}

export interface AnalysisResult {
  taskId: string;
  success: boolean;
  outputs: AnalysisOutput[];
  executionTime: number;
  error?: string;
  warnings: string[];
  metadata: Record<string, any>;
}

export interface AnalysisOutput {
  type: 'table' | 'chart' | 'text' | 'model' | 'file';
  content: any;
  format: string;
  title: string;
  description: string;
}

// Comprehensive Analysis Tasks Definition
export const SUPPORTED_ANALYSES: AnalysisTask[] = [
  // DESCRIPTIVE STATISTICS
  {
    id: 'descriptive_stats',
    name: 'Descriptive Statistics',
    category: 'descriptive',
    description:
      'Calculate basic statistics (mean, median, std, min, max, quartiles) for numeric variables',
    dataRequirements: {
      minSampleSize: 1,
      requiredDataTypes: ['numeric'],
      assumptions: ['Data is numeric'],
      missingDataHandling: 'remove',
      outlierHandling: 'include',
    },
    userIntents: [
      'summarize data',
      'get basic stats',
      'understand distribution',
      'see data overview',
    ],
    outputFormats: [
      { type: 'table', format: 'html', description: 'Summary statistics table' },
      { type: 'chart', format: 'boxplot', description: 'Box plot showing distribution' },
      { type: 'text', format: 'markdown', description: 'Interpretation of results' },
    ],
    complexity: 'basic',
    estimatedTime: 5,
    libraries: ['pandas', 'numpy', 'matplotlib'],
  },

  // CORRELATION ANALYSIS
  {
    id: 'correlation_analysis',
    name: 'Correlation Analysis',
    category: 'correlation',
    description: 'Calculate correlation coefficients between numeric variables',
    dataRequirements: {
      minSampleSize: 10,
      requiredDataTypes: ['numeric'],
      assumptions: ['Linear relationships', 'Normally distributed variables'],
      missingDataHandling: 'remove',
      outlierHandling: 'include',
    },
    userIntents: [
      'find relationships',
      'correlation between variables',
      'see what correlates',
      'identify patterns',
    ],
    outputFormats: [
      { type: 'table', format: 'html', description: 'Correlation matrix' },
      { type: 'chart', format: 'heatmap', description: 'Correlation heatmap' },
      { type: 'chart', format: 'scatter', description: 'Scatter plot matrix' },
    ],
    complexity: 'basic',
    estimatedTime: 8,
    libraries: ['pandas', 'numpy', 'seaborn', 'matplotlib'],
  },

  // LINEAR REGRESSION
  {
    id: 'linear_regression',
    name: 'Linear Regression',
    category: 'regression',
    description: 'Fit linear regression model to predict dependent variable',
    dataRequirements: {
      minSampleSize: 30,
      requiredDataTypes: ['numeric'],
      assumptions: [
        'Linear relationship',
        'Independence',
        'Homoscedasticity',
        'Normality of residuals',
      ],
      missingDataHandling: 'remove',
      outlierHandling: 'flag',
    },
    userIntents: ['predict values', 'find trends', 'regression analysis', 'model relationships'],
    outputFormats: [
      { type: 'table', format: 'html', description: 'Regression coefficients and statistics' },
      { type: 'chart', format: 'scatter', description: 'Regression plot with line' },
      { type: 'chart', format: 'residuals', description: 'Residual plots' },
      { type: 'text', format: 'markdown', description: 'Model interpretation and significance' },
    ],
    complexity: 'intermediate',
    estimatedTime: 15,
    libraries: ['scikit-learn', 'statsmodels', 'pandas', 'matplotlib'],
  },

  // CLUSTERING (K-MEANS)
  {
    id: 'kmeans_clustering',
    name: 'K-Means Clustering',
    category: 'clustering',
    description: 'Group similar data points into clusters using K-means algorithm',
    dataRequirements: {
      minSampleSize: 20,
      requiredDataTypes: ['numeric'],
      assumptions: ['Variables are on similar scales', 'Clusters are spherical'],
      missingDataHandling: 'impute',
      outlierHandling: 'remove',
    },
    userIntents: ['group similar items', 'find clusters', 'segment data', 'identify patterns'],
    outputFormats: [
      { type: 'table', format: 'html', description: 'Cluster assignments and centroids' },
      { type: 'chart', format: 'scatter', description: 'Clusters visualization' },
      { type: 'chart', format: 'elbow', description: 'Elbow plot for optimal K' },
      { type: 'text', format: 'markdown', description: 'Cluster characteristics and insights' },
    ],
    complexity: 'intermediate',
    estimatedTime: 20,
    libraries: ['scikit-learn', 'pandas', 'matplotlib', 'seaborn'],
  },

  // HYPOTHESIS TESTING (T-TEST)
  {
    id: 't_test',
    name: 'T-Test',
    category: 'hypothesis_testing',
    description: 'Test for significant differences between groups or against a known value',
    dataRequirements: {
      minSampleSize: 15,
      requiredDataTypes: ['numeric'],
      assumptions: [
        'Normally distributed',
        'Independent observations',
        'Equal variances (for two-sample)',
      ],
      missingDataHandling: 'remove',
      outlierHandling: 'flag',
    },
    userIntents: [
      'test differences',
      'compare groups',
      'statistical significance',
      'hypothesis testing',
    ],
    outputFormats: [
      { type: 'table', format: 'html', description: 'Test statistics and p-values' },
      { type: 'chart', format: 'boxplot', description: 'Group comparison boxplots' },
      {
        type: 'text',
        format: 'markdown',
        description: 'Statistical interpretation and conclusions',
      },
    ],
    complexity: 'intermediate',
    estimatedTime: 12,
    libraries: ['scipy', 'pandas', 'matplotlib'],
  },

  // ANOVA
  {
    id: 'anova',
    name: 'Analysis of Variance (ANOVA)',
    category: 'anova',
    description: 'Test for significant differences between multiple groups',
    dataRequirements: {
      minSampleSize: 20,
      requiredDataTypes: ['numeric'],
      assumptions: ['Normally distributed', 'Independent observations', 'Equal variances'],
      missingDataHandling: 'remove',
      outlierHandling: 'flag',
    },
    userIntents: [
      'compare multiple groups',
      'ANOVA analysis',
      'group differences',
      'variance analysis',
    ],
    outputFormats: [
      { type: 'table', format: 'html', description: 'ANOVA table with F-statistics' },
      { type: 'chart', format: 'boxplot', description: 'Group comparison boxplots' },
      { type: 'chart', format: 'qqplot', description: 'Normality Q-Q plots' },
      {
        type: 'text',
        format: 'markdown',
        description: 'Statistical interpretation and post-hoc tests',
      },
    ],
    complexity: 'intermediate',
    estimatedTime: 18,
    libraries: ['scipy', 'statsmodels', 'pandas', 'matplotlib'],
  },

  // TIME SERIES ANALYSIS
  {
    id: 'time_series',
    name: 'Time Series Analysis',
    category: 'time_series',
    description: 'Analyze data with temporal patterns and trends',
    dataRequirements: {
      minSampleSize: 30,
      requiredDataTypes: ['numeric', 'datetime'],
      assumptions: ['Regular time intervals', 'Stationarity'],
      missingDataHandling: 'impute',
      outlierHandling: 'flag',
    },
    userIntents: ['analyze trends', 'time patterns', 'seasonal effects', 'forecasting'],
    outputFormats: [
      { type: 'chart', format: 'line', description: 'Time series plot' },
      {
        type: 'chart',
        format: 'decomposition',
        description: 'Trend, seasonal, residual decomposition',
      },
      { type: 'table', format: 'html', description: 'Autocorrelation and stationarity tests' },
      { type: 'text', format: 'markdown', description: 'Pattern identification and insights' },
    ],
    complexity: 'advanced',
    estimatedTime: 25,
    libraries: ['pandas', 'statsmodels', 'matplotlib', 'seaborn'],
  },

  // CLASSIFICATION
  {
    id: 'classification',
    name: 'Classification Analysis',
    category: 'classification',
    description: 'Build classification models to predict categorical outcomes',
    dataRequirements: {
      minSampleSize: 50,
      requiredDataTypes: ['numeric', 'categorical'],
      assumptions: ['Balanced classes', 'Sufficient features'],
      missingDataHandling: 'impute',
      outlierHandling: 'flag',
    },
    userIntents: [
      'predict categories',
      'classification model',
      'categorize data',
      'predict outcomes',
    ],
    outputFormats: [
      { type: 'table', format: 'html', description: 'Classification report and confusion matrix' },
      { type: 'chart', format: 'confusion_matrix', description: 'Confusion matrix heatmap' },
      { type: 'chart', format: 'roc', description: 'ROC curve and AUC' },
      { type: 'text', format: 'markdown', description: 'Model performance and feature importance' },
    ],
    complexity: 'advanced',
    estimatedTime: 30,
    libraries: ['scikit-learn', 'pandas', 'matplotlib', 'seaborn'],
  },

  // DIMENSIONALITY REDUCTION
  {
    id: 'pca',
    name: 'Principal Component Analysis (PCA)',
    category: 'dimensionality_reduction',
    description: 'Reduce data dimensionality while preserving variance',
    dataRequirements: {
      minSampleSize: 30,
      requiredDataTypes: ['numeric'],
      assumptions: ['Linear relationships', 'Correlated variables'],
      missingDataHandling: 'impute',
      outlierHandling: 'remove',
    },
    userIntents: ['reduce dimensions', 'find patterns', 'PCA analysis', 'dimensionality reduction'],
    outputFormats: [
      { type: 'table', format: 'html', description: 'Explained variance and component loadings' },
      { type: 'chart', format: 'scree', description: 'Scree plot of explained variance' },
      { type: 'chart', format: 'scatter', description: 'First two principal components' },
      { type: 'text', format: 'markdown', description: 'Component interpretation and insights' },
    ],
    complexity: 'advanced',
    estimatedTime: 20,
    libraries: ['scikit-learn', 'pandas', 'matplotlib', 'seaborn'],
  },

  // DISTRIBUTION ANALYSIS
  {
    id: 'distribution_analysis',
    name: 'Distribution Analysis',
    category: 'distribution_analysis',
    description: 'Analyze and test data distributions for normality and other properties',
    dataRequirements: {
      minSampleSize: 20,
      requiredDataTypes: ['numeric'],
      assumptions: ['Independent observations'],
      missingDataHandling: 'remove',
      outlierHandling: 'include',
    },
    userIntents: ['check normality', 'distribution shape', 'statistical tests', 'data properties'],
    outputFormats: [
      { type: 'chart', format: 'histogram', description: 'Histogram with normal curve overlay' },
      { type: 'chart', format: 'qqplot', description: 'Q-Q plot for normality testing' },
      { type: 'table', format: 'html', description: 'Normality test results' },
      { type: 'text', format: 'markdown', description: 'Distribution characteristics and tests' },
    ],
    complexity: 'basic',
    estimatedTime: 10,
    libraries: ['scipy', 'pandas', 'matplotlib', 'seaborn'],
  },

  // NON-PARAMETRIC TESTS
  {
    id: 'non_parametric',
    name: 'Non-Parametric Tests',
    category: 'non_parametric',
    description: "Statistical tests that don't require normal distribution assumptions",
    dataRequirements: {
      minSampleSize: 15,
      requiredDataTypes: ['numeric', 'ordinal'],
      assumptions: ['Independent observations', 'Continuous or ordinal data'],
      missingDataHandling: 'remove',
      outlierHandling: 'include',
    },
    userIntents: [
      'non-parametric test',
      'no normality assumption',
      'robust testing',
      'distribution-free',
    ],
    outputFormats: [
      { type: 'table', format: 'html', description: 'Test statistics and p-values' },
      { type: 'chart', format: 'boxplot', description: 'Group comparison visualizations' },
      { type: 'text', format: 'markdown', description: 'Test interpretation and conclusions' },
    ],
    complexity: 'intermediate',
    estimatedTime: 15,
    libraries: ['scipy', 'pandas', 'matplotlib'],
  },
];

// Helper functions
export const getAnalysisById = (id: string): AnalysisTask | undefined => {
  return SUPPORTED_ANALYSES.find(analysis => analysis.id === id);
};

export const getAnalysesByCategory = (category: AnalysisCategory): AnalysisTask[] => {
  return SUPPORTED_ANALYSES.filter(analysis => analysis.category === category);
};

export const getAnalysesByComplexity = (
  complexity: 'basic' | 'intermediate' | 'advanced'
): AnalysisTask[] => {
  return SUPPORTED_ANALYSES.filter(analysis => analysis.complexity === complexity);
};

export const findAnalysesByIntent = (userQuery: string): AnalysisTask[] => {
  const query = userQuery.toLowerCase();
  return SUPPORTED_ANALYSES.filter(analysis =>
    analysis.userIntents.some(
      intent => intent.toLowerCase().includes(query) || query.includes(intent.toLowerCase())
    )
  );
};
