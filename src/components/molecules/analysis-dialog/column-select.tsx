'use client';

import type { ColumnSlotType } from '@/lib/analysis-column-types';
import {
  columnHeading,
  columnSlotType,
  slotTypeMatchesExpected,
} from '@/lib/analysis-column-types';
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
  allowEmpty = false,
  emptyLabel = 'None',
  id,
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
  allowEmpty?: boolean;
  emptyLabel?: string;
  id?: string;
}) {
  const chosen = value ? schema.find(column => column.name === value) : undefined;
  const actual = value ? columnSlotType(schema, value) : null;
  const mismatch =
    !!expectedType && !!actual && !slotTypeMatchesExpected(actual, expectedType, chosen);
  const chosenHeading = columnHeading(chosen, value);

  const mismatchError =
    mismatch && expectedType ? `This slot expects a ${expectedType} column.` : undefined;

  const allErrors = [...(errors ?? []), ...(mismatchError ? [mismatchError] : [])];

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label ? <Label className="text-xs text-muted-foreground">{label}</Label> : null}
      <Select
        value={value || (allowEmpty ? '__none__' : undefined)}
        onValueChange={next => onChange(next === '__none__' ? '' : next)}
      >
        <SelectTrigger
          id={id}
          className="relative h-9 min-w-0 w-full pr-8 text-left [&>svg]:pointer-events-none [&>svg]:absolute [&>svg]:right-3 [&>svg]:top-1/2 [&>svg]:-translate-y-1/2"
        >
          {value ? (
            <div className="flex min-w-0 w-full items-center justify-start gap-2 overflow-hidden text-left">
              <span className="truncate text-sm">{chosenHeading.primary}</span>
              {actual ? (
                <SlotTypeBadge slot={actual} mismatch={mismatch} className="shrink-0" />
              ) : null}
            </div>
          ) : (
            <span className="truncate text-sm text-muted-foreground">
              {allowEmpty ? emptyLabel : '— select column —'}
            </span>
          )}
        </SelectTrigger>
        <SelectContent className={SELECT_CONTENT_CLASS}>
          {allowEmpty ? <SelectItem value="__none__">{emptyLabel}</SelectItem> : null}
          {names.map(n => {
            const column = schema.find(item => item.name === n);
            const slot = columnSlotType(schema, n);
            const heading = columnHeading(column, n);
            return (
              <SelectItem key={n} value={n}>
                <span className="flex w-full max-w-[280px] items-center justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate">{heading.primary}</span>
                    {heading.secondary ? (
                      <span className="block truncate text-[10px] text-muted-foreground">
                        {heading.secondary}
                      </span>
                    ) : null}
                  </span>
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
