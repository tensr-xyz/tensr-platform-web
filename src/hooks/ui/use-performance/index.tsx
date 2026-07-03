import { useEffect, useRef, useCallback } from 'react';
import { devLog } from '@/lib/dev-log';

interface PerformanceMetrics {
  renderTime: number;
  memoryUsage?: number;
  componentMounts: number;
  reRenders: number;
}

export function usePerformance(componentName: string) {
  const mountTime = useRef<number>(performance.now());
  const renderCount = useRef<number>(0);
  const lastRenderTime = useRef<number>(0);
  const metrics = useRef<PerformanceMetrics>({
    renderTime: 0,
    memoryUsage: 0,
    componentMounts: 0,
    reRenders: 0,
  });

  // Track component mount
  useEffect(() => {
    const mountDuration = performance.now() - mountTime.current;
    metrics.current.componentMounts++;

    if (process.env.NODE_ENV === 'development') {
      devLog(`[Performance] ${componentName} mounted in ${mountDuration.toFixed(2)}ms`);
    }

    return () => {
      if (process.env.NODE_ENV === 'development') {
        devLog(
          `[Performance] ${componentName} unmounted after ${metrics.current.reRenders} re-renders`
        );
      }
    };
  }, [componentName]);

  // Track render performance
  const trackRender = useCallback(() => {
    const now = performance.now();
    const renderDuration = now - lastRenderTime.current;

    if (lastRenderTime.current > 0) {
      metrics.current.reRenders++;
      metrics.current.renderTime = renderDuration;
    }

    lastRenderTime.current = now;
    renderCount.current++;

    // Memory usage (if available)
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      metrics.current.memoryUsage = memory.usedJSHeapSize / 1024 / 1024; // MB
    }

    // Log slow renders in development
    if (process.env.NODE_ENV === 'development' && renderDuration > 16) {
      console.warn(`[Performance] ${componentName} slow render: ${renderDuration.toFixed(2)}ms`);
    }
  }, [componentName]);

  // Track render on every render
  useEffect(() => {
    trackRender();
  });

  // Get current metrics
  const getMetrics = useCallback(() => {
    return {
      ...metrics.current,
      currentRenderCount: renderCount.current,
    };
  }, []);

  // Reset metrics
  const resetMetrics = useCallback(() => {
    metrics.current = {
      renderTime: 0,
      memoryUsage: 0,
      componentMounts: 0,
      reRenders: 0,
    };
    renderCount.current = 0;
    mountTime.current = performance.now();
  }, []);

  return {
    getMetrics,
    resetMetrics,
    trackRender,
  };
}

// Hook for measuring specific operations
export function useOperationTimer(operationName: string) {
  const startTime = useRef<number>(0);

  const startTimer = useCallback(() => {
    startTime.current = performance.now();
  }, []);

  const endTimer = useCallback(() => {
    if (startTime.current > 0) {
      const duration = performance.now() - startTime.current;

      if (process.env.NODE_ENV === 'development') {
        devLog(`[Performance] ${operationName} took ${duration.toFixed(2)}ms`);
      }

      startTime.current = 0;
      return duration;
    }
    return 0;
  }, [operationName]);

  return { startTimer, endTimer };
}
