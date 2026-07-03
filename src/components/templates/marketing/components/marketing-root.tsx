'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const PAGE_ATTRS: Record<string, { page: string; hero?: string }> = {
  '/': { page: 'home', hero: 'split' },
  '/features': { page: 'features' },
  '/pricing': { page: 'pricing' },
  '/enterprise': { page: 'enterprise' },
  '/download': { page: 'download' },
};

export function MarketingRoot({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const attrs = PAGE_ATTRS[pathname] ?? { page: 'marketing' };

  return (
    <div className="tensr-marketing" data-page={attrs.page} data-hero={attrs.hero}>
      {children}
    </div>
  );
}
