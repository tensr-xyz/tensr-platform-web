import { AnalysisTask, DatasetContext, Message } from '@/types/agent';

export interface AgentMetrics {
  sessionId: string;
  userId?: string;
  timestamp: string;
  interactions: InteractionMetric[];
  analysisExecutions: AnalysisExecutionMetric[];
  errors: ErrorMetric[];
  performance: PerformanceMetrics;
  dataQuality: DataQualityMetrics;
}

export interface InteractionMetric {
  id: string;
  timestamp: string;
  type: 'message' | 'analysis_request' | 'code_execution' | 'result_view';
  userQuery?: string;
  analysisType?: string;
  responseTime: number;
  success: boolean;
  tokensUsed?: {
    prompt: number;
    completion: number;
    total: number;
  };
  userFeedback?: 'positive' | 'negative' | 'neutral';
}

export interface AnalysisExecutionMetric {
  id: string;
  timestamp: string;
  analysisTask: string;
  analysisCategory: string;
  datasetSize: {
    rows: number;
    columns: number;
  };
  executionTime: number;
  success: boolean;
  errorType?: string;
  librariesUsed: string[];
  outputFormats: string[];
  codeSize: number;
}

export interface ErrorMetric {
  id: string;
  timestamp: string;
  type: string;
  category: string;
  severity: string;
  message: string;
  context: any;
  retryable: boolean;
}

export interface PerformanceMetrics {
  averageResponseTime: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  successRate: number;
  averageTokensPerRequest: number;
  peakConcurrentRequests: number;
  cacheHitRate: number;
}

export interface DataQualityMetrics {
  totalDatasets: number;
  averageQualityScore: number;
  qualityDistribution: {
    excellent: number; // 90-100
    good: number; // 70-89
    fair: number; // 50-69
    poor: number; // 0-49
  };
  commonIssues: Array<{
    issue: string;
    frequency: number;
    impact: 'low' | 'medium' | 'high';
  }>;
}

export interface UserBehaviorMetrics {
  totalUsers: number;
  activeUsers: number;
  averageSessionDuration: number;
  popularAnalyses: Array<{
    analysis: string;
    usageCount: number;
    successRate: number;
  }>;
  userRetention: {
    daily: number;
    weekly: number;
    monthly: number;
  };
}

export interface SystemHealthMetrics {
  uptime: number;
  averageLoad: number;
  memoryUsage: number;
  cpuUsage: number;
  activeConnections: number;
  queueLength: number;
  lastHealthCheck: string;
}

export class AgentMonitoring {
  private metrics: AgentMetrics;
  private sessionStartTime: number;
  private requestQueue: Map<string, number> = new Map();
  private cacheHits: number = 0;
  private cacheMisses: number = 0;

  constructor(sessionId: string, userId?: string) {
    this.sessionStartTime = Date.now();
    this.metrics = {
      sessionId,
      userId,
      timestamp: new Date().toISOString(),
      interactions: [],
      analysisExecutions: [],
      errors: [],
      performance: {
        averageResponseTime: 0,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        successRate: 0,
        averageTokensPerRequest: 0,
        peakConcurrentRequests: 0,
        cacheHitRate: 0,
      },
      dataQuality: {
        totalDatasets: 0,
        averageQualityScore: 0,
        qualityDistribution: { excellent: 0, good: 0, fair: 0, poor: 0 },
        commonIssues: [],
      },
    };
  }

  /**
   * Track user interaction
   */
  trackInteraction(
    type: InteractionMetric['type'],
    userQuery?: string,
    analysisType?: string,
    responseTime: number = 0,
    success: boolean = true,
    tokensUsed?: { prompt: number; completion: number; total: number },
    userFeedback?: 'positive' | 'negative' | 'neutral'
  ): void {
    const interaction: InteractionMetric = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      type,
      userQuery,
      analysisType,
      responseTime,
      success,
      tokensUsed,
      userFeedback,
    };

    this.metrics.interactions.push(interaction);
    this.updatePerformanceMetrics();
  }

  /**
   * Track analysis execution
   */
  trackAnalysisExecution(
    analysisTask: AnalysisTask,
    datasetContext: DatasetContext,
    executionTime: number,
    success: boolean,
    errorType?: string,
    outputFormats: string[] = []
  ): void {
    const execution: AnalysisExecutionMetric = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      analysisTask: analysisTask.name,
      analysisCategory: analysisTask.category,
      datasetSize: {
        rows: datasetContext.totalRows,
        columns: datasetContext.totalColumns,
      },
      executionTime,
      success,
      errorType,
      librariesUsed: analysisTask.libraries,
      outputFormats,
      codeSize: 0, // Would be set when code is generated
    };

    this.metrics.analysisExecutions.push(execution);
    this.updateDataQualityMetrics(datasetContext);
  }

  /**
   * Track error occurrence
   */
  trackError(
    type: string,
    category: string,
    severity: string,
    message: string,
    context: any,
    retryable: boolean
  ): void {
    const error: ErrorMetric = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      type,
      category,
      severity,
      message,
      context,
      retryable,
    };

    this.metrics.errors.push(error);
  }

  /**
   * Track request start
   */
  trackRequestStart(requestId: string): void {
    this.requestQueue.set(requestId, Date.now());
  }

  /**
   * Track request completion
   */
  trackRequestComplete(requestId: string, success: boolean, responseTime: number): void {
    const startTime = this.requestQueue.get(requestId);
    if (startTime) {
      this.requestQueue.delete(requestId);

      // Update peak concurrent requests
      const currentConcurrent = this.requestQueue.size;
      if (currentConcurrent > this.metrics.performance.peakConcurrentRequests) {
        this.metrics.performance.peakConcurrentRequests = currentConcurrent;
      }
    }
  }

  /**
   * Track cache hit/miss
   */
  trackCacheAccess(hit: boolean): void {
    if (hit) {
      this.cacheHits++;
    } else {
      this.cacheMisses++;
    }

    this.updateCacheMetrics();
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(): void {
    const interactions = this.metrics.interactions;
    if (interactions.length === 0) return;

    const totalResponseTime = interactions.reduce((sum, i) => sum + i.responseTime, 0);
    const successfulInteractions = interactions.filter(i => i.success);
    const failedInteractions = interactions.filter(i => !i.success);

    const totalTokens = interactions
      .filter(i => i.tokensUsed)
      .reduce((sum, i) => sum + (i.tokensUsed?.total || 0), 0);

    this.metrics.performance = {
      averageResponseTime: totalResponseTime / interactions.length,
      totalRequests: interactions.length,
      successfulRequests: successfulInteractions.length,
      failedRequests: failedInteractions.length,
      successRate: (successfulInteractions.length / interactions.length) * 100,
      averageTokensPerRequest: totalTokens / interactions.length,
      peakConcurrentRequests: this.metrics.performance.peakConcurrentRequests,
      cacheHitRate: this.metrics.performance.cacheHitRate,
    };
  }

  /**
   * Update data quality metrics
   */
  private updateDataQualityMetrics(datasetContext: DatasetContext): void {
    const qualityScore = datasetContext.dataQuality.overall;

    // Update quality distribution
    if (qualityScore >= 90) {
      this.metrics.dataQuality.qualityDistribution.excellent++;
    } else if (qualityScore >= 70) {
      this.metrics.dataQuality.qualityDistribution.good++;
    } else if (qualityScore >= 50) {
      this.metrics.dataQuality.qualityDistribution.fair++;
    } else {
      this.metrics.dataQuality.qualityDistribution.poor++;
    }

    // Calculate average quality score
    const totalDatasets = this.metrics.dataQuality.totalDatasets + 1;
    const currentTotal =
      this.metrics.dataQuality.averageQualityScore * this.metrics.dataQuality.totalDatasets;
    this.metrics.dataQuality.averageQualityScore = (currentTotal + qualityScore) / totalDatasets;
    this.metrics.dataQuality.totalDatasets = totalDatasets;

    // Track common issues
    if (datasetContext.dataQuality.issues.length > 0) {
      datasetContext.dataQuality.issues.forEach(issue => {
        const existingIssue = this.metrics.dataQuality.commonIssues.find(
          i => i.issue === issue.type
        );
        if (existingIssue) {
          existingIssue.frequency++;
        } else {
          this.metrics.dataQuality.commonIssues.push({
            issue: issue.type,
            frequency: 1,
            impact: issue.severity as 'low' | 'medium' | 'high',
          });
        }
      });
    }
  }

  /**
   * Update cache metrics
   */
  private updateCacheMetrics(): void {
    const totalCacheAccesses = this.cacheHits + this.cacheMisses;
    if (totalCacheAccesses > 0) {
      this.metrics.performance.cacheHitRate = (this.cacheHits / totalCacheAccesses) * 100;
    }
  }

  /**
   * Get current metrics
   */
  getCurrentMetrics(): AgentMetrics {
    return { ...this.metrics };
  }

  /**
   * Get session duration
   */
  getSessionDuration(): number {
    return Date.now() - this.sessionStartTime;
  }

  /**
   * Get real-time performance summary
   */
  getPerformanceSummary(): {
    currentLoad: number;
    averageResponseTime: number;
    successRate: number;
    activeRequests: number;
  } {
    return {
      currentLoad: this.requestQueue.size,
      averageResponseTime: this.metrics.performance.averageResponseTime,
      successRate: this.metrics.performance.successRate,
      activeRequests: this.requestQueue.size,
    };
  }

  /**
   * Get user behavior insights
   */
  getUserBehaviorInsights(): {
    mostUsedAnalyses: Array<{ analysis: string; count: number }>;
    averageSessionDuration: number;
    userEngagement: 'low' | 'medium' | 'high';
  } {
    // Count analysis usage
    const analysisCounts = new Map<string, number>();
    this.metrics.analysisExecutions.forEach(execution => {
      analysisCounts.set(
        execution.analysisTask,
        (analysisCounts.get(execution.analysisTask) || 0) + 1
      );
    });

    const mostUsedAnalyses = Array.from(analysisCounts.entries())
      .map(([analysis, count]) => ({ analysis, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const sessionDuration = this.getSessionDuration();
    const interactionCount = this.metrics.interactions.length;

    let userEngagement: 'low' | 'medium' | 'high' = 'low';
    if (interactionCount > 10 && sessionDuration > 300000) {
      // 5 minutes
      userEngagement = 'high';
    } else if (interactionCount > 5 && sessionDuration > 120000) {
      // 2 minutes
      userEngagement = 'medium';
    }

    return {
      mostUsedAnalyses,
      averageSessionDuration: sessionDuration,
      userEngagement,
    };
  }

  /**
   * Get system health status
   */
  getSystemHealthStatus(): {
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check response time
    if (this.metrics.performance.averageResponseTime > 10000) {
      // 10 seconds
      issues.push('High average response time');
      recommendations.push('Optimize code execution or increase resources');
    }

    // Check success rate
    if (this.metrics.performance.successRate < 90) {
      issues.push('Low success rate');
      recommendations.push('Investigate common error patterns');
    }

    // Check concurrent requests
    if (this.metrics.performance.peakConcurrentRequests > 50) {
      issues.push('High concurrent request load');
      recommendations.push('Consider load balancing or rate limiting');
    }

    // Check data quality
    if (this.metrics.dataQuality.averageQualityScore < 70) {
      issues.push('Low average data quality');
      recommendations.push('Improve data preprocessing and validation');
    }

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (issues.length > 2) {
      status = 'critical';
    } else if (issues.length > 0) {
      status = 'warning';
    }

    return { status, issues, recommendations };
  }

  /**
   * Export metrics for external monitoring
   */
  exportMetrics(): {
    sessionMetrics: AgentMetrics;
    performanceSummary: any;
    userInsights: any;
    systemHealth: any;
  } {
    return {
      sessionMetrics: this.getCurrentMetrics(),
      performanceSummary: this.getPerformanceSummary(),
      userInsights: this.getUserBehaviorInsights(),
      systemHealth: this.getSystemHealthStatus(),
    };
  }

  /**
   * Reset metrics for new session
   */
  resetMetrics(): void {
    this.metrics.interactions = [];
    this.metrics.analysisExecutions = [];
    this.metrics.errors = [];
    this.metrics.performance = {
      averageResponseTime: 0,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      successRate: 0,
      averageTokensPerRequest: 0,
      peakConcurrentRequests: 0,
      cacheHitRate: 0,
    };
    this.sessionStartTime = Date.now();
    this.requestQueue.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const agentMonitoring = new AgentMonitoring('default_session');

// Export convenience functions
export const createMonitoringSession = (sessionId: string, userId?: string) =>
  new AgentMonitoring(sessionId, userId);

export const trackInteraction = (
  type: InteractionMetric['type'],
  userQuery?: string,
  analysisType?: string,
  responseTime?: number,
  success?: boolean,
  tokensUsed?: { prompt: number; completion: number; total: number },
  userFeedback?: 'positive' | 'negative' | 'neutral'
) =>
  agentMonitoring.trackInteraction(
    type,
    userQuery,
    analysisType,
    responseTime,
    success,
    tokensUsed,
    userFeedback
  );

export const trackAnalysisExecution = (
  analysisTask: AnalysisTask,
  datasetContext: DatasetContext,
  executionTime: number,
  success: boolean,
  errorType?: string,
  outputFormats?: string[]
) =>
  agentMonitoring.trackAnalysisExecution(
    analysisTask,
    datasetContext,
    executionTime,
    success,
    errorType,
    outputFormats
  );

export const trackError = (
  type: string,
  category: string,
  severity: string,
  message: string,
  context: any,
  retryable: boolean
) => agentMonitoring.trackError(type, category, severity, message, context, retryable);
