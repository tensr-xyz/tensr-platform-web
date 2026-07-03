// Usage tracking utility for comprehensive user activity monitoring

import { tensrApiUrl } from '@/lib/tensr-api-url';
import { handleUnauthorizedResponse } from '@/lib/session-expired';

const USAGE_TRACKING_DISABLED =
  process.env.NEXT_PUBLIC_DISABLE_USAGE_TRACKING === '1' ||
  process.env.NEXT_PUBLIC_DISABLE_USAGE_TRACKING === 'true';

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

/** Coerce to integer for tensr-api (Pydantic rejects JSON floats for int fields). */
function coerceUsageInt(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return Math.round(n);
  }
  return undefined;
}

function sanitizeUsageMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (value === undefined) continue;
    if (typeof value === 'number' && Number.isFinite(value)) {
      out[key] = Math.round(value);
      continue;
    }
    out[key] = value;
  }
  return out;
}

/** Payload accepted by tensr-api POST /usage/track (strip extras, coerce ints). */
export function toUsageTrackPayload(event: QueuedEvent): Record<string, unknown> {
  const metadata: Record<string, unknown> = sanitizeUsageMetadata({ ...(event.metadata ?? {}) });
  if (event.apiEndpoint) metadata.endpoint = event.apiEndpoint;
  if (event.httpMethod) metadata.method = event.httpMethod;
  if (event.featureName) metadata.feature = event.featureName;
  if (event.requestSize != null) metadata.requestSize = coerceUsageInt(event.requestSize);
  if (event.responseSize != null) metadata.responseSize = coerceUsageInt(event.responseSize);

  const dataProcessed = coerceUsageInt(event.dataProcessed);
  const executionTime = coerceUsageInt(event.executionTime);

  return {
    operationType: String(event.operationType || 'unknown').slice(0, 120),
    ...(dataProcessed != null ? { dataProcessed } : {}),
    ...(executionTime != null ? { executionTime } : {}),
    ...(Object.keys(metadata).length ? { metadata } : {}),
    ...(event.source ? { source: event.source } : {}),
  };
}

class UsageTracker {
  private eventQueue: QueuedEvent[] = [];
  private batchSize: number = 10;
  private flushInterval: number = 5000; // 5 seconds
  private flushTimer: NodeJS.Timeout | null = null;
  private getToken: (() => string | null) | null = null;
  /** Avoid overlapping flushes (interval + batch trigger + await re-entrancy). */
  private flushInProgress = false;
  private flushAgain = false;
  private readonly maxQueue = 80;

  constructor(getTokenFn?: () => string | null) {
    this.getToken = getTokenFn || null;
    if (!USAGE_TRACKING_DISABLED) {
      this.startAutoFlush();
    }
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
    if (USAGE_TRACKING_DISABLED) {
      return;
    }
    this.eventQueue.push({
      ...event,
      timestamp: Date.now(),
    });
    while (this.eventQueue.length > this.maxQueue) {
      this.eventQueue.shift();
    }

    // Flush if queue reaches batch size
    if (this.eventQueue.length >= this.batchSize) {
      void this.flush();
    }
  }

  /**
   * Flush queued events to the API
   */
  async flush(): Promise<void> {
    if (this.eventQueue.length === 0 || USAGE_TRACKING_DISABLED) {
      return;
    }
    if (this.flushInProgress) {
      this.flushAgain = true;
      return;
    }
    this.flushInProgress = true;

    try {
      const token = this.getToken?.();
      if (!token) {
        this.eventQueue = [];
        console.warn('UsageTracker: No token available, events will be lost');
        return;
      }

      while (this.eventQueue.length > 0) {
        const eventsToSend = this.eventQueue.splice(0, this.batchSize);
        for (const event of eventsToSend) {
          try {
            const res = await fetch(tensrApiUrl('/usage/track'), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(toUsageTrackPayload(event)),
            });
            if (handleUnauthorizedResponse(res)) {
              return;
            }
            // tensr-api and many local backends omit usage ingestion
            if (res.status === 404 || res.status === 405) {
              continue;
            }
            // Never re-queue 4xx: invalid payload (422) would spin forever and freeze the tab.
            if (!res.ok && res.status >= 400 && res.status < 500) {
              continue;
            }
            if (!res.ok) {
              // 5xx: drop (avoid storms); sampling can be re-added with bounded retry if needed.
              continue;
            }
          } catch {
            // Network failure: drop this event to avoid unbounded growth / tight loops.
            continue;
          }
        }
      }
    } catch (error) {
      console.error('Error flushing usage events:', error);
    } finally {
      this.flushInProgress = false;
      const again = this.flushAgain;
      this.flushAgain = false;
      if (again && this.eventQueue.length > 0) {
        void this.flush();
      }
    }
  }

  /**
   * Start automatic flushing at intervals
   */
  private startAutoFlush() {
    if (USAGE_TRACKING_DISABLED) {
      return;
    }
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flushTimer = setInterval(() => {
      void this.flush();
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
