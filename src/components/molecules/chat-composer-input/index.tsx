'use client';

import * as React from 'react';
import { cn } from '@/utils';

type Props = Omit<React.ComponentProps<'textarea'>, 'rows'> & {
  maxHeight?: number;
};

/**
 * Chat composer field — plain textarea without form Textarea defaults (flex,
 * text-base/md:text-sm, min-h-[60px]) that misalign caret vs placeholder.
 */
export function ChatComposerInput({
  className,
  value,
  onChange,
  maxHeight = 120,
  ...props
}: Props) {
  const ref = React.useRef<HTMLTextAreaElement>(null);

  const syncHeight = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = '0px';
    const next = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [maxHeight]);

  React.useLayoutEffect(() => {
    syncHeight();
  }, [value, syncHeight]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={e => {
        onChange?.(e);
        syncHeight();
      }}
      className={cn(
        'block w-full resize-none border-0 bg-transparent p-0',
        'text-[13px] leading-5 text-foreground',
        'placeholder:text-muted-foreground',
        'outline-none focus-visible:ring-0',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  );
}
