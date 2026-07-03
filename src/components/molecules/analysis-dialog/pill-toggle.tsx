'use client';

import * as React from 'react';

import { cn } from '@/utils';

export type PillOption<T extends string> = {
  value: T;
  label: string;
  disabled?: boolean;
  disabledReason?: string;
};

export function PillToggle<T extends string>({
  value,
  onChange,
  options,
  'aria-label': ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: PillOption<T>[];
  'aria-label'?: string;
}) {
  return (
    <div
      className="flex w-full gap-1 rounded-md border border-border p-0.5"
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          disabled={opt.disabled}
          title={opt.disabled ? opt.disabledReason : undefined}
          onClick={() => !opt.disabled && onChange(opt.value)}
          className={cn(
            'flex-1 rounded px-2 py-1.5 text-center text-[11px] font-medium transition-colors',
            value === opt.value
              ? 'bg-primary/15 text-primary'
              : 'border border-transparent text-muted-foreground hover:text-foreground',
            opt.disabled && 'pointer-events-none opacity-40'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
