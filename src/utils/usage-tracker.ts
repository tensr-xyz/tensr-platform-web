// Usage tracking utility for comprehensive user activity monitoring

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

interface UsageEvent {
  operationType: string;
  dataProcessed?: number;
  executionTime?: number;
  metadata?: Record<string, any>;
  source?: string;
  // Comprehensive metrics
  apiEndpoint?: string;
  httpMethod?: string;
  requestSize?: number;
  responseSize?: number;
  featureName?: string;
  storageChange?: number;
  computeUnits?: number;
  dataTransferIn?: number;
  dataTransferOut?: number;
}

interface QueuedEvent extends UsageEvent {
  timestamp: number;
}

class UsageTracker {
  private eventQueue: QueuedEvent[] = [];
  private batchSize: number = 10;
  private flushInterval: number = 5000; // 5 seconds
  private flushTimer: NodeJS.Timeout | null = null;
  private getToken: (() => string | null) | null = null;

  constructor(getTokenFn?: () => string | null) {
    this.getToken = getTokenFn || null;
    this.startAutoFlush();
  }

  /**
   * Set the token getter function for authenticated requests
   */
  setTokenGetter(getTokenFn: () => string | null) {
    this.getToken = getTokenFn;
  }

  /**
   * Track a general operation
   */
  trackOperation(
    operationType: string,
    data?: {
      dataProcessed?: number;
      executionTime?: number;
      metadata?: Record<string, any>;
    }
  ) {
    this.queueEvent({
      operationType,
      dataProcessed: data?.dataProcessed,
      executionTime: data?.executionTime,
      metadata: data?.metadata,
      source: 'frontend',
    });
  }

  /**
   * Track API call usage
   */
  trackAPICall(
    endpoint: string,
    method: string,
    options?: {
      duration?: number;
      requestSize?: number;
      responseSize?: number;
      dataProcessed?: number;
      metadata?: Record<string, any>;
    }
  ) {
    const dataProcessed =
      options?.requestSize && options?.responseSize
        ? options.requestSize + options.responseSize
        : options?.dataProcessed || 0;

    this.queueEvent({
      operationType: 'api_call',
      apiEndpoint: endpoint,
      httpMethod: method,
      requestSize: options?.requestSize,
      responseSize: options?.responseSize,
      dataProcessed,
      executionTime: options?.duration,
      metadata: {
        ...options?.metadata,
        endpoint,
        method,
      },
      source: 'api_client',
    });
  }

  /**
   * Track feature usage
   */
  trackFeatureUsage(featureName: string, metadata?: Record<string, any>) {
    this.queueEvent({
      operationType: 'feature_usage',
      featureName,
      metadata: {
        ...metadata,
        feature: featureName,
      },
      source: 'frontend',
    });
  }

  /**
   * Track storage changes
   */
  trackStorageChange(
    changeType: 'upload' | 'download' | 'delete' | 'update',
    size: number,
    metadata?: Record<string, any>
  ) {
    this.queueEvent({
      operationType: 'storage_change',
      storageChange: changeType === 'upload' || changeType === 'update' ? size : -size,
      dataProcessed: size,
      metadata: {
        ...metadata,
        changeType,
      },
      source: 'storage',
    });
  }

  /**
   * Track compute-intensive operations
   */
  trackComputeOperation(
    operationType: string,
    computeUnits: number,
    executionTime: number,
    metadata?: Record<string, any>
  ) {
    this.queueEvent({
      operationType,
      computeUnits,
      executionTime,
      metadata,
      source: 'compute',
    });
  }

  /**
   * Track data transfer
   */
  trackDataTransfer(dataIn: number, dataOut: number, metadata?: Record<string, any>) {
    this.queueEvent({
      operationType: 'data_transfer',
      dataTransferIn: dataIn,
      dataTransferOut: dataOut,
      dataProcessed: dataIn + dataOut,
      metadata,
      source: 'network',
    });
  }

  /**
   * Queue an event for batch processing
   */
  private queueEvent(event: UsageEvent) {
    this.eventQueue.push({
      ...event,
      timestamp: Date.now(),
    });

    // Flush if queue reaches batch size
    if (this.eventQueue.length >= this.batchSize) {
      this.flush();
    }
  }

  /**
   * Flush queued events to the API
   */
  async flush(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const eventsToSend = [...this.eventQueue];
    this.eventQueue = [];

    const token = this.getToken?.();
    if (!token) {
      console.warn('UsageTracker: No token available, events will be lost');
      return;
    }

    try {
      // Send events in parallel
      await Promise.all(
        eventsToSend.map(event =>
          fetch(`${API_BASE_URL}/usage/track`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(event),
          }).catch(err => {
            console.error('Failed to track usage event:', err);
            // Re-queue failed events (with limit to prevent infinite growth)
            if (this.eventQueue.length < 100) {
              this.eventQueue.push(event);
            }
          })
        )
      );
    } catch (error) {
      console.error('Error flushing usage events:', error);
      // Re-queue events on error
      this.eventQueue.unshift(...eventsToSend);
    }
  }

  /**
   * Start automatic flushing at intervals
   */
  private startAutoFlush() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  /**
   * Stop automatic flushing and flush remaining events
   */
  async stop() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }
}

// Singleton instance
let usageTrackerInstance: UsageTracker | null = null;

/**
 * Get or create the global usage tracker instance
 */
export function getUsageTracker(getToken?: () => string | null): UsageTracker {
  if (!usageTrackerInstance) {
    usageTrackerInstance = new UsageTracker(getToken);
  } else if (getToken) {
    usageTrackerInstance.setTokenGetter(getToken);
  }
  return usageTrackerInstance;
}

/**
 * Initialize usage tracker with token getter
 */
export function initUsageTracker(getToken: () => string | null) {
  usageTrackerInstance = new UsageTracker(getToken);
  return usageTrackerInstance;
}

// Export the class for direct instantiation if needed
export { UsageTracker };
export type { UsageEvent };
