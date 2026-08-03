'use client';

import * as React from 'react';
import { cn } from '@/utils';

type Props = Omit<React.ComponentProps<'textarea'>, 'rows'> & {
  maxHeight?: number;
  /** True once the field needs more than a single line (wrap or Shift+Enter). */
  onExpandedChange?: (expanded: boolean) => void;
};

const SINGLE_LINE_PX = 28; // min-h-7 / leading-7 — matches size-7 buttons

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
    const [expanded, setExpanded] = React.useState(false);

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
      // Never shrink below one control-height line so text stays vertically centered with buttons.
      const next = Math.min(Math.max(scroll, SINGLE_LINE_PX), maxHeight);
      el.style.height = `${next}px`;
      el.style.overflowY = scroll > maxHeight ? 'auto' : 'hidden';

      const nextExpanded = scroll > SINGLE_LINE_PX + 2 || String(value ?? '').includes('\n');
      setExpanded(prev => {
        if (prev !== nextExpanded) onExpandedChange?.(nextExpanded);
        return nextExpanded;
      });
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
          'text-[13px] text-foreground',
          // Single line: leading matches size-7 buttons. Multi-line: tighter leading.
          expanded ? 'leading-5' : 'min-h-7 leading-7',
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
