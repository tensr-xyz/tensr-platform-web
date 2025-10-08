import { DatasetContext, ColumnInfo, DataQualityScore, DataQualityIssue } from '@/types/agent';

export interface ProfilingResult {
  summary: DatasetSummary;
  columnProfiles: ColumnProfile[];
  dataQuality: EnhancedDataQualityScore;
  insights: DataInsight[];
  recommendations: DataRecommendation[];
}

export interface DatasetSummary {
  totalRows: number;
  totalColumns: number;
  memoryEstimate: string;
  dataTypes: Record<string, number>;
  missingDataOverview: MissingDataOverview;
  potentialIssues: string[];
}

export interface ColumnProfile {
  name: string;
  dataType: string;
  statistics: ColumnStatistics;
  quality: ColumnQuality;
  insights: string[];
  recommendations: string[];
}

export interface ColumnStatistics {
  count: number;
  uniqueCount: number;
  missingCount: number;
  missingPercentage: number;
  numeric?: NumericStatistics;
  categorical?: CategoricalStatistics;
  text?: TextStatistics;
}

export interface NumericStatistics {
  mean: number;
  median: number;
  std: number;
  min: number;
  max: number;
  q1: number;
  q3: number;
  skewness: number;
  kurtosis: number;
  outliers: number;
  zeroCount: number;
  negativeCount: number;
}

export interface CategoricalStatistics {
  topValues: ValueFrequency[];
  entropy: number;
  giniIndex: number;
  cardinality: 'low' | 'medium' | 'high';
  mostCommonPercentage: number;
}

export interface TextStatistics {
  avgLength: number;
  minLength: number;
  maxLength: number;
  emptyStrings: number;
  whitespaceOnly: number;
  uniquePatterns: number;
}

export interface ColumnQuality {
  score: number;
  issues: string[];
  warnings: string[];
  suggestions: string[];
}

export interface MissingDataOverview {
  totalMissing: number;
  missingPercentage: number;
  columnsWithMissing: string[];
  missingPatterns: MissingPattern[];
}

export interface MissingPattern {
  type: 'random' | 'systematic' | 'complete';
  description: string;
  affectedColumns: string[];
  severity: 'low' | 'medium' | 'high';
}

export interface EnhancedDataQualityScore extends DataQualityScore {
  detailedBreakdown: {
    completeness: DetailedScore;
    consistency: DetailedScore;
    accuracy: DetailedScore;
    validity: DetailedScore;
    uniqueness: DetailedScore;
  };
}

export interface DetailedScore {
  score: number;
  weight: number;
  weightedScore: number;
  issues: string[];
  details: string;
}

export interface DataInsight {
  type: 'pattern' | 'anomaly' | 'opportunity' | 'warning';
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  confidence: number;
  affectedColumns?: string[];
}

export interface DataRecommendation {
  priority: 'low' | 'medium' | 'high';
  category: 'cleaning' | 'transformation' | 'analysis' | 'monitoring';
  title: string;
  description: string;
  effort: 'low' | 'medium' | 'high';
  expectedImpact: string;
  steps: string[];
}

export class DataProfiler {
  /**
   * Perform comprehensive data profiling
   */
  profileDataset(data: any[], columns: any[]): ProfilingResult {
    const columnProfiles = this.profileColumns(data, columns);
    const summary = this.buildDatasetSummary(data, columns, columnProfiles);
    const dataQuality = this.calculateDataQuality(columnProfiles);
    const insights = this.generateInsights(columnProfiles, dataQuality);
    const recommendations = this.generateRecommendations(columnProfiles, dataQuality, insights);

    return {
      summary,
      columnProfiles,
      dataQuality,
      insights,
      recommendations,
    };
  }

  /**
   * Profile individual columns
   */
  private profileColumns(data: any[], columns: any[]): ColumnProfile[] {
    return columns.map(col => {
      const values = data.map(row => row[col.header]);
      const statistics = this.calculateColumnStatistics(values, col);
      const quality = this.assessColumnQuality(statistics, col);
      const insights = this.generateColumnInsights(statistics, col);
      const recommendations = this.generateColumnRecommendations(statistics, quality, col);

      return {
        name: col.header,
        dataType: col.type || this.inferDataType(values),
        statistics,
        quality,
        insights,
        recommendations,
      };
    });
  }

  /**
   * Calculate comprehensive column statistics
   */
  private calculateColumnStatistics(values: any[], column: any): ColumnStatistics {
    const count = values.length;
    const uniqueValues = new Set(values);
    const uniqueCount = uniqueValues.size;
    const missingCount = values.filter(v => v === null || v === undefined || v === '').length;
    const missingPercentage = (missingCount / count) * 100;

    const baseStats: ColumnStatistics = {
      count,
      uniqueCount,
      missingCount,
      missingPercentage,
    };

    // Add type-specific statistics
    const dataType = this.inferDataType(values);
    if (dataType === 'numeric') {
      baseStats.numeric = this.calculateNumericStatistics(values);
    } else if (dataType === 'categorical' || dataType === 'binary') {
      baseStats.categorical = this.calculateCategoricalStatistics(values);
    } else if (dataType === 'string') {
      baseStats.text = this.calculateTextStatistics(values);
    }

    return baseStats;
  }

  /**
   * Calculate numeric statistics
   */
  private calculateNumericStatistics(values: any[]): NumericStatistics {
    const numericValues = values
      .map(v => Number(v))
      .filter(v => !isNaN(v) && v !== null && v !== undefined);

    if (numericValues.length === 0) {
      return {
        mean: 0,
        median: 0,
        std: 0,
        min: 0,
        max: 0,
        q1: 0,
        q3: 0,
        skewness: 0,
        kurtosis: 0,
        outliers: 0,
        zeroCount: 0,
        negativeCount: 0,
      };
    }

    const sorted = numericValues.sort((a, b) => a - b);
    const mean = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
    const variance =
      numericValues.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / numericValues.length;
    const std = Math.sqrt(variance);

    // Quartiles
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const median = sorted[Math.floor(sorted.length * 0.5)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];

    // Outliers (IQR method)
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    const outliers = numericValues.filter(v => v < lowerBound || v > upperBound).length;

    // Skewness and kurtosis
    const skewness = this.calculateSkewness(numericValues, mean, std);
    const kurtosis = this.calculateKurtosis(numericValues, mean, std);

    return {
      mean: Math.round(mean * 1000) / 1000,
      median,
      std: Math.round(std * 1000) / 1000,
      min: Math.min(...numericValues),
      max: Math.max(...numericValues),
      q1,
      q3,
      skewness: Math.round(skewness * 1000) / 1000,
      kurtosis: Math.round(kurtosis * 1000) / 1000,
      outliers,
      zeroCount: numericValues.filter(v => v === 0).length,
      negativeCount: numericValues.filter(v => v < 0).length,
    };
  }

  /**
   * Calculate categorical statistics
   */
  private calculateCategoricalStatistics(values: any[]): CategoricalStatistics {
    const valueCounts = values.reduce((acc: Record<string, number>, val: any) => {
      if (val !== null && val !== undefined && val !== '') {
        acc[val] = (acc[val] || 0) + 1;
      }
      return acc;
    }, {});

    const total = values.length;
    const topValues = Object.entries(valueCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([value, count]) => ({
        value,
        count,
        percentage: Math.round((count / total) * 1000) / 10,
      }));

    const entropy = this.calculateEntropy(valueCounts, total);
    const giniIndex = this.calculateGiniIndex(valueCounts, total);
    const mostCommonPercentage = topValues[0]?.percentage || 0;

    // Determine cardinality
    let cardinality: 'low' | 'medium' | 'high';
    if (Object.keys(valueCounts).length <= 5) cardinality = 'low';
    else if (Object.keys(valueCounts).length <= 20) cardinality = 'medium';
    else cardinality = 'high';

    return {
      topValues,
      entropy: Math.round(entropy * 1000) / 1000,
      giniIndex: Math.round(giniIndex * 1000) / 1000,
      cardinality,
      mostCommonPercentage,
    };
  }

  /**
   * Calculate text statistics
   */
  private calculateTextStatistics(values: any[]): TextStatistics {
    const textValues = values.filter(v => typeof v === 'string' && v !== null && v !== undefined);

    if (textValues.length === 0) {
      return {
        avgLength: 0,
        minLength: 0,
        maxLength: 0,
        emptyStrings: 0,
        whitespaceOnly: 0,
        uniquePatterns: 0,
      };
    }

    const lengths = textValues.map(v => v.length);
    const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const emptyStrings = textValues.filter(v => v === '').length;
    const whitespaceOnly = textValues.filter(v => v.trim() === '').length;
    const uniquePatterns = new Set(textValues.map(v => v.trim())).size;

    return {
      avgLength: Math.round(avgLength * 100) / 100,
      minLength: Math.min(...lengths),
      maxLength: Math.max(...lengths),
      emptyStrings,
      whitespaceOnly,
      uniquePatterns,
    };
  }

  /**
   * Assess column quality
   */
  private assessColumnQuality(stats: ColumnStatistics, column: any): ColumnQuality {
    const issues: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Missing data assessment
    if (stats.missingPercentage > 50) {
      issues.push(`High missing data (${stats.missingPercentage.toFixed(1)}%)`);
    } else if (stats.missingPercentage > 20) {
      warnings.push(`Moderate missing data (${stats.missingPercentage.toFixed(1)}%)`);
    }

    // Data type suggestions
    if (stats.dataType === 'string' && stats.uniqueCount < 20 && stats.uniqueCount > 2) {
      suggestions.push('Consider converting to categorical type');
    }

    // Numeric specific assessments
    if (stats.numeric) {
      if (stats.numeric.outliers > stats.count * 0.1) {
        warnings.push(`High number of outliers (${stats.numeric.outliers})`);
      }
      if (stats.numeric.skewness > 2 || stats.numeric.skewness < -2) {
        warnings.push(`Highly skewed distribution (skewness: ${stats.numeric.skewness})`);
      }
    }

    // Categorical specific assessments
    if (stats.categorical) {
      if (stats.categorical.mostCommonPercentage > 80) {
        warnings.push(
          `Low diversity - most common value represents ${stats.categorical.mostCommonPercentage}%`
        );
      }
    }

    // Calculate quality score
    let score = 100;
    score -= stats.missingPercentage * 0.5; // Missing data penalty
    if (issues.length > 0) score -= 20;
    if (warnings.length > 0) score -= 10;

    return {
      score: Math.max(0, Math.round(score)),
      issues,
      warnings,
      suggestions,
    };
  }

  /**
   * Generate column insights
   */
  private generateColumnInsights(stats: ColumnStatistics, column: any): string[] {
    const insights: string[] = [];

    if (stats.numeric) {
      if (stats.numeric.outliers > 0) {
        insights.push(`Contains ${stats.numeric.outliers} outliers that may need attention`);
      }
      if (Math.abs(stats.numeric.skewness) > 1) {
        insights.push(`Distribution is ${stats.numeric.skewness > 0 ? 'right' : 'left'}-skewed`);
      }
    }

    if (stats.categorical) {
      if (stats.categorical.cardinality === 'low') {
        insights.push('Low cardinality suggests this could be a good grouping variable');
      }
      if (stats.categorical.entropy > 2) {
        insights.push('High entropy indicates good distribution across categories');
      }
    }

    if (stats.text && stats.text.uniquePatterns < stats.count * 0.1) {
      insights.push('Low pattern diversity suggests potential for standardization');
    }

    return insights;
  }

  /**
   * Generate column recommendations
   */
  private generateColumnRecommendations(
    stats: ColumnStatistics,
    quality: ColumnQuality,
    column: any
  ): string[] {
    const recommendations: string[] = [];

    // Missing data recommendations
    if (stats.missingPercentage > 20) {
      recommendations.push('Consider imputation strategies or investigate missing data patterns');
    }

    // Data type recommendations
    if (stats.dataType === 'string' && stats.uniqueCount < 20) {
      recommendations.push('Convert to categorical type for better analysis performance');
    }

    // Outlier recommendations
    if (stats.numeric && stats.numeric.outliers > 0) {
      recommendations.push('Investigate outliers for data quality issues or business insights');
    }

    // Transformation recommendations
    if (stats.numeric && Math.abs(stats.numeric.skewness) > 1) {
      recommendations.push('Consider log or power transformations for skewed distributions');
    }

    return recommendations;
  }

  /**
   * Build dataset summary
   */
  private buildDatasetSummary(
    data: any[],
    columns: any[],
    columnProfiles: ColumnProfile[]
  ): DatasetSummary {
    const totalRows = data.length;
    const totalColumns = columns.length;
    const memoryEstimate = this.estimateMemoryUsage(data, columns);

    const dataTypes = columnProfiles.reduce(
      (acc, profile) => {
        acc[profile.dataType] = (acc[profile.dataType] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const missingDataOverview = this.analyzeMissingData(columnProfiles);
    const potentialIssues = this.identifyPotentialIssues(columnProfiles);

    return {
      totalRows,
      totalColumns,
      memoryEstimate,
      dataTypes,
      missingDataOverview,
      potentialIssues,
    };
  }

  /**
   * Calculate data quality score
   */
  private calculateDataQuality(columnProfiles: ColumnProfile[]): EnhancedDataQualityScore {
    const completeness = this.calculateCompletenessScore(columnProfiles);
    const consistency = this.calculateConsistencyScore(columnProfiles);
    const accuracy = this.calculateAccuracyScore(columnProfiles);
    const validity = this.calculateValidityScore(columnProfiles);
    const uniqueness = this.calculateUniquenessScore(columnProfiles);

    const overall = Math.round(
      (completeness.weightedScore +
        consistency.weightedScore +
        accuracy.weightedScore +
        validity.weightedScore +
        uniqueness.weightedScore) /
        5
    );

    return {
      overall,
      completeness: completeness.weightedScore,
      consistency: consistency.weightedScore,
      accuracy: accuracy.weightedScore,
      issues: [],
      detailedBreakdown: {
        completeness,
        consistency,
        accuracy,
        validity,
        uniqueness,
      },
    };
  }

  /**
   * Generate insights
   */
  private generateInsights(
    columnProfiles: ColumnProfile[],
    dataQuality: EnhancedDataQualityScore
  ): DataInsight[] {
    const insights: DataInsight[] = [];

    // Data quality insights
    if (dataQuality.overall < 70) {
      insights.push({
        type: 'warning',
        title: 'Low Data Quality',
        description: `Overall quality score is ${dataQuality.overall}/100. Consider data cleaning before analysis.`,
        impact: 'high',
        confidence: 0.9,
        affectedColumns: columnProfiles.filter(p => p.quality.score < 70).map(p => p.name),
      });
    }

    // Pattern insights
    const numericColumns = columnProfiles.filter(p => p.dataType === 'numeric');
    if (numericColumns.length >= 2) {
      insights.push({
        type: 'opportunity',
        title: 'Correlation Analysis Ready',
        description: `${numericColumns.length} numeric columns available for correlation analysis.`,
        impact: 'medium',
        confidence: 0.8,
      });
    }

    // Anomaly insights
    const highMissingColumns = columnProfiles.filter(p => p.statistics.missingPercentage > 30);
    if (highMissingColumns.length > 0) {
      insights.push({
        type: 'anomaly',
        title: 'High Missing Data',
        description: `${highMissingColumns.length} columns have >30% missing data.`,
        impact: 'medium',
        confidence: 0.9,
        affectedColumns: highMissingColumns.map(p => p.name),
      });
    }

    return insights;
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    columnProfiles: ColumnProfile[],
    dataQuality: EnhancedDataQualityScore,
    insights: DataInsight[]
  ): DataRecommendation[] {
    const recommendations: DataRecommendation[] = [];

    // Data cleaning recommendations
    if (dataQuality.overall < 80) {
      recommendations.push({
        priority: 'high',
        category: 'cleaning',
        title: 'Improve Data Quality',
        description: 'Address data quality issues before analysis',
        effort: 'medium',
        expectedImpact: 'High - will improve analysis reliability',
        steps: [
          'Handle missing data in high-missing columns',
          'Validate data types and convert as needed',
          'Check for and handle outliers',
          'Standardize text fields',
        ],
      });
    }

    // Analysis recommendations
    const numericColumns = columnProfiles.filter(p => p.dataType === 'numeric');
    if (numericColumns.length >= 2) {
      recommendations.push({
        priority: 'medium',
        category: 'analysis',
        title: 'Correlation Analysis',
        description: 'Explore relationships between numeric variables',
        effort: 'low',
        expectedImpact: 'Medium - discover variable relationships',
        steps: [
          'Generate correlation matrix',
          'Create scatter plots for strong correlations',
          'Identify multicollinearity issues',
        ],
      });
    }

    return recommendations;
  }

  // Helper methods
  private inferDataType(values: any[]): string {
    const nonNullValues = values.filter(v => v !== null && v !== undefined && v !== '');
    if (nonNullValues.length === 0) return 'string';

    const numericCount = nonNullValues.filter(v => !isNaN(Number(v))).length;
    const numericRatio = numericCount / nonNullValues.length;

    if (numericRatio > 0.8) return 'numeric';

    const uniqueCount = new Set(nonNullValues).size;
    if (uniqueCount <= 2) return 'binary';
    if (uniqueCount <= 20) return 'categorical';

    return 'string';
  }

  private calculateSkewness(values: number[], mean: number, std: number): number {
    if (std === 0) return 0;
    const n = values.length;
    return values.reduce((sum, val) => sum + Math.pow((val - mean) / std, 3), 0) / n;
  }

  private calculateKurtosis(values: number[], mean: number, std: number): number {
    if (std === 0) return 0;
    const n = values.length;
    return values.reduce((sum, val) => sum + Math.pow((val - mean) / std, 4), 0) / n - 3;
  }

  private calculateEntropy(valueCounts: Record<string, number>, total: number): number {
    return -Object.values(valueCounts).reduce((sum, count) => {
      const p = count / total;
      return sum + p * Math.log2(p);
    }, 0);
  }

  private calculateGiniIndex(valueCounts: Record<string, number>, total: number): number {
    const probabilities = Object.values(valueCounts).map(count => count / total);
    return 1 - probabilities.reduce((sum, p) => sum + p * p, 0);
  }

  private estimateMemoryUsage(data: any[], columns: any[]): string {
    const estimatedBytes = data.length * columns.length * 8; // Rough estimate
    if (estimatedBytes < 1024 * 1024) return `${Math.round(estimatedBytes / 1024)} KB`;
    return `${Math.round(estimatedBytes / (1024 * 1024))} MB`;
  }

  private analyzeMissingData(columnProfiles: ColumnProfile[]): MissingDataOverview {
    const totalMissing = columnProfiles.reduce((sum, p) => sum + p.statistics.missingCount, 0);
    const totalValues = columnProfiles.reduce((sum, p) => sum + p.statistics.count, 0);
    const missingPercentage = (totalMissing / totalValues) * 100;

    const columnsWithMissing = columnProfiles
      .filter(p => p.statistics.missingCount > 0)
      .map(p => p.name);

    const missingPatterns = this.identifyMissingPatterns(columnProfiles);

    return {
      totalMissing,
      missingPercentage: Math.round(missingPercentage * 100) / 100,
      columnsWithMissing,
      missingPatterns,
    };
  }

  private identifyMissingPatterns(columnProfiles: ColumnProfile[]): MissingPattern[] {
    const patterns: MissingPattern[] = [];

    // Check for systematic missing (same rows missing across columns)
    const highMissingColumns = columnProfiles.filter(p => p.statistics.missingPercentage > 20);
    if (highMissingColumns.length > 1) {
      patterns.push({
        type: 'systematic',
        description: 'Multiple columns have high missing data rates',
        affectedColumns: highMissingColumns.map(p => p.name),
        severity: 'medium',
      });
    }

    return patterns;
  }

  private identifyPotentialIssues(columnProfiles: ColumnProfile[]): string[] {
    const issues: string[] = [];

    columnProfiles.forEach(profile => {
      if (profile.quality.issues.length > 0) {
        issues.push(`${profile.name}: ${profile.quality.issues.join(', ')}`);
      }
    });

    return issues;
  }

  // Quality score calculation methods
  private calculateCompletenessScore(columnProfiles: ColumnProfile[]): DetailedScore {
    const avgMissingPercentage =
      columnProfiles.reduce((sum, p) => sum + p.statistics.missingPercentage, 0) /
      columnProfiles.length;
    const score = Math.max(0, 100 - avgMissingPercentage);

    return {
      score: Math.round(score),
      weight: 0.3,
      weightedScore: Math.round(score * 0.3),
      issues: avgMissingPercentage > 20 ? ['High missing data rate'] : [],
      details: `Average missing data: ${avgMissingPercentage.toFixed(1)}%`,
    };
  }

  private calculateConsistencyScore(columnProfiles: ColumnProfile[]): DetailedScore {
    // Simplified consistency check
    const score = 85; // Placeholder

    return {
      score,
      weight: 0.2,
      weightedScore: Math.round(score * 0.2),
      issues: [],
      details: 'Data format consistency assessment',
    };
  }

  private calculateAccuracyScore(columnProfiles: ColumnProfile[]): DetailedScore {
    // Simplified accuracy check
    const score = 90; // Placeholder

    return {
      score,
      weight: 0.2,
      weightedScore: Math.round(score * 0.2),
      issues: [],
      details: 'Data accuracy assessment',
    };
  }

  private calculateValidityScore(columnProfiles: ColumnProfile[]): DetailedScore {
    // Simplified validity check
    const score = 88; // Placeholder

    return {
      score,
      weight: 0.15,
      weightedScore: Math.round(score * 0.15),
      issues: [],
      details: 'Data validity assessment',
    };
  }

  private calculateUniquenessScore(columnProfiles: ColumnProfile[]): DetailedScore {
    // Simplified uniqueness check
    const score = 92; // Placeholder

    return {
      score,
      weight: 0.15,
      weightedScore: Math.round(score * 0.15),
      issues: [],
      details: 'Data uniqueness assessment',
    };
  }
}

// Export singleton instance
export const dataProfiler = new DataProfiler();

// Export convenience functions
export const profileDataset = (data: any[], columns: any[]) =>
  dataProfiler.profileDataset(data, columns);
