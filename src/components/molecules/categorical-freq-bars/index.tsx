'use client';

import { cn } from '@/utils';

type Freq = { value: string; count: number; percentage?: number };

type Props = {
  frequencies: Freq[];
  width?: number;
  height?: number;
  className?: string;
};

/** Tiny horizontal bars for top categorical values (header at-a-glance). */
export function CategoricalFreqBars({ frequencies, width = 40, height = 12, className }: Props) {
  const top = [...frequencies].sort((a, b) => b.count - a.count).slice(0, 4);
  if (top.length === 0) return null;

  const max = Math.max(1, ...top.map(f => f.count));
  const barH = Math.max(2, Math.floor((height - 2) / top.length));

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn('shrink-0 text-primary/70', className)}
      aria-hidden
    >
      {top.map((f, i) => {
        const w = Math.max(2, (f.count / max) * (width - 2));
        const y = 1 + i * barH;
        return (
          <rect
            key={`${f.value}-${i}`}
            x={width - w - 1}
            y={y}
            width={w}
            height={barH - 1}
            rx={0.5}
            className="fill-current opacity-80"
          />
        );
      })}
    </svg>
  );
}
