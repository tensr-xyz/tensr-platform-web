'use client';

import { Suspense, use } from 'react';
import { FlowApp } from '@/components/flow/flow-app';

export default function FlowPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = use(params);
  return (
    <Suspense fallback={null}>
      <FlowApp slug={slug || []} />
    </Suspense>
  );
}
