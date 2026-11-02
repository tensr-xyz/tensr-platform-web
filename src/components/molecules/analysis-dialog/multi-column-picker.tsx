'use client';

import * as React from 'react';
import { X } from 'lucide-react';

import type { ColumnSlotType } from '@/lib/analysis-column-types';
import { columnSlotType } from '@/lib/analysis-column-types';
import type { SchemaColumn } from '@/lib/analysis-report-types';
import type { WizardFieldNotice } from '@/lib/analysis-setup-validation';
import { Input } from '@/components/atoms/input';
import { cn } from '@/utils';

import { FieldFeedbackList } from './field-feedback';
import { SlotTypeBadge } from './slot-type-badge';

export function MultiColumnPicker({
  selected,
  onChange,
  schema,
  filterSlot,
  emptyHint = 'No columns selected',
  showEmptyIncludesAll = false,
  showTypeShortcuts = false,
  minSelected,
  selectionNoun = 'column',
  revealSelectionError,
  notices,
  errors,
  className,
  id,
}: {
  selected: string[];
  onChange: (cols: string[]) => void;
  schema: SchemaColumn[];
  /** When set, shortcut links and row styling can emphasize matching types. */
  filterSlot?: ColumnSlotType;
  emptyHint?: string;
  showEmptyIncludesAll?: boolean;
  showTypeShortcuts?: boolean;
  minSelected?: number;
  /** Singular noun in the empty-selection message. */
  selectionNoun?: string;
  /**
   * Undefined shows the minimum as soon as the field is empty.
   * False waits until the user changes the selection. True shows it now.
   */
  revealSelectionError?: boolean;
  notices?: WizardFieldNotice[];
  errors?: string[];
  className?: string;
  id?: string;
}) {
  const [query, setQuery] = React.useState('');
  const [touched, setTouched] = React.useState(false);
  const allNames = schema.map(c => c.name);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allNames;
    return allNames.filter(n => n.toLowerCase().includes(q));
  }, [allNames, query]);

  const changeSelection = (cols: string[]) => {
    setTouched(true);
    onChange(cols);
  };

  const toggle = (name: string) => {
    if (selected.includes(name)) {
      changeSelection(selected.filter(c => c !== name));
    } else {
      changeSelection([...selected, name]);
    }
  };

  const selectBySlot = (slot: ColumnSlotType) => {
    const names = schema.filter(c => columnSlotType(schema, c.name) === slot).map(c => c.name);
    const merged = new Set([...selected, ...names]);
    changeSelection([...merged]);
  };

  const noun = selectionNoun.trim() || 'column';
  const minMessage =
    minSelected === 1
      ? `Select at least one ${noun}.`
      : `Select at least ${minSelected} ${noun === 'variable' ? 'variables' : 'columns'}.`;
  const showMinError =
    revealSelectionError === undefined ? true : revealSelectionError || touched;

  const emptyMessage = showEmptyIncludesAll
    ? 'Leave empty to include all applicable columns'
    : emptyHint;

  const belowMinimum =
    minSelected != null &&
    selected.length < minSelected &&
    (selected.length > 0 || !showEmptyIncludesAll);
  const minError = showMinError && belowMinimum ? minMessage : undefined;

  const allErrors = [...(errors ?? []), ...(minError ? [minError] : [])];

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="min-h-[2rem] rounded-md border border-border bg-muted/20 px-2 py-1.5">
        {selected.length ? (
          <div className="flex flex-wrap gap-1">
            {selected.map(name => (
              <span
                key={name}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-1.5 py-0.5 text-[11px]"
              >
                <span className="max-w-[140px] truncate">{name}</span>
                <button
                  type="button"
                  className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={`Remove ${name}`}
                  onClick={() => changeSelection(selected.filter(c => c !== name))}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">{emptyMessage}</p>
        )}
      </div>

      <Input
        id={id}
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search columns…"
        className="h-8 text-xs"
      />

      {showTypeShortcuts ? (
        <div className="flex flex-wrap gap-3 text-[11px]">
          <button
            type="button"
            className="text-primary underline-offset-2 hover:underline"
            onClick={() => selectBySlot('numeric')}
          >
            Select all numeric
          </button>
          <button
            type="button"
            className="text-primary underline-offset-2 hover:underline"
            onClick={() => selectBySlot('categorical')}
          >
            Select all categorical
          </button>
        </div>
      ) : null}

      <div className="max-h-40 overflow-y-auto rounded-md border border-border">
        {filtered.map(name => {
          const slot = columnSlotType(schema, name);
          const isSelected = selected.includes(name);
          const dimmed = filterSlot != null && slot !== filterSlot && !isSelected;
          return (
            <button
              key={name}
              type="button"
              onClick={() => toggle(name)}
              className={cn(
                'flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-xs',
                isSelected && 'bg-sky-100/80 dark:bg-sky-950/40',
                !isSelected && 'hover:bg-muted/50',
                dimmed && 'opacity-60'
              )}
            >
              <span className="truncate">{name}</span>
              <SlotTypeBadge slot={slot} />
            </button>
          );
        })}
        {!filtered.length ? (
          <p className="px-2.5 py-3 text-center text-[11px] text-muted-foreground">
            No columns match.
          </p>
        ) : null}
      </div>

      <FieldFeedbackList notices={notices} errors={allErrors} />
    </div>
  );
}
