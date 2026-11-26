import { useEffect, useState, type MouseEvent } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/atoms/button';
import { isPulseOnlyWorkingLine } from '@/lib/agent-analysis-progress';
import { cn } from '@/utils';

export const CHAT_THREAD_CLOSE_BUTTON_CLASS =
  'mr-0.5 cursor-pointer rounded p-0.5 text-muted-foreground opacity-0 hover:bg-muted hover:text-foreground group-hover:opacity-100';

export function visibleThinkingLines(
  thinkingLines: string[] | undefined,
  { isStreaming }: { hasResult: boolean; isStreaming: boolean }
): string[] {
  if (!thinkingLines?.length) return [];
  if (!isStreaming) return [];
  return thinkingLines.filter(line => !isPulseOnlyWorkingLine(line));
}

/** Append a progress line without dropping earlier steps (needed for live SSE). */
export function accumulateThinkingLines(prev: string[] | undefined, next: string): string[] {
  const trimmed = next.trim();
  if (!trimmed) return prev ?? [];
  if (prev?.includes(trimmed)) return prev;
  return [...(prev ?? []), trimmed];
}

/** Paper 14b: big-table building card (Loaded N of M columns, Building the table). */
export function isBuildingTableProgress(lines: string[]): boolean {
  return lines.some(line =>
    /building the table|loaded\s+[\d,]+\s+of\s+[\d,]+\s+columns|counting weighted/i.test(line)
  );
}

function stripStepMarker(line: string): string {
  return line.replace(/^[✓●•]\s*/, '').trim();
}

function loadedColumnProgress(lines: string[]): { loaded: number; total: number } | null {
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const match = lines[i]?.match(/loaded\s+([\d,]+)\s+of\s+([\d,]+)\s+columns/i);
    if (!match) continue;
    const loaded = Number(match[1].replace(/,/g, ''));
    const total = Number(match[2].replace(/,/g, ''));
    if (Number.isFinite(loaded) && Number.isFinite(total) && total > 0) {
      return { loaded, total };
    }
  }
  return null;
}

function formatElapsedHint(elapsedSec: number): string {
  const usual = elapsedSec < 20 ? 'usually under 30s' : 'still working';
  return `${elapsedSec}s · ${usual}`;
}

export function BuildingTableCard({
  lines,
  isStreaming,
  className,
}: {
  lines: string[];
  isStreaming: boolean;
  className?: string;
}) {
  const [elapsedSec, setElapsedSec] = useState(0);
  useEffect(() => {
    if (!isStreaming) return;
    const started = Date.now();
    setElapsedSec(0);
    const tick = window.setInterval(() => {
      setElapsedSec(Math.max(0, Math.floor((Date.now() - started) / 1000)));
    }, 1000);
    return () => window.clearInterval(tick);
  }, [isStreaming, lines[0]]);

  const columnProgress = loadedColumnProgress(lines);
  const stepFraction =
    lines.length <= 1
      ? 0.2
      : Math.min(0.92, (lines.length - (isStreaming ? 0.35 : 0)) / Math.max(lines.length, 3));
  const barPct = columnProgress
    ? Math.min(92, Math.max(8, Math.round((columnProgress.loaded / columnProgress.total) * 100)))
    : Math.round(stepFraction * 100);

  const titleLine = lines.find(line => /building the table/i.test(line));
  const title = titleLine ? stripStepMarker(titleLine) : 'Building the table';
  const bodyLines = lines.filter(line => !/building the table/i.test(line));

  return (
    <div
      className={cn(
        'mt-2 flex flex-col gap-3 rounded-[10px] border border-[#E7E6E1] bg-white px-5 py-[18px]',
        className
      )}
      data-testid="building-table-card"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[15px] font-semibold leading-[18px] text-[#1B1C1A]">{title}</p>
        <p className="shrink-0 text-[13px] leading-4 text-[#6A6B66]">
          {formatElapsedHint(elapsedSec)}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {(bodyLines.length ? bodyLines : lines).map((line, i, list) => {
          const isLast = i === list.length - 1;
          const active = isLast && isStreaming;
          const done = !active;
          const text = stripStepMarker(line);
          return (
            <p
              key={`${i}-${text.slice(0, 32)}`}
              className={cn(
                'text-[14px] leading-[18px]',
                active ? 'font-semibold text-[#1E6B58]' : 'font-normal text-[#1B1C1A]'
              )}
            >
              {done ? `✓ ${text}` : `● ${text}`}
            </p>
          );
        })}
      </div>
      <div className="flex h-1 w-full shrink-0 overflow-hidden rounded-[2px] bg-[#F6F6F3]">
        <div
          className="h-full rounded-[2px] bg-[#1E6B58] transition-[width] duration-500 ease-out"
          style={{ width: `${barPct}%` }}
        />
      </div>
      <p className="text-[13px] leading-4 text-[#6A6B66]">
        You can keep working. The answer is written here when the numbers land.
      </p>
    </div>
  );
}

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
    <Button
      type="button"
      variant="ghost"
      size="compact"
      onClick={onClick}
      className={cn('size-5', CHAT_THREAD_CLOSE_BUTTON_CLASS)}
      aria-label={`Close ${title}`}
    >
      <X className="size-3" />
    </Button>
  );
}
