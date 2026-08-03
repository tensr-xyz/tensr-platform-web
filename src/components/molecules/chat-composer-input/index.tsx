'use client';

import * as React from 'react';
import { cn } from '@/utils';

type Props = Omit<React.ComponentProps<'textarea'>, 'rows'> & {
  maxHeight?: number;
  /** True once the field needs more than a single line (wrap or Shift+Enter). */
  onExpandedChange?: (expanded: boolean) => void;
};

const SINGLE_LINE_PX = 20; // text-[13px] leading-5

/**
 * Chat composer field — plain textarea without form Textarea defaults (flex,
 * text-base/md:text-sm, min-h-[60px]) that misalign caret vs placeholder.
 */
export const ChatComposerInput = React.forwardRef<HTMLTextAreaElement, Props>(
  function ChatComposerInput(
    { className, value, onChange, maxHeight = 160, onExpandedChange, ...props },
    forwardedRef
  ) {
    const innerRef = React.useRef<HTMLTextAreaElement>(null);
    const expandedRef = React.useRef(false);

    const setRefs = React.useCallback(
      (node: HTMLTextAreaElement | null) => {
        innerRef.current = node;
        if (typeof forwardedRef === 'function') forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      },
      [forwardedRef]
    );

    const syncHeight = React.useCallback(() => {
      const el = innerRef.current;
      if (!el) return;
      el.style.height = '0px';
      const scroll = el.scrollHeight;
      const next = Math.min(scroll, maxHeight);
      el.style.height = `${next}px`;
      el.style.overflowY = scroll > maxHeight ? 'auto' : 'hidden';

      const expanded = scroll > SINGLE_LINE_PX + 2 || String(value ?? '').includes('\n');
      if (expanded !== expandedRef.current) {
        expandedRef.current = expanded;
        onExpandedChange?.(expanded);
      }
    }, [maxHeight, onExpandedChange, value]);

    React.useLayoutEffect(() => {
      syncHeight();
    }, [value, syncHeight]);

    return (
      <textarea
        ref={setRefs}
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
);
