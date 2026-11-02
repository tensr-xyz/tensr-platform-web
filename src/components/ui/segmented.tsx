'use client';

import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';

/** Cards/Table, Ask/Plan/Agent, and Sheet/Notebook/Themes. One control, Paper's track. */
export function Segmented<T extends string>({
  value,
  onValueChange,
  options,
  className,
  'aria-label': ariaLabel,
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: { value: T; label: ReactNode }[];
  className?: string;
  'aria-label'?: string;
}) {
  return (
    <div className={className} role="group" aria-label={ariaLabel}>
      {options.map(option => (
        <Button
          key={option.value}
          type="button"
          data-active={value === option.value}
          aria-pressed={value === option.value}
          onClick={() => onValueChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
