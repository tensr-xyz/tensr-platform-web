import { useMemo } from 'react';
import { useTabsStore } from '@/stores/tabs-store';
import { DatasetContext, AnalysisTask, findAnalysesByIntent, DataType } from '@/types/agent';

export const useAgentContext = () => {
  const { tabs, activeTabId } = useTabsStore();

  // Get active tab data
  const activeTab = useMemo(() => tabs.find(tab => tab.id === activeTabId), [tabs, activeTabId]);

  // Build comprehensive dataset context
  const datasetContext = useMemo((): DatasetContext | null => {
    if (!activeTab?.data?.initialData || !activeTab?.data?.initialColumns) {
      return null;
    }

    const data = activeTab.data.initialData;
    const columns = activeTab.data.initialColumns;

    // Calculate comprehensive column statistics
    const columnStats: Record<string, any> = {};
    const schema = columns.map((col: any) => {
      const values = data.map((row: any) => row[col.header]);
      const uniqueValues = new Set(values).size;
      const missingCount = values.filter(
        (v: any) => v === null || v === undefined || v === ''
      ).length;
      const missingPercentage = (missingCount / values.length) * 100;

      // Enhanced data type detection
      let dataType: DataType = 'text';
      if (values.every((v: any) => typeof v === 'number' || !isNaN(Number(v)))) {
        dataType = 'numeric';
      } else if (uniqueValues <= 2) {
        dataType = 'binary';
      } else if (uniqueValues <= 10) {
        dataType = 'categorical';
      } else if (
        values.some((v: any) => v && typeof v === 'string' && v.match(/^\d{4}-\d{2}-\d{2}/))
      ) {
        dataType = 'datetime';
      }

      // Calculate comprehensive numeric stats
      if (dataType === 'numeric') {
        const numericValues = values.map((v: any) => Number(v)).filter((v: any) => !isNaN(v));
        if (numericValues.length > 0) {
          const sorted = numericValues.sort((a: number, b: number) => a - b);
          const mean =
            numericValues.reduce((a: number, b: number) => a + b, 0) / numericValues.length;
          const variance =
            numericValues.reduce((sq: number, n: number) => sq + Math.pow(n - mean, 2), 0) /
            numericValues.length;

          columnStats[col.header] = {
            numeric: {
              mean: Math.round(mean * 1000) / 1000,
              median: sorted[Math.floor(sorted.length / 2)],
              std: Math.round(Math.sqrt(variance) * 1000) / 1000,
              min: Math.min(...numericValues),
              max: Math.max(...numericValues),
              q1: sorted[Math.floor(sorted.length * 0.25)],
              q3: sorted[Math.floor(sorted.length * 0.75)],
              skewness: calculateSkewness(numericValues, mean, Math.sqrt(variance)),
              kurtosis: calculateKurtosis(numericValues, mean, Math.sqrt(variance)),
            },
          };
        }
      }

      // Calculate categorical stats
      if (dataType === 'categorical' || dataType === 'binary') {
        const valueCounts = values.reduce((acc: Record<string, number>, val: any) => {
          if (val !== null && val !== undefined && val !== '') {
            acc[val] = (acc[val] || 0) + 1;
          }
          return acc;
        }, {});

        const topValues = Object.entries(valueCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([value, count]) => ({
            value,
            count,
            percentage: Math.round((count / values.length) * 1000) / 10,
          }));

        columnStats[col.header] = {
          categorical: {
            topValues,
            entropy: calculateEntropy(valueCounts, values.length),
            giniIndex: calculateGiniIndex(valueCounts, values.length),
          },
        };
      }

      return {
        name: col.header,
        dataType,
        uniqueValues,
        missingCount,
        missingPercentage: Math.round(missingPercentage * 100) / 100,
      };
    });

    // Calculate data quality metrics
    const qualityMetrics = calculateDataQuality(schema, data);

    // Detect potential data quality issues
    const dataQualityIssues = detectDataQualityIssues(schema, data, qualityMetrics);

    return {
      schema,
      sampleData: data.slice(0, 5), // First 5 rows for context
      columnStats,
      dataQuality: qualityMetrics,
      totalRows: data.length,
      totalColumns: columns.length,
    };
  }, [activeTab]);

  // Get suggested analyses based on current dataset
  const suggestedAnalyses = useMemo(() => {
    if (!datasetContext) return [];

    // Suggest analyses based on data characteristics
    const suggestions: AnalysisTask[] = [];

    // Always suggest descriptive stats
    suggestions.push({
      id: 'descriptive_stats',
      name: 'Descriptive Statistics',
      category: 'descriptive',
      description: 'Basic summary statistics for your data',
      dataRequirements: {
        minSampleSize: 1,
        requiredDataTypes: ['numeric'],
        assumptions: [],
        missingDataHandling: 'remove',
        outlierHandling: 'include',
      },
      userIntents: ['summarize', 'overview', 'basic stats'],
      outputFormats: [],
      complexity: 'basic',
      estimatedTime: 5,
      libraries: ['pandas', 'numpy'],
    } as AnalysisTask);

    // Suggest correlation analysis if multiple numeric columns
    const numericColumns = datasetContext.schema.filter(col => col.dataType === 'numeric');
    if (numericColumns.length >= 2) {
      suggestions.push({
        id: 'correlation_analysis',
        name: 'Correlation Analysis',
        category: 'correlation',
        description: 'Find relationships between numeric variables',
        dataRequirements: {
          minSampleSize: 10,
          requiredDataTypes: ['numeric'],
          assumptions: [],
          missingDataHandling: 'remove',
          outlierHandling: 'include',
        },
        userIntents: ['relationships', 'correlations', 'patterns'],
        outputFormats: [],
        complexity: 'basic',
        estimatedTime: 8,
        libraries: ['pandas', 'numpy', 'seaborn'],
      } as AnalysisTask);
    }

    // Suggest clustering if enough data points
    if (datasetContext.totalRows >= 20 && numericColumns.length >= 2) {
      suggestions.push({
        id: 'clustering',
        name: 'Clustering Analysis',
        category: 'clustering',
        description: 'Group similar data points together',
        dataRequirements: {
          minSampleSize: 20,
          requiredDataTypes: ['numeric'],
          assumptions: [],
          missingDataHandling: 'impute',
          outlierHandling: 'remove',
        },
        userIntents: ['clusters', 'groups', 'segments'],
        outputFormats: [],
        complexity: 'intermediate',
        estimatedTime: 20,
        libraries: ['scikit-learn', 'pandas', 'matplotlib'],
      } as AnalysisTask);
    }

    return suggestions;
  }, [datasetContext]);

  // Check if dataset is ready for analysis
  const isDatasetReady = useMemo(() => {
    if (!datasetContext) return false;

    // Check for critical data quality issues
    const hasTooManyMissingValues = datasetContext.schema.some(col => col.missingPercentage > 50);

    return !hasTooManyMissingValues;
  }, [datasetContext]);

  // Get preprocessing recommendations
  const preprocessingRecommendations = useMemo(() => {
    if (!datasetContext) return [];

    const recommendations: string[] = [];

    // Check for missing data
    const columnsWithMissingData = datasetContext.schema.filter(col => col.missingPercentage > 0);
    if (columnsWithMissingData.length > 0) {
      recommendations.push(
        `Handle missing data in ${columnsWithMissingData.length} columns (${columnsWithMissingData.map(col => col.name).join(', ')})`
      );
    }

    // Check for data type mismatches
    const potentialTypeIssues = datasetContext.schema.filter(
      col => col.dataType === 'text' && col.uniqueValues < 20
    );
    if (potentialTypeIssues.length > 0) {
      recommendations.push(
        `Consider converting ${potentialTypeIssues.length} columns to categorical: ${potentialTypeIssues.map(col => col.name).join(', ')}`
      );
    }

    // Check for outliers in numeric columns
    const numericColumns = datasetContext.schema.filter(col => col.dataType === 'numeric');
    if (numericColumns.length > 0) {
      recommendations.push(
        'Check for outliers in numeric columns and decide on treatment strategy'
      );
    }

    return recommendations;
  }, [datasetContext]);

  return {
    datasetContext,
    suggestedAnalyses,
    isDatasetReady,
    preprocessingRecommendations,
    activeTab,
  };
};

// Helper functions for statistical calculations
function calculateSkewness(values: number[], mean: number, std: number): number {
  if (std === 0) return 0;
  const n = values.length;
  const skewness = values.reduce((sum, val) => sum + Math.pow((val - mean) / std, 3), 0) / n;
  return Math.round(skewness * 1000) / 1000;
}

function calculateKurtosis(values: number[], mean: number, std: number): number {
  if (std === 0) return 0;
  const n = values.length;
  const kurtosis = values.reduce((sum, val) => sum + Math.pow((val - mean) / std, 4), 0) / n - 3;
  return Math.round(kurtosis * 1000) / 1000;
}

function calculateEntropy(valueCounts: Record<string, number>, total: number): number {
  return -Object.values(valueCounts).reduce((sum, count) => {
    const p = count / total;
    return sum + p * Math.log2(p);
  }, 0);
}

function calculateGiniIndex(valueCounts: Record<string, number>, total: number): number {
  const probabilities = Object.values(valueCounts).map(count => count / total);
  return 1 - probabilities.reduce((sum, p) => sum + p * p, 0);
}

function calculateDataQuality(schema: any[], data: any[]) {
  const totalColumns = schema.length;
  const totalRows = data.length;

  // Completeness score
  const missingDataScore =
    schema.reduce((sum, col) => {
      const missingPercentage = col.missingPercentage;
      if (missingPercentage === 0) return sum + 100;
      if (missingPercentage <= 5) return sum + 95;
      if (missingPercentage <= 10) return sum + 90;
      if (missingPercentage <= 20) return sum + 80;
      if (missingPercentage <= 50) return sum + 50;
      return sum + 20;
    }, 0) / totalColumns;

  // Consistency score (simplified)
  const consistencyScore = 90; // Placeholder - could be enhanced with actual consistency checks

  // Accuracy score (simplified)
  const accuracyScore = 95; // Placeholder - could be enhanced with validation rules

  // Overall score
  const overallScore = Math.round((missingDataScore + consistencyScore + accuracyScore) / 3);

  return {
    overall: overallScore,
    completeness: Math.round(missingDataScore),
    consistency: consistencyScore,
    accuracy: accuracyScore,
    issues: [],
  };
}

function detectDataQualityIssues(schema: any[], data: any[], qualityMetrics: any) {
  const issues: any[] = [];

  // Check for high missing data
  schema.forEach(col => {
    if (col.missingPercentage > 20) {
      issues.push({
        type: 'missing_data',
        severity: col.missingPercentage > 50 ? 'high' : 'medium',
        description: `Column '${col.name}' has ${col.missingPercentage}% missing values`,
        affectedColumns: [col.name],
      });
    }
  });

  // Check for potential data type issues
  schema.forEach(col => {
    if (col.dataType === 'string' && col.uniqueValues < 20 && col.uniqueValues > 2) {
      issues.push({
        type: 'inconsistency',
        severity: 'low',
        description: `Column '${col.name}' might be better as categorical (${col.uniqueValues} unique values)`,
        affectedColumns: [col.name],
      });
    }
  });

  // Check for small sample sizes
  if (data.length < 30) {
    issues.push({
      type: 'data_quality',
      severity: 'medium',
      description: `Small sample size (${data.length} rows) may limit statistical power`,
      affectedColumns: [],
    });
  }

  return issues;
}
