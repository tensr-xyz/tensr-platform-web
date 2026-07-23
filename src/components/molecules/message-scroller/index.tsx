'use client';

import * as React from 'react';
import { ArrowDownIcon } from 'lucide-react';

import { cn } from '@/utils';
import { Button } from '@/components/atoms/button';

type MessageScrollerContextValue = {
  viewportRef: React.RefObject<HTMLDivElement | null>;
  stickToEnd: boolean;
  setStickToEnd: (value: boolean) => void;
  scrollToEnd: () => void;
};

const MessageScrollerContext = React.createContext<MessageScrollerContextValue | null>(null);

function useMessageScroller() {
  const ctx = React.useContext(MessageScrollerContext);
  if (!ctx) {
    throw new Error('useMessageScroller must be used within MessageScroller');
  }
  return ctx;
}

function MessageScroller({ className, children, ...props }: React.ComponentProps<'div'>) {
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const [stickToEnd, setStickToEnd] = React.useState(true);

  const scrollToEnd = React.useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    setStickToEnd(true);
  }, []);

  const value = React.useMemo(
    () => ({ viewportRef, stickToEnd, setStickToEnd, scrollToEnd }),
    [stickToEnd, scrollToEnd]
  );

  return (
    <MessageScrollerContext.Provider value={value}>
      <div
        data-slot="message-scroller"
        className={cn(
          'group/message-scroller relative flex size-full min-h-0 flex-col overflow-hidden',
          className
        )}
        {...props}
      >
        {children}
      </div>
    </MessageScrollerContext.Provider>
  );
}

function MessageScrollerViewport({ className, children, ...props }: React.ComponentProps<'div'>) {
  const { viewportRef, stickToEnd, setStickToEnd } = useMessageScroller();

  const onScroll = React.useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const distanceFromEnd = el.scrollHeight - el.scrollTop - el.clientHeight;
    setStickToEnd(distanceFromEnd < 48);
  }, [setStickToEnd, viewportRef]);

  React.useEffect(() => {
    if (!stickToEnd) return;
    const el = viewportRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [children, stickToEnd, viewportRef]);

  return (
    <div
      ref={viewportRef}
      data-slot="message-scroller-viewport"
      onScroll={onScroll}
      className={cn('size-full min-h-0 min-w-0 overflow-y-auto overscroll-contain', className)}
      {...props}
    >
      {children}
    </div>
  );
}

function MessageScrollerContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="message-scroller-content"
      className={cn('flex h-max min-h-full flex-col gap-4', className)}
      {...props}
    />
  );
}

function MessageScrollerItem({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="message-scroller-item"
      className={cn('min-w-0 shrink-0', className)}
      {...props}
    />
  );
}

function MessageScrollerButton({
  className,
  children,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { stickToEnd, scrollToEnd } = useMessageScroller();

  return (
    <Button
      type="button"
      variant="secondary"
      size="icon"
      data-slot="message-scroller-button"
      data-active={!stickToEnd}
      onClick={scrollToEnd}
      className={cn(
        'absolute bottom-4 left-1/2 z-10 -translate-x-1/2 border border-border bg-background text-foreground transition-[transform,opacity] duration-200',
        stickToEnd
          ? 'pointer-events-none translate-y-full scale-95 opacity-0'
          : 'translate-y-0 scale-100 opacity-100',
        className
      )}
      {...props}
    >
      {children ?? (
        <>
          <ArrowDownIcon />
          <span className="sr-only">Scroll to end</span>
        </>
      )}
    </Button>
  );
}

export {
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
  useMessageScroller,
};
