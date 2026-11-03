'use client';

import { useParams } from 'next/navigation';
import { FlowApp } from '@/components/flow/flow-app';

/**
 * Rendered from the flow layout so it stays mounted across tab changes.
 * A page under a dynamic segment remounts when its params change, which reloaded
 * the whole workspace on every tab.
 */
export function FlowRoot() {
  const params = useParams<{ slug?: string[] }>();
  const slug = Array.isArray(params?.slug)
    ? params.slug
    : params?.slug
      ? [String(params.slug)]
      : [];
  return <FlowApp slug={slug} />;
}
