'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/select';
import { cn } from '@/utils';

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };

const EMPTY = '__empty__';

export function ChoiceSelect({
  value,
  onValueChange,
  options,
  placeholder,
  className,
  'aria-label': ariaLabel,
  disabled,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
  disabled?: boolean;
}) {
  const items = options.map(option => ({
    value: option.value === '' ? EMPTY : option.value,
    label: option.label,
  }));
  const current = value === '' ? EMPTY : value;
  if (current && !items.some(item => item.value === current)) {
    items.unshift({ value: current, label: value || placeholder || 'Selected' });
  }
  return (
    <Select
      value={current}
      onValueChange={next => onValueChange(next === EMPTY ? '' : next)}
      disabled={disabled}
    >
      <SelectTrigger
        aria-label={ariaLabel}
        className={cn('h-9 rounded-[8px] text-[13px]', className)}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {items.map(item => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
