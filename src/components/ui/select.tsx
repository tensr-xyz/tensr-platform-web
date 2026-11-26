'use client';

import { useMemo, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/select';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/rest';
import { cn } from '@/utils';

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };

const EMPTY = '__empty__';
const SEARCH_FROM = 12;

export function ChoiceSelect({
  value,
  onValueChange,
  options,
  placeholder,
  className,
  'aria-label': ariaLabel,
  disabled,
  searchable,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string; keywords?: string }[];
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
  disabled?: boolean;
  /** Force a search box. Defaults on when there are many options. */
  searchable?: boolean;
}) {
  const items = useMemo(
    () =>
      options
        .map(option => ({
          value: option.value === '' ? EMPTY : option.value,
          label: option.label,
          keywords: String(option.keywords || '').trim(),
        }))
        .filter((item, index, all) => all.findIndex(other => other.value === item.value) === index),
    [options]
  );
  const hasEmpty = items.some(item => item.value === EMPTY);
  // An empty value with no empty option shows the placeholder; it is not a choice in the list.
  const current = value === '' ? (hasEmpty ? EMPTY : '') : value;
  const listed = [...items];
  if (current && !listed.some(item => item.value === current)) {
    listed.unshift({
      value: current,
      label: value || placeholder || 'Selected',
      keywords: '',
    });
  }
  const useSearch = searchable ?? listed.length >= SEARCH_FROM;
  const [open, setOpen] = useState(false);
  const selectedLabel =
    listed.find(item => item.value === current)?.label || placeholder || 'Choose…';

  if (useSearch) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-label={ariaLabel}
            disabled={disabled}
            className={cn(
              'flow-input h-9 justify-between rounded-[8px] px-3 text-left text-[13px] font-normal',
              className
            )}
          >
            <span className="truncate">{selectedLabel}</span>
            <span className="flow-muted shrink-0">▾</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[min(28rem,calc(100vw-2rem))] p-0"
          sideOffset={4}
        >
          <Command>
            <CommandInput placeholder="Search questions…" />
            <CommandList>
              <CommandEmpty>No matching question</CommandEmpty>
              <CommandGroup>
                {listed.map(item => (
                  <CommandItem
                    key={item.value}
                    value={`${item.label} ${item.keywords || ''} ${item.value === EMPTY ? '' : item.value}`}
                    onSelect={() => {
                      onValueChange(item.value === EMPTY ? '' : item.value);
                      setOpen(false);
                    }}
                  >
                    {item.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
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
        {listed.map(item => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
