'use client';

import { Input } from '@/components/atoms/input';
import { Label } from '@/components/atoms/label';
import { cn } from '@/utils';

import { FieldError } from './field-feedback';

export function NumericField({
  label,
  value,
  onChange,
  hint,
  error,
  className,
  inputClassName,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  error?: string;
  className?: string;
  inputClassName?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={e => onChange(e.target.value)}
        className={cn('h-8 font-mono text-xs', inputClassName)}
      />
      {hint ? <p className="text-[10px] leading-snug text-muted-foreground">{hint}</p> : null}
      {error ? <FieldError message={error} /> : null}
    </div>
  );
}
