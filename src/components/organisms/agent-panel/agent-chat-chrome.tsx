import type { MouseEvent } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/utils';

export const CHAT_THREAD_CLOSE_BUTTON_CLASS =
  'mr-0.5 cursor-pointer rounded p-0.5 text-muted-foreground opacity-0 hover:bg-muted hover:text-foreground group-hover:opacity-100';

export function AgentWorkingLabel({ className }: { className?: string }) {
  return (
    <span
      className={cn('animate-pulse text-sm text-muted-foreground', className)}
      aria-live="polite"
    >
      Working
    </span>
  );
}

export function ChatThreadCloseButton({
  title,
  onClick,
}: {
  title: string;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={CHAT_THREAD_CLOSE_BUTTON_CLASS}
      aria-label={`Close ${title}`}
    >
      <X className="size-3" />
    </button>
  );
}
