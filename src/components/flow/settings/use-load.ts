'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { errorText } from './settings-data';

export type Load<T> =
  | { phase: 'loading' }
  | { phase: 'error'; error: string }
  | { phase: 'ready'; data: T };

export type LoadOptions<T> = {
  /** A cached answer to draw at once. The screen then refreshes it quietly, never via the skeleton. */
  peek?: () => T | undefined;
  /** Drops cached answers before `retry` and `reload`, so they always fetch fresh. */
  invalidate?: () => void;
};

/** The first state for a screen: ready from the cache when there is an answer, else loading. */
export function initialLoad<T>(cached: T | undefined): Load<T> {
  return cached === undefined ? { phase: 'loading' } : { phase: 'ready', data: cached };
}

/** One request set per screen. `reload` refreshes in place without going back to the skeleton. */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[], options: LoadOptions<T> = {}) {
  const [state, setState] = useState<Load<T>>(() => initialLoad(options.peek?.()));
  const loadRef = useRef(load);
  loadRef.current = load;
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const run = useCallback(async (quiet: boolean) => {
    if (!quiet) setState({ phase: 'loading' });
    try {
      const data = await loadRef.current();
      setState({ phase: 'ready', data });
    } catch (error) {
      if (!quiet)
        setState({ phase: 'error', error: errorText(error, 'Could not load this page.') });
    }
  }, []);
  useEffect(() => {
    const cached = optionsRef.current.peek?.();
    if (cached !== undefined) setState({ phase: 'ready', data: cached });
    void run(cached !== undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return {
    state,
    retry: () => {
      optionsRef.current.invalidate?.();
      return run(false);
    },
    reload: () => {
      optionsRef.current.invalidate?.();
      return run(true);
    },
    setData: (update: (data: T) => T) =>
      setState(current =>
        current.phase === 'ready' ? { ...current, data: update(current.data) } : current
      ),
  };
}
