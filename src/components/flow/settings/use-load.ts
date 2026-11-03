'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { errorText } from './settings-data';

export type Load<T> =
  | { phase: 'loading' }
  | { phase: 'error'; error: string }
  | { phase: 'ready'; data: T };

/** One request set per screen. `reload` refreshes in place without going back to the skeleton. */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<Load<T>>({ phase: 'loading' });
  const loadRef = useRef(load);
  loadRef.current = load;
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
    void run(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return {
    state,
    retry: () => run(false),
    reload: () => run(true),
    setData: (update: (data: T) => T) =>
      setState(current =>
        current.phase === 'ready' ? { ...current, data: update(current.data) } : current
      ),
  };
}
