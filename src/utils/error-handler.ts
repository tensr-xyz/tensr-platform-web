import { AnalysisTask, DatasetContext } from '@/types/agent';

export interface AgentError {
  id: string;
  type: ErrorType;
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  userMessage: string;
  technicalDetails: string;
  timestamp: string;
  context: ErrorContext;
  suggestions: string[];
  retryable: boolean;
  code?: string;
}

export type ErrorType =
  | 'api_error'
  | 'validation_error'
  | 'execution_error'
  | 'timeout_error'
  | 'rate_limit_error'
  | 'authentication_error'
  | 'data_error'
  | 'system_error';

export type ErrorCategory =
  | 'user_input'
  | 'data_processing'
  | 'code_execution'
  | 'external_service'
  | 'system_infrastructure'
  | 'security'
  | 'performance';

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ErrorContext {
  analysisTask?: AnalysisTask;
  datasetContext?: DatasetContext;
  userQuery?: string;
  conversationHistory?: any[];
  executionEnvironment?: string;
  apiEndpoint?: string;
  responseCode?: number;
  responseBody?: string;
}

export interface ErrorLogEntry {
  error: AgentError;
  stackTrace?: string;
  additionalData?: any;
  userId?: string;
  sessionId?: string;
  requestId?: string;
}

export class AgentErrorHandler {
  private errorLog: ErrorLogEntry[] = [];
  private maxLogSize = 1000;

  /**
   * Create a standardized error object
   */
  createError(
    type: ErrorType,
    category: ErrorCategory,
    severity: ErrorSeverity,
    message: string,
    context: ErrorContext = {},
    suggestions: string[] = []
  ): AgentError {
    const error: AgentError = {
      id: this.generateErrorId(),
      type,
      category,
      severity,
      message,
      userMessage: this.generateUserMessage(type, message, context),
      technicalDetails: this.generateTechnicalDetails(type, message, context),
      timestamp: new Date().toISOString(),
      context,
      suggestions:
        suggestions.length > 0 ? suggestions : this.generateDefaultSuggestions(type, category),
      retryable: this.isRetryable(type, severity),
      code: this.generateErrorCode(type, category),
    };

    this.logError(error);
    return error;
  }

  /**
   * Handle API errors from external services
   */
  handleAPIError(error: any, endpoint: string, context: ErrorContext = {}): AgentError {
    let type: ErrorType = 'api_error';
    let severity: ErrorSeverity = 'medium';
    let suggestions: string[] = [];

    if (error.status === 429) {
      type = 'rate_limit_error';
      severity = 'medium';
      suggestions = [
        'Wait a moment and try again',
        'Check your API usage limits',
        'Consider upgrading your plan if this persists',
      ];
    } else if (error.status === 401 || error.status === 403) {
      type = 'authentication_error';
      severity = 'high';
      suggestions = [
        'Check your API key configuration',
        'Verify your authentication credentials',
        'Contact support if the issue persists',
      ];
    } else if (error.status >= 500) {
      type = 'external_service';
      severity = 'medium';
      suggestions = [
        'Try again in a few minutes',
        'Check service status page',
        'Contact support if the issue persists',
      ];
    } else if (error.status === 408 || error.status === 504) {
      type = 'timeout_error';
      severity = 'medium';
      suggestions = [
        'Try again with a simpler query',
        'Check your internet connection',
        'Consider breaking down complex requests',
      ];
    }

    return this.createError(
      type,
      'external_service',
      severity,
      error.message || `API request failed with status ${error.status}`,
      { ...context, apiEndpoint: endpoint, responseCode: error.status, responseBody: error.body },
      suggestions
    );
  }

  /**
   * Handle code execution errors
   */
  handleExecutionError(
    error: any,
    analysisTask: AnalysisTask,
    datasetContext: DatasetContext,
    code: string,
    context: ErrorContext = {}
  ): AgentError {
    let type: ErrorType = 'execution_error';
    let severity: ErrorSeverity = 'medium';
    let suggestions: string[] = [];

    // Analyze error patterns
    if (error.message?.includes('memory')) {
      severity = 'high';
      suggestions = [
        'Try with a smaller dataset sample',
        'Optimize the analysis code',
        'Consider using more efficient algorithms',
      ];
    } else if (error.message?.includes('timeout')) {
      type = 'timeout_error';
      suggestions = [
        'Simplify the analysis',
        'Use a smaller dataset sample',
        'Consider breaking down into smaller steps',
      ];
    } else if (error.message?.includes('import') || error.message?.includes('module')) {
      suggestions = [
        'Check if required libraries are available',
        'Verify library versions',
        'Consider alternative libraries',
      ];
    } else if (error.message?.includes('data') || error.message?.includes('column')) {
      suggestions = [
        'Verify data types and formats',
        'Check for missing or invalid data',
        'Consider data preprocessing steps',
      ];
    }

    return this.createError(
      type,
      'code_execution',
      severity,
      error.message || 'Code execution failed',
      {
        ...context,
        analysisTask,
        datasetContext,
        executionEnvironment: analysisTask.libraries.includes('pandas') ? 'python' : 'r',
        code,
      },
      suggestions
    );
  }

  /**
   * Handle validation errors
   */
  handleValidationError(
    field: string,
    value: any,
    rule: string,
    context: ErrorContext = {}
  ): AgentError {
    const suggestions = [
      'Check the input format and requirements',
      'Verify data types and constraints',
      'Review the field description',
    ];

    return this.createError(
      'validation_error',
      'user_input',
      'low',
      `Validation failed for ${field}: ${rule}`,
      { ...context, [field]: value },
      suggestions
    );
  }

  /**
   * Handle data processing errors
   */
  handleDataError(
    error: any,
    datasetContext: DatasetContext,
    operation: string,
    context: ErrorContext = {}
  ): AgentError {
    let severity: ErrorSeverity = 'medium';
    let suggestions: string[] = [];

    if (error.message?.includes('memory') || error.message?.includes('size')) {
      severity = 'high';
      suggestions = [
        'Try with a smaller dataset sample',
        'Use data sampling techniques',
        'Consider data compression or optimization',
      ];
    } else if (error.message?.includes('format') || error.message?.includes('type')) {
      suggestions = [
        'Check data format and encoding',
        'Verify column data types',
        'Consider data conversion or cleaning',
      ];
    } else if (error.message?.includes('missing') || error.message?.includes('null')) {
      suggestions = [
        'Handle missing data appropriately',
        'Use imputation strategies',
        'Filter out incomplete records if appropriate',
      ];
    }

    return this.createError(
      'data_error',
      'data_processing',
      severity,
      error.message || `Data processing failed during ${operation}`,
      { ...context, datasetContext, operation },
      suggestions
    );
  }

  /**
   * Generate user-friendly error messages
   */
  private generateUserMessage(type: ErrorType, message: string, context: ErrorContext): string {
    switch (type) {
      case 'api_error':
        return 'We encountered an issue communicating with our analysis service. Please try again.';

      case 'validation_error':
        return "The request couldn't be processed due to invalid input. Please check your request and try again.";

      case 'execution_error':
        return "The analysis couldn't be completed due to an execution error. We've provided suggestions to help resolve this.";

      case 'timeout_error':
        return 'The analysis took longer than expected to complete. Try simplifying your request or try again.';

      case 'rate_limit_error':
        return "We're experiencing high demand. Please wait a moment before trying again.";

      case 'authentication_error':
        return 'Authentication failed. Please check your credentials and try again.';

      case 'data_error':
        return 'There was an issue processing your data. Check the data format and try again.';

      case 'system_error':
        return 'We encountered an unexpected system error. Our team has been notified and will investigate.';

      default:
        return 'An unexpected error occurred. Please try again or contact support if the issue persists.';
    }
  }

  /**
   * Generate technical details for developers
   */
  private generateTechnicalDetails(
    type: ErrorType,
    message: string,
    context: ErrorContext
  ): string {
    let details = `Error Type: ${type}\nMessage: ${message}`;

    if (context.apiEndpoint) {
      details += `\nEndpoint: ${context.apiEndpoint}`;
    }

    if (context.responseCode) {
      details += `\nResponse Code: ${context.responseCode}`;
    }

    if (context.executionEnvironment) {
      details += `\nEnvironment: ${context.executionEnvironment}`;
    }

    if (context.analysisTask) {
      details += `\nAnalysis: ${context.analysisTask.name} (${context.analysisTask.category})`;
    }

    if (context.datasetContext) {
      details += `\nDataset: ${context.datasetContext.totalRows} rows × ${context.datasetContext.totalColumns} columns`;
    }

    return details;
  }

  /**
   * Generate default suggestions based on error type and category
   */
  private generateDefaultSuggestions(type: ErrorType, category: ErrorCategory): string[] {
    const suggestions: Record<string, string[]> = {
      api_error: [
        'Check your internet connection',
        'Verify the service is available',
        'Try again in a few minutes',
      ],
      validation_error: [
        'Review the input requirements',
        'Check data formats and types',
        'Ensure all required fields are provided',
      ],
      execution_error: [
        'Simplify your request',
        'Check data quality and format',
        'Try with a smaller dataset sample',
      ],
      timeout_error: [
        'Break down complex requests',
        'Use smaller datasets',
        'Try during off-peak hours',
      ],
      rate_limit_error: [
        'Wait before making new requests',
        'Check your usage limits',
        'Consider upgrading your plan',
      ],
      authentication_error: [
        'Verify your credentials',
        'Check API key configuration',
        'Contact support for assistance',
      ],
      data_error: [
        'Validate data format and types',
        'Check for missing or invalid data',
        'Consider data preprocessing',
      ],
      system_error: [
        'Try again in a few minutes',
        'Check service status',
        'Contact support if the issue persists',
      ],
    };

    return (
      suggestions[type] || [
        'Try again',
        'Check your input',
        'Contact support if the issue persists',
      ]
    );
  }

  /**
   * Determine if an error is retryable
   */
  private isRetryable(type: ErrorType, severity: ErrorSeverity): boolean {
    if (severity === 'critical') return false;

    const retryableTypes: ErrorType[] = [
      'api_error',
      'timeout_error',
      'rate_limit_error',
      'system_error',
    ];

    return retryableTypes.includes(type);
  }

  /**
   * Generate error codes for tracking
   */
  private generateErrorCode(type: ErrorType, category: ErrorCategory): string {
    const typeCode = type.substring(0, 3).toUpperCase();
    const categoryCode = category.substring(0, 3).toUpperCase();
    const timestamp = Date.now().toString(36);

    return `${typeCode}-${categoryCode}-${timestamp}`;
  }

  /**
   * Generate unique error ID
   */
  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log error for monitoring and debugging
   */
  private logError(error: AgentError): void {
    const logEntry: ErrorLogEntry = {
      error,
      timestamp: new Date().toISOString(),
      requestId: this.generateRequestId(),
    };

    this.errorLog.push(logEntry);

    // Maintain log size
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(-this.maxLogSize);
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Agent Error:', error);
    }

    // In production, you'd send this to your logging service
    this.sendToLoggingService(logEntry);
  }

  /**
   * Generate request ID for tracking
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Send error to logging service (implement based on your infrastructure)
   */
  private sendToLoggingService(logEntry: ErrorLogEntry): void {
    // Implementation depends on your logging service (e.g., Sentry, LogRocket, etc.)
    // For now, we'll just store it locally
    try {
      // You could send to an API endpoint, WebSocket, or external service
      if (typeof window !== 'undefined') {
        // Client-side logging
        localStorage.setItem(`error_log_${logEntry.error.id}`, JSON.stringify(logEntry));
      }
    } catch (err) {
      // Silently fail if logging fails
      console.warn('Failed to log error:', err);
    }
  }

  /**
   * Get error statistics for monitoring
   */
  getErrorStats(): {
    totalErrors: number;
    errorsByType: Record<ErrorType, number>;
    errorsBySeverity: Record<ErrorSeverity, number>;
    errorsByCategory: Record<ErrorCategory, number>;
    recentErrors: AgentError[];
  } {
    const errorsByType: Record<ErrorType, number> = {} as Record<ErrorType, number>;
    const errorsBySeverity: Record<ErrorSeverity, number> = {} as Record<ErrorSeverity, number>;
    const errorsByCategory: Record<ErrorCategory, number> = {} as Record<ErrorCategory, number>;

    this.errorLog.forEach(entry => {
      const { type, severity, category } = entry.error;

      errorsByType[type] = (errorsByType[type] || 0) + 1;
      errorsBySeverity[severity] = (errorsBySeverity[severity] || 0) + 1;
      errorsByCategory[category] = (errorsByCategory[category] || 0) + 1;
    });

    return {
      totalErrors: this.errorLog.length,
      errorsByType,
      errorsBySeverity,
      errorsByCategory,
      recentErrors: this.errorLog.slice(-10).map(entry => entry.error),
    };
  }

  /**
   * Clear error log
   */
  clearErrorLog(): void {
    this.errorLog = [];
  }

  /**
   * Get errors by type
   */
  getErrorsByType(type: ErrorType): AgentError[] {
    return this.errorLog.filter(entry => entry.error.type === type).map(entry => entry.error);
  }

  /**
   * Get errors by severity
   */
  getErrorsBySeverity(severity: ErrorSeverity): AgentError[] {
    return this.errorLog
      .filter(entry => entry.error.severity === severity)
      .map(entry => entry.error);
  }

  /**
   * Get errors by category
   */
  getErrorsByCategory(category: ErrorCategory): AgentError[] {
    return this.errorLog
      .filter(entry => entry.error.category === category)
      .map(entry => entry.error);
  }
}

// Export singleton instance
export const agentErrorHandler = new AgentErrorHandler();

// Export convenience functions
export const createAgentError = (
  type: ErrorType,
  category: ErrorCategory,
  severity: ErrorSeverity,
  message: string,
  context?: ErrorContext,
  suggestions?: string[]
) => agentErrorHandler.createError(type, category, severity, message, context, suggestions);

export const handleAPIError = (error: any, endpoint: string, context?: ErrorContext) =>
  agentErrorHandler.handleAPIError(error, endpoint, context);

export const handleExecutionError = (
  error: any,
  analysisTask: AnalysisTask,
  datasetContext: DatasetContext,
  code: string,
  context?: ErrorContext
) => agentErrorHandler.handleExecutionError(error, analysisTask, datasetContext, code, context);

export const handleValidationError = (
  field: string,
  value: any,
  rule: string,
  context?: ErrorContext
) => agentErrorHandler.handleValidationError(field, value, rule, context);

export const handleDataError = (
  error: any,
  datasetContext: DatasetContext,
  operation: string,
  context?: ErrorContext
) => agentErrorHandler.handleDataError(error, datasetContext, operation, context);
