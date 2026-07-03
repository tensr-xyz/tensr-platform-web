'use client';

import { cn } from '@/utils';
import { MEASUREMENT_LEVELS, type MeasurementLevel } from '@/lib/measurement-level';

const LABELS: Record<MeasurementLevel, string> = {
  scale: 'Scale',
  ordinal: 'Ordinal',
  nominal: 'Nominal',
};

interface MeasurementLevelControlProps {
  value: MeasurementLevel;
  onChange: (level: MeasurementLevel) => void;
  disabled?: boolean;
  className?: string;
}

export function MeasurementLevelControl({
  value,
  onChange,
  disabled = false,
  className,
}: MeasurementLevelControlProps) {
  return (
    <div
      className={cn('px-2 py-2', className)}
      onPointerDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    >
      <p className="mb-1.5 px-0.5 text-xs font-medium text-muted-foreground">Measurement level</p>
      <div
        className="flex rounded-md border border-border bg-muted/30 p-0.5"
        role="group"
        aria-label="Measurement level"
      >
        {MEASUREMENT_LEVELS.map(level => {
          const active = value === level;
          return (
            <button
              key={level}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              className={cn(
                'flex-1 rounded-sm px-2 py-1 text-xs font-medium transition-colors',
                active
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
                disabled && 'cursor-not-allowed opacity-50'
              )}
              onClick={() => onChange(level)}
            >
              {LABELS[level]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
