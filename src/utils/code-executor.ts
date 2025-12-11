import { AnalysisTask, DatasetContext } from '@/types/agent';

export interface ExecutionOptions {
  timeout?: number;
  memoryLimit?: string;
  allowNetwork?: boolean;
  allowFileSystem?: boolean;
  maxOutputSize?: number;
  validateCode?: boolean;
}

export interface ExecutionResult {
  success: boolean;
  output?: any;
  stdout?: string;
  stderr?: string;
  error?: string;
  executionTime: number;
  memoryUsed?: string;
  warnings: string[];
  metadata: ExecutionMetadata;
}

export interface ExecutionMetadata {
  analysisType: string;
  librariesUsed: string[];
  codeSize: number;
  executionEnvironment: string;
  timestamp: string;
}

export interface CodeValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
  warnings: ValidationWarning[];
  suggestions: string[];
}

export interface ValidationIssue {
  type: 'security' | 'syntax' | 'performance' | 'best_practice';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  line?: number;
  column?: number;
  suggestion?: string;
}

export interface ValidationWarning {
  type: 'deprecation' | 'efficiency' | 'style';
  message: string;
  line?: number;
  suggestion?: string;
}

export class CodeExecutor {
  private defaultOptions: Required<ExecutionOptions> = {
    timeout: 30000, // 30 seconds
    memoryLimit: '512MB',
    allowNetwork: false,
    allowFileSystem: false,
    maxOutputSize: 10 * 1024 * 1024, // 10MB
    validateCode: true,
  };

  /**
   * Execute Python code with enhanced security and validation
   */
  async executePythonCode(
    code: string,
    analysisTask: AnalysisTask,
    datasetContext: DatasetContext,
    options: Partial<ExecutionOptions> = {}
  ): Promise<ExecutionResult> {
    const opts = { ...this.defaultOptions, ...options };
    const startTime = Date.now();

    try {
      // Validate code if enabled
      if (opts.validateCode) {
        const validation = this.validateCode(code, analysisTask, opts);
        if (!validation.isValid) {
          return {
            success: false,
            error: `Code validation failed: ${validation.issues.map(i => i.message).join(', ')}`,
            executionTime: Date.now() - startTime,
            warnings: validation.warnings.map(w => w.message),
            metadata: this.buildMetadata(analysisTask, code, 'python'),
          };
        }
      }

      // Prepare execution environment
      const executionCode = this.prepareExecutionCode(code, analysisTask, datasetContext);

      // Execute code using your existing infrastructure
      const result = await this.executeCode(executionCode, 'python', opts);

      // Process and validate output
      const processedResult = this.processExecutionResult(result, opts);

      return {
        ...processedResult,
        success: processedResult.success ?? true,
        warnings: processedResult.warnings ?? [],
        executionTime: Date.now() - startTime,
        metadata: this.buildMetadata(analysisTask, code, 'python'),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Code execution failed',
        executionTime: Date.now() - startTime,
        warnings: [],
        metadata: this.buildMetadata(analysisTask, code, 'python'),
      };
    }
  }

  /**
   * Execute R code with enhanced security and validation
   */
  async executeRCode(
    code: string,
    analysisTask: AnalysisTask,
    datasetContext: DatasetContext,
    options: Partial<ExecutionOptions> = {}
  ): Promise<ExecutionResult> {
    const opts = { ...this.defaultOptions, ...options };
    const startTime = Date.now();

    try {
      // Validate R code if enabled
      if (opts.validateCode) {
        const validation = this.validateRCode(code, analysisTask, opts);
        if (!validation.isValid) {
          return {
            success: false,
            error: `R code validation failed: ${validation.issues.map(i => i.message).join(', ')}`,
            executionTime: Date.now() - startTime,
            warnings: validation.warnings.map(w => w.message),
            metadata: this.buildMetadata(analysisTask, code, 'r'),
          };
        }
      }

      // Prepare execution environment
      const executionCode = this.prepareRExecutionCode(code, analysisTask, datasetContext);

      // Execute code using your existing infrastructure
      const result = await this.executeCode(executionCode, 'r', opts);

      // Process and validate output
      const processedResult = this.processExecutionResult(result, opts);

      return {
        ...processedResult,
        success: processedResult.success ?? true,
        warnings: processedResult.warnings ?? [],
        executionTime: Date.now() - startTime,
        metadata: this.buildMetadata(analysisTask, code, 'r'),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'R code execution failed',
        executionTime: Date.now() - startTime,
        warnings: [],
        metadata: this.buildMetadata(analysisTask, code, 'r'),
      };
    }
  }

  /**
   * Validate Python code for security and best practices
   */
  private validateCode(
    code: string,
    analysisTask: AnalysisTask,
    options: ExecutionOptions
  ): CodeValidationResult {
    const issues: ValidationIssue[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: string[] = [];

    // Security checks
    const dangerousPatterns = [
      {
        pattern: /import\s+os/,
        message: 'OS module import not allowed',
        severity: 'critical' as const,
      },
      {
        pattern: /import\s+subprocess/,
        message: 'Subprocess module import not allowed',
        severity: 'critical' as const,
      },
      {
        pattern: /import\s+sys/,
        message: 'Sys module import not allowed',
        severity: 'high' as const,
      },
      { pattern: /eval\s*\(/, message: 'Eval function not allowed', severity: 'critical' as const },
      { pattern: /exec\s*\(/, message: 'Exec function not allowed', severity: 'critical' as const },
      { pattern: /open\s*\(/, message: 'File operations not allowed', severity: 'high' as const },
      { pattern: /requests\./, message: 'Network requests not allowed', severity: 'high' as const },
      { pattern: /urllib\./, message: 'Network operations not allowed', severity: 'high' as const },
    ];

    dangerousPatterns.forEach(({ pattern, message, severity }) => {
      if (pattern.test(code)) {
        issues.push({
          type: 'security',
          severity,
          message,
          suggestion: 'Remove or replace with safe alternatives',
        });
      }
    });

    // Performance checks
    if (code.includes('for i in range(1000000):')) {
      warnings.push({
        type: 'efficiency',
        message: 'Large loop detected - consider vectorization',
        suggestion: 'Use pandas/numpy operations instead of loops',
      });
    }

    // Best practice checks
    if (code.includes('import *')) {
      warnings.push({
        type: 'style',
        message: 'Wildcard imports not recommended',
        suggestion: 'Import specific functions/modules',
      });
    }

    // Analysis-specific validation
    if (
      analysisTask.category === 'regression' &&
      !code.includes('sklearn') &&
      !code.includes('statsmodels')
    ) {
      suggestions.push('Consider using scikit-learn or statsmodels for regression analysis');
    }

    if (analysisTask.category === 'clustering' && !code.includes('sklearn')) {
      suggestions.push('Consider using scikit-learn for clustering algorithms');
    }

    return {
      isValid: issues.filter(i => i.severity === 'critical' || i.severity === 'high').length === 0,
      issues,
      warnings,
      suggestions,
    };
  }

  /**
   * Validate R code for security and best practices
   */
  private validateRCode(
    code: string,
    analysisTask: AnalysisTask,
    options: ExecutionOptions
  ): CodeValidationResult {
    const issues: ValidationIssue[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: string[] = [];

    // Security checks for R
    const dangerousPatterns = [
      {
        pattern: /system\s*\(/,
        message: 'System function not allowed',
        severity: 'critical' as const,
      },
      {
        pattern: /shell\s*\(/,
        message: 'Shell function not allowed',
        severity: 'critical' as const,
      },
      { pattern: /source\s*\(/, message: 'Source function not allowed', severity: 'high' as const },
      { pattern: /eval\s*\(/, message: 'Eval function not allowed', severity: 'critical' as const },
      { pattern: /parse\s*\(/, message: 'Parse function not allowed', severity: 'high' as const },
    ];

    dangerousPatterns.forEach(({ pattern, message, severity }) => {
      if (pattern.test(code)) {
        issues.push({
          type: 'security',
          severity,
          message,
          suggestion: 'Remove or replace with safe alternatives',
        });
      }
    });

    // R-specific best practices
    if (code.includes('attach(')) {
      warnings.push({
        type: 'style',
        message: 'Avoid attach() function',
        suggestion: 'Use explicit data frame references',
      });
    }

    return {
      isValid: issues.filter(i => i.severity === 'critical' || i.severity === 'high').length === 0,
      issues,
      warnings,
      suggestions,
    };
  }

  /**
   * Prepare Python code for execution with dataset context
   */
  private prepareExecutionCode(
    code: string,
    analysisTask: AnalysisTask,
    datasetContext: DatasetContext
  ): string {
    let executionCode = '';

    // Add dataset loading
    executionCode += `# Dataset context: ${datasetContext.totalRows} rows × ${datasetContext.totalColumns} columns\n`;
    executionCode += `# Analysis: ${analysisTask.name}\n`;
    executionCode += `# Quality score: ${datasetContext.dataQuality.overall}/100\n\n`;

    // Add required imports
    executionCode += `# Required imports for ${analysisTask.name}\n`;
    analysisTask.libraries.forEach(lib => {
      executionCode += `import ${lib}\n`;
    });
    executionCode += '\n';

    // Add data quality checks
    executionCode += `# Data quality checks\n`;
    executionCode += `print(f"Dataset loaded: {len(df)} rows, {len(df.columns)} columns")\n`;
    executionCode += `print(f"Missing data: {df.isnull().sum().sum()} total missing values")\n\n`;

    // Add the user's code
    executionCode += `# User analysis code\n`;
    executionCode += code;

    // Add output formatting
    executionCode += `\n\n# Results summary\n`;
    executionCode += `print("\\n=== Analysis Complete ===")\n`;

    return executionCode;
  }

  /**
   * Prepare R code for execution with dataset context
   */
  private prepareRExecutionCode(
    code: string,
    analysisTask: AnalysisTask,
    datasetContext: DatasetContext
  ): string {
    let executionCode = '';

    // Add dataset context
    executionCode += `# Dataset context: ${datasetContext.totalRows} rows × ${datasetContext.totalColumns} columns\n`;
    executionCode += `# Analysis: ${analysisTask.name}\n`;
    executionCode += `# Quality score: ${datasetContext.dataQuality.overall}/100\n\n`;

    // Add required libraries
    executionCode += `# Required libraries for ${analysisTask.name}\n`;
    if (analysisTask.libraries.includes('ggplot2')) {
      executionCode += `library(ggplot2)\n`;
    }
    if (analysisTask.libraries.includes('dplyr')) {
      executionCode += `library(dplyr)\n`;
    }
    executionCode += '\n';

    // Add data quality checks
    executionCode += `# Data quality checks\n`;
    executionCode += `cat("Dataset loaded:", nrow(df), "rows,", ncol(df), "columns\\n")\n`;
    executionCode += `cat("Missing data:", sum(is.na(df)), "total missing values\\n\\n")\n`;

    // Add the user's code
    executionCode += `# User analysis code\n`;
    executionCode += code;

    // Add output formatting
    executionCode += `\n\n# Results summary\n`;
    executionCode += `cat("\\n=== Analysis Complete ===\\n")\n`;

    return executionCode;
  }

  /**
   * Execute code using your existing infrastructure
   */
  private async executeCode(
    code: string,
    language: 'python' | 'r',
    options: ExecutionOptions
  ): Promise<any> {
    const API_BASE_URL = process.env.NEXT_PUBLIC_FARGATE_API_URL;

    if (!API_BASE_URL) {
      throw new Error('Code execution API not configured');
    }

    const endpoint = `${API_BASE_URL}/api/execute/${language}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        options: {
          timeout: options.timeout,
          memoryLimit: options.memoryLimit,
          allowNetwork: options.allowNetwork,
          allowFileSystem: options.allowFileSystem,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Execution failed: ${errorText}`);
    }

    return await response.json();
  }

  /**
   * Process and validate execution results
   */
  private processExecutionResult(result: any, options: ExecutionOptions): Partial<ExecutionResult> {
    const warnings: string[] = [];

    // Check output size
    if (
      result.output &&
      options.maxOutputSize &&
      JSON.stringify(result.output).length > options.maxOutputSize
    ) {
      warnings.push('Output size exceeds limit - truncating results');
      result.output = this.truncateOutput(result.output, options.maxOutputSize);
    }

    // Check for common issues
    if (result.stdout && result.stdout.includes('UserWarning')) {
      warnings.push('Code generated warnings - check for potential issues');
    }

    if (result.stdout && result.stdout.includes('DeprecationWarning')) {
      warnings.push('Code uses deprecated functions - consider updating');
    }

    return {
      success: !result.error,
      output: result.output,
      stdout: result.stdout,
      stderr: result.stderr,
      error: result.error,
      warnings,
    };
  }

  /**
   * Truncate output to fit size limits
   */
  private truncateOutput(output: any, maxSize: number): any {
    const outputStr = JSON.stringify(output);
    if (outputStr.length <= maxSize) return output;

    // Simple truncation - in production, you might want more sophisticated handling
    if (Array.isArray(output)) {
      return output.slice(0, Math.floor(output.length * 0.8)); // Keep 80%
    }

    if (typeof output === 'object') {
      const keys = Object.keys(output);
      const truncated: any = {};
      keys.slice(0, Math.floor(keys.length * 0.8)).forEach(key => {
        truncated[key] = output[key];
      });
      return truncated;
    }

    return output;
  }

  /**
   * Build execution metadata
   */
  private buildMetadata(
    analysisTask: AnalysisTask,
    code: string,
    language: string
  ): ExecutionMetadata {
    return {
      analysisType: analysisTask.category,
      librariesUsed: analysisTask.libraries,
      codeSize: code.length,
      executionEnvironment: language,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get execution statistics
   */
  getExecutionStats(): {
    totalExecutions: number;
    successRate: number;
    averageExecutionTime: number;
    commonErrors: string[];
  } {
    // This would integrate with your monitoring/logging system
    return {
      totalExecutions: 0,
      successRate: 0,
      averageExecutionTime: 0,
      commonErrors: [],
    };
  }
}

// Export singleton instance
export const codeExecutor = new CodeExecutor();

// Export convenience functions
export const executePythonCode = (
  code: string,
  analysisTask: AnalysisTask,
  datasetContext: DatasetContext,
  options?: Partial<ExecutionOptions>
) => codeExecutor.executePythonCode(code, analysisTask, datasetContext, options);

export const executeRCode = (
  code: string,
  analysisTask: AnalysisTask,
  datasetContext: DatasetContext,
  options?: Partial<ExecutionOptions>
) => codeExecutor.executeRCode(code, analysisTask, datasetContext, options);

export const validateCode = (
  code: string,
  analysisTask: AnalysisTask,
  options?: ExecutionOptions
) => codeExecutor['validateCode'](code, analysisTask, options || {});
