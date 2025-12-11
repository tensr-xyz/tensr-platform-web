import { DatasetContext, Message, AnalysisTask } from '@/types/agent';

export interface ContextBuilderOptions {
  maxHistoryLength?: number;
  includeSampleData?: boolean;
  includeColumnStats?: boolean;
  includeDataQuality?: boolean;
  truncateLongValues?: boolean;
}

export interface BuiltContext {
  datasetSummary: string;
  columnDetails: string;
  sampleData: string;
  dataQuality: string;
  conversationSummary: string;
  analysisContext?: string;
}

export class AgentContextBuilder {
  private options: Required<ContextBuilderOptions>;

  constructor(options: Partial<ContextBuilderOptions> = {}) {
    this.options = {
      maxHistoryLength: 10,
      includeSampleData: true,
      includeColumnStats: true,
      includeDataQuality: true,
      truncateLongValues: true,
      ...options,
    };
  }

  /**
   * Build comprehensive context for agent prompts
   */
  buildContext(
    dataset: DatasetContext,
    conversationHistory: Message[],
    selectedAnalysis?: AnalysisTask
  ): BuiltContext {
    return {
      datasetSummary: this.buildDatasetSummary(dataset),
      columnDetails: this.buildColumnDetails(dataset),
      sampleData: this.buildSampleData(dataset),
      dataQuality: this.buildDataQualitySummary(dataset),
      conversationSummary: this.buildConversationSummary(conversationHistory),
      analysisContext: selectedAnalysis
        ? this.buildAnalysisContext(selectedAnalysis, dataset)
        : undefined,
    };
  }

  /**
   * Build dataset overview summary
   */
  private buildDatasetSummary(dataset: DatasetContext): string {
    const { totalRows, totalColumns, schema } = dataset;

    const numericColumns = schema.filter(col => col.dataType === 'numeric').length;
    const categoricalColumns = schema.filter(
      col => col.dataType === 'categorical' || col.dataType === 'binary'
    ).length;
    const textColumns = schema.filter(col => col.dataType === 'text').length;

    return `Dataset Overview:
- Total rows: ${totalRows.toLocaleString()}
- Total columns: ${totalColumns}
- Numeric columns: ${numericColumns}
- Categorical columns: ${categoricalColumns}
- Text columns: ${textColumns}`;
  }

  /**
   * Build detailed column information
   */
  private buildColumnDetails(dataset: DatasetContext): string {
    const { schema, columnStats } = dataset;

    return schema
      .map(col => {
        const stats = columnStats[col.name];
        let details = `- **${col.name}** (${col.dataType}): ${col.uniqueValues} unique values, ${col.missingPercentage}% missing`;

        if (stats?.numeric) {
          const num = stats.numeric;
          details += `\n  - Range: ${num.min} to ${num.max}, Mean: ${num.mean.toFixed(2)}, Std: ${num.std.toFixed(2)}`;
        }

        if (stats?.categorical && stats.categorical.topValues.length > 0) {
          const top = stats.categorical.topValues[0];
          details += `\n  - Most common: "${top.value}" (${top.percentage}%)`;
        }

        return details;
      })
      .join('\n');
  }

  /**
   * Build sample data representation
   */
  private buildSampleData(dataset: DatasetContext): string {
    if (!this.options.includeSampleData || !dataset.sampleData.length) {
      return '';
    }

    const sampleRows = dataset.sampleData.slice(0, 3);
    const columns = dataset.schema.map(col => col.name);

    let sampleText = '\nSample Data (first 3 rows):\n';

    sampleRows.forEach((row, index) => {
      sampleText += `Row ${index + 1}:\n`;
      columns.forEach(col => {
        const value = row[col];
        const displayValue =
          this.options.truncateLongValues && typeof value === 'string' && value.length > 50
            ? value.substring(0, 50) + '...'
            : value;
        sampleText += `  ${col}: ${displayValue}\n`;
      });
      sampleText += '\n';
    });

    return sampleText;
  }

  /**
   * Build data quality summary
   */
  private buildDataQualitySummary(dataset: DatasetContext): string {
    if (!this.options.includeDataQuality) {
      return '';
    }

    const { dataQuality, schema } = dataset;

    let qualityText = `\nData Quality Assessment:\n`;
    qualityText += `- Overall Score: ${dataQuality.overall}/100\n`;
    qualityText += `- Completeness: ${dataQuality.completeness.toFixed(1)}%\n`;
    qualityText += `- Consistency: ${dataQuality.consistency}%\n`;
    qualityText += `- Accuracy: ${dataQuality.accuracy}%\n`;

    // Identify potential issues
    const highMissingColumns = schema.filter(col => col.missingPercentage > 20);
    const lowCardinalityColumns = schema.filter(
      col => col.uniqueValues < 5 && col.dataType === 'text'
    );

    if (highMissingColumns.length > 0) {
      qualityText += `\n⚠️  High missing data in: ${highMissingColumns.map(col => col.name).join(', ')}\n`;
    }

    if (lowCardinalityColumns.length > 0) {
      qualityText += `\n💡  Low cardinality columns (consider categorical): ${lowCardinalityColumns.map(col => col.name).join(', ')}\n`;
    }

    return qualityText;
  }

  /**
   * Build conversation history summary
   */
  private buildConversationSummary(conversationHistory: Message[]): string {
    if (!conversationHistory.length) {
      return '';
    }

    const recentMessages = conversationHistory.slice(-this.options.maxHistoryLength);

    let summary = '\nRecent Conversation Context:\n';
    recentMessages.forEach((msg, index) => {
      const role = msg.role === 'user' ? 'User' : 'Assistant';
      const content =
        this.options.truncateLongValues && msg.content.length > 100
          ? msg.content.substring(0, 100) + '...'
          : msg.content;
      summary += `${index + 1}. ${role}: ${content}\n`;
    });

    return summary;
  }

  /**
   * Build analysis-specific context
   */
  private buildAnalysisContext(analysis: AnalysisTask, dataset: DatasetContext): string {
    const { schema, totalRows } = dataset;

    let context = `\nAnalysis Context for ${analysis.name}:\n`;
    context += `- Analysis Type: ${analysis.category}\n`;
    context += `- Complexity: ${analysis.complexity}\n`;
    context += `- Estimated Time: ${analysis.estimatedTime} seconds\n`;
    context += `- Required Libraries: ${analysis.libraries.join(', ')}\n`;

    // Check data requirements
    const numericColumns = schema.filter(col => col.dataType === 'numeric');
    const categoricalColumns = schema.filter(
      col => col.dataType === 'categorical' || col.dataType === 'binary'
    );

    context += `\nData Compatibility:\n`;
    context += `- Sample size: ${totalRows} rows (required: ${analysis.dataRequirements.minSampleSize})\n`;
    context += `- Numeric columns available: ${numericColumns.length}\n`;
    context += `- Categorical columns available: ${categoricalColumns.length}\n`;

    // Check assumptions
    if (analysis.dataRequirements.assumptions.length > 0) {
      context += `\nKey Assumptions:\n`;
      analysis.dataRequirements.assumptions.forEach(assumption => {
        context += `- ${assumption}\n`;
      });
    }

    return context;
  }

  /**
   * Build a complete prompt with injected context
   */
  buildPromptWithContext(
    basePrompt: string,
    dataset: DatasetContext,
    conversationHistory: Message[],
    selectedAnalysis?: AnalysisTask
  ): string {
    const context = this.buildContext(dataset, conversationHistory, selectedAnalysis);

    let prompt = basePrompt;

    // Replace context placeholders
    prompt = prompt.replace('{{dataset_summary}}', context.datasetSummary);
    prompt = prompt.replace('{{column_details}}', context.columnDetails);
    prompt = prompt.replace('{{sample_data}}', context.sampleData);
    prompt = prompt.replace('{{data_quality}}', context.dataQuality);
    prompt = prompt.replace('{{conversation_summary}}', context.conversationSummary);

    if (context.analysisContext) {
      prompt = prompt.replace('{{analysis_context}}', context.analysisContext);
    }

    return prompt;
  }

  /**
   * Build a concise context summary for token-limited scenarios
   */
  buildConciseContext(dataset: DatasetContext): string {
    const { totalRows, totalColumns, schema } = dataset;
    const numericCols = schema.filter(col => col.dataType === 'numeric').length;
    const categoricalCols = schema.filter(
      col => col.dataType === 'categorical' || col.dataType === 'binary'
    ).length;

    return `Dataset: ${totalRows} rows × ${totalColumns} cols (${numericCols} numeric, ${categoricalCols} categorical). Quality: ${dataset.dataQuality.overall}/100.`;
  }

  /**
   * Validate if dataset meets analysis requirements
   */
  validateAnalysisRequirements(
    analysis: AnalysisTask,
    dataset: DatasetContext
  ): {
    isValid: boolean;
    issues: string[];
    warnings: string[];
  } {
    const issues: string[] = [];
    const warnings: string[] = [];

    // Check sample size
    if (dataset.totalRows < analysis.dataRequirements.minSampleSize) {
      issues.push(
        `Insufficient sample size: ${dataset.totalRows} rows (required: ${analysis.dataRequirements.minSampleSize})`
      );
    }

    // Check data types
    const availableTypes = new Set(dataset.schema.map(col => col.dataType));
    const missingTypes = analysis.dataRequirements.requiredDataTypes.filter(
      type => !availableTypes.has(type)
    );

    if (missingTypes.length > 0) {
      issues.push(`Missing required data types: ${missingTypes.join(', ')}`);
    }

    // Check for warnings
    if (dataset.dataQuality.overall < 70) {
      warnings.push(
        `Low data quality score (${dataset.dataQuality.overall}/100) may affect analysis reliability`
      );
    }

    const highMissingColumns = dataset.schema.filter(col => col.missingPercentage > 30);
    if (highMissingColumns.length > 0) {
      warnings.push(
        `High missing data in columns: ${highMissingColumns.map(col => col.name).join(', ')}`
      );
    }

    return {
      isValid: issues.length === 0,
      issues,
      warnings,
    };
  }
}

// Export singleton instance
export const agentContextBuilder = new AgentContextBuilder();

// Export convenience functions
export const buildAgentContext = (
  dataset: DatasetContext,
  conversationHistory: Message[],
  selectedAnalysis?: AnalysisTask
) => agentContextBuilder.buildContext(dataset, conversationHistory, selectedAnalysis);

export const buildPromptWithContext = (
  basePrompt: string,
  dataset: DatasetContext,
  conversationHistory: Message[],
  selectedAnalysis?: AnalysisTask
) =>
  agentContextBuilder.buildPromptWithContext(
    basePrompt,
    dataset,
    conversationHistory,
    selectedAnalysis
  );

export const validateAnalysisRequirements = (analysis: AnalysisTask, dataset: DatasetContext) =>
  agentContextBuilder.validateAnalysisRequirements(analysis, dataset);
