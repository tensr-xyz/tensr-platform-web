'use client';

import { useMemo, useState } from 'react';
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
import type { SavedAudience } from '@/components/flow/audience-panel';
import {
  audienceBannerSizeLabel,
  type TableBannerRef,
  tableBannerKey,
} from '@/components/flow/table-banner-refs';

type QuestionOption = { value: string; label: string; keywords?: string };

/** Paper 5d: banner "+" lists saved audiences first, then questions. */
export function BannerAddPicker({
  audiences,
  questions,
  selected,
  stub,
  onPick,
}: {
  audiences: SavedAudience[];
  questions: QuestionOption[];
  selected: TableBannerRef[];
  stub: string;
  onPick: (ref: TableBannerRef) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedKeys = useMemo(() => new Set(selected.map(tableBannerKey)), [selected]);
  const availableAudiences = audiences.filter(audience => {
    const name = String(audience.name || '').trim();
    if (!name) return false;
    return !selectedKeys.has(tableBannerKey({ kind: 'audience', name, label: name }));
  });
  const availableQuestions = questions.filter(
    item =>
      item.value &&
      item.value !== stub &&
      !selectedKeys.has(tableBannerKey({ kind: 'column', column: item.value }))
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-label="Add banner"
          className="flow-input h-9 justify-between rounded-[8px] px-3 text-left text-[13px] font-normal"
        >
          <span>+</span>
          <span className="flow-muted shrink-0">▾</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="tables-banner-picker w-[min(19rem,calc(100vw-2rem))] p-2"
        sideOffset={4}
      >
        <Command>
          <CommandInput placeholder="Search questions and audiences…" />
          <CommandList>
            <CommandEmpty>No matching question or audience</CommandEmpty>
            {availableAudiences.length ? (
              <CommandGroup heading="Saved audiences">
                {availableAudiences.map(audience => {
                  const name = String(audience.name || '').trim();
                  const label = String(audience.label || name).trim() || name;
                  const size = audienceBannerSizeLabel(audience);
                  return (
                    <CommandItem
                      key={`audience:${name}`}
                      value={`${label} ${name} audience`}
                      className="tables-banner-picker-row"
                      onSelect={() => {
                        onPick({
                          kind: 'audience',
                          name,
                          label,
                          ...(audience.filter ? { filter: audience.filter } : {}),
                        });
                        setOpen(false);
                      }}
                    >
                      <span className="tables-banner-picker-name">{label}</span>
                      {size ? <span className="tables-banner-picker-size">{size}</span> : null}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ) : null}
            {availableAudiences.length ? (
              <p className="tables-banner-picker-note">
                Adds a column per audience next to Total, over all respondents
              </p>
            ) : null}
            <CommandGroup heading="Questions">
              {availableQuestions.map(item => (
                <CommandItem
                  key={item.value}
                  value={`${item.label} ${item.keywords || ''} ${item.value}`}
                  className="tables-banner-picker-row"
                  onSelect={() => {
                    onPick({ kind: 'column', column: item.value });
                    setOpen(false);
                  }}
                >
                  <span className="tables-banner-picker-name">{item.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function bannerChipClass(ref: TableBannerRef): string {
  return cn('tables-chip-wrap', ref.kind === 'audience' && 'accent');
}
