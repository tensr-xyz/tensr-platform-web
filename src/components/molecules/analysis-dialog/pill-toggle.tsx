'use client';

import * as React from 'react';

import { ToggleGroup, ToggleGroupItem } from '@/components/molecules/toggle-group';
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
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={next => {
        if (next) onChange(next as T);
      }}
      aria-label={ariaLabel}
      spacing={0}
      className="w-full gap-1 rounded-md border border-border p-0.5"
    >
      {options.map(opt => (
        <ToggleGroupItem
          key={opt.value}
          value={opt.value}
          disabled={opt.disabled}
          title={opt.disabled ? opt.disabledReason : undefined}
          className={cn(
            'h-auto flex-1 rounded px-2 py-1.5 text-center text-[11px] font-medium shadow-none',
            'data-[state=on]:bg-primary/15 data-[state=on]:text-primary',
            'data-[state=off]:border-transparent data-[state=off]:text-muted-foreground data-[state=off]:hover:bg-transparent data-[state=off]:hover:text-foreground',
            opt.disabled && 'pointer-events-none opacity-40'
          )}
        >
          {opt.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
