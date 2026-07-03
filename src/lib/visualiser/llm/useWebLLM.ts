'use client';

import { useState, useCallback, useEffect } from 'react';
import { chatOnce, checkWebGPUSupport, getEngine, type ChatMessage } from './webllmClient';
import { devLog } from '@/lib/dev-log';

export interface UseWebLLMReturn {
  isReady: boolean;
  isLoading: boolean;
  isInitializing: boolean;
  hasWebGPU: boolean | null;
  error: string | null;
  ask: (messages: ChatMessage[]) => Promise<string>;
  ensureReady: () => Promise<void>;
}

/**
 * React hook for managing WebLLM interactions
 */
export function useWebLLM(): UseWebLLMReturn {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [hasWebGPU, setHasWebGPU] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check WebGPU support on mount
  useEffect(() => {
    checkWebGPUSupport()
      .then(supported => {
        setHasWebGPU(supported);
        if (!supported) {
          console.warn('WebGPU not available, will fallback to WASM/CPU (slower)');
        }
      })
      .catch(() => setHasWebGPU(false));
  }, []);

  const ensureReady = useCallback(async () => {
    if (isReady) return;
    if (isInitializing) {
      devLog('WebLLM: Already initializing, skipping...');
      return;
    }

    devLog('WebLLM: Starting model initialization...');
    setIsInitializing(true);
    setError(null);

    try {
      // Get engine (this triggers model loading)
      devLog('WebLLM: Getting engine...');
      await getEngine();
      devLog('WebLLM: Engine created, testing with ping message...');

      // Trigger model load by sending a simple ping message
      const response = await chatOnce([{ role: 'user', content: 'ping' }]);
      devLog('WebLLM: Model initialized successfully, ping response:', response.substring(0, 50));
      setIsReady(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize model';
      setError(errorMessage);
      console.error('WebLLM initialization error:', err);
    } finally {
      setIsInitializing(false);
    }
  }, [isReady, isInitializing]);

  const ask = useCallback(
    async (messages: ChatMessage[]): Promise<string> => {
      await ensureReady();

      setIsLoading(true);
      setError(null);

      try {
        const response = await chatOnce(messages);
        return response;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to get response';
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [ensureReady]
  );

  return {
    isReady,
    isLoading,
    isInitializing,
    hasWebGPU,
    error,
    ask,
    ensureReady,
  };
}
