'use client';

import Link from 'next/link';
import { Button } from '@/components/atoms/button';
import { Sparkles } from 'lucide-react';

export default function CreatorComingSoon() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-6 py-24 text-center">
      <Sparkles className="mb-4 h-10 w-10 text-muted-foreground" aria-hidden />
      <h1 className="text-xl font-medium tracking-tight">Creator dashboard</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Plugin creator tools (stats, payouts, Stripe Connect) are not available in this release.
        Browse and run plugins from the marketplace in the meantime.
      </p>
      <Button asChild className="mt-8" variant="outline">
        <Link href="/plugins">Go to plugin marketplace</Link>
      </Button>
    </div>
  );
}
