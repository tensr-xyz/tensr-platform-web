import { Suspense } from 'react';
import { FlowRoot } from '@/components/flow/flow-root';
import { FlowErrorBoundary } from '@/components/flow/flow-error-boundary';
import './flow.css';

export default function FlowLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <FlowErrorBoundary>
        <Suspense fallback={null}>
          <FlowRoot />
        </Suspense>
      </FlowErrorBoundary>
      {children}
    </>
  );
}
