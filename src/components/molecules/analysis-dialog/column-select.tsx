'use client';

import type { ColumnSlotType } from '@/lib/analysis-column-types';
import { columnSlotType, slotTypeMatchesExpected } from '@/lib/analysis-column-types';
import type { SchemaColumn } from '@/lib/analysis-report-types';
import type { WizardFieldNotice } from '@/lib/analysis-setup-validation';
import { Label } from '@/components/atoms/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/select';
import { cn } from '@/utils';

import { FieldFeedbackList } from './field-feedback';
import { SlotTypeBadge } from './slot-type-badge';

const SELECT_CONTENT_CLASS = 'z-[250]';

export function ColumnSelect({
  label,
  value,
  onChange,
  schema,
  names,
  expectedType,
  notices,
  errors,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  schema: SchemaColumn[];
  names: string[];
  expectedType?: ColumnSlotType;
  notices?: WizardFieldNotice[];
  errors?: string[];
  className?: string;
}) {
  const actual = value ? columnSlotType(schema, value) : null;
  const mismatch = !!expectedType && !!actual && !slotTypeMatchesExpected(actual, expectedType);

  const mismatchError =
    mismatch && expectedType ? `This slot expects a ${expectedType} column.` : undefined;

  const allErrors = [...(errors ?? []), ...(mismatchError ? [mismatchError] : [])];

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger className="relative h-9 min-w-0 w-full pr-8 text-left [&>svg]:pointer-events-none [&>svg]:absolute [&>svg]:right-3 [&>svg]:top-1/2 [&>svg]:-translate-y-1/2">
          {value ? (
            <div className="flex min-w-0 w-full items-center justify-start gap-2 overflow-hidden text-left">
              <span className="truncate text-sm">{value}</span>
              {actual ? (
                <SlotTypeBadge slot={actual} mismatch={mismatch} className="shrink-0" />
              ) : null}
            </div>
          ) : (
            <SelectValue placeholder="— select column —" className="text-left" />
          )}
        </SelectTrigger>
        <SelectContent className={SELECT_CONTENT_CLASS}>
          {names.map(n => {
            const slot = columnSlotType(schema, n);
            return (
              <SelectItem key={n} value={n}>
                <span className="flex w-full max-w-[280px] items-center justify-between gap-2">
                  <span className="truncate">{n}</span>
                  <SlotTypeBadge slot={slot} className="shrink-0" />
                </span>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      <FieldFeedbackList notices={notices} errors={allErrors} />
    </div>
  );
}
