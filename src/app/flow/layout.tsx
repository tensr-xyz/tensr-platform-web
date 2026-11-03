import { Suspense } from 'react';
import { FlowRoot } from '@/components/flow/flow-root';
import './flow.css';

export default function FlowLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <FlowRoot />
      </Suspense>
      {children}
    </>
  );
}
