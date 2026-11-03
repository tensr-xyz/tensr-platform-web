'use client';

import { useEffect, useMemo } from 'react';
import { FlowErrorState, FlowStatePage } from '@/components/flow/flow-not-found';

function shortId(): string {
  const hex = Math.random().toString(16).slice(2, 10).padEnd(8, '0');
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}

export default function FlowError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const reference = useMemo(() => error.digest || shortId(), [error]);
  useEffect(() => {
    console.error('Flow page failed', reference, error);
  }, [error, reference]);
  return (
    <FlowStatePage>
      <FlowErrorState reference={reference} onRetry={reset} />
    </FlowStatePage>
  );
}
