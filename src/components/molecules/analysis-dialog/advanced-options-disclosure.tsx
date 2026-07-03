'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';

import { cn } from '@/utils';

export function AdvancedOptionsDisclosure({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className={cn('pt-2', className)}>
      <button
        type="button"
        className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        Advanced options
        <ChevronDown
          className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>
      {open ? <div className="mt-3 space-y-4 border-t border-border pt-3">{children}</div> : null}
    </div>
  );
}
