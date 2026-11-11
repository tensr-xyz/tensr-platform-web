'use client';

import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils';

export const SIDE_PANEL_MIN = 220;
export const SIDE_PANEL_MAX = 720;

export function clampPanelWidth(width: number): number {
  if (!Number.isFinite(width)) return SIDE_PANEL_MIN;
  return Math.min(SIDE_PANEL_MAX, Math.max(SIDE_PANEL_MIN, Math.round(width)));
}

export function panelWidthKey(id: string): string {
  return `tensr-panel-width:${id}`;
}

export function readPanelWidth(id: string, fallback: number): number {
  if (typeof window === 'undefined') return clampPanelWidth(fallback);
  try {
    const stored = window.localStorage.getItem(panelWidthKey(id));
    if (stored == null) return clampPanelWidth(fallback);
    const parsed = Number(stored);
    return clampPanelWidth(Number.isFinite(parsed) ? parsed : fallback);
  } catch {
    return clampPanelWidth(fallback);
  }
}

/** Right-hand panel: drag the left edge, remember the width, expand over the page. */
export function SidePanel({
  id,
  defaultWidth,
  className,
  hidden,
  children,
}: {
  id: string;
  defaultWidth: number;
  className?: string;
  hidden?: boolean;
  children: ReactNode;
}) {
  const [width, setWidth] = useState(() => clampPanelWidth(defaultWidth));
  const [expanded, setExpanded] = useState(false);
  const widthRef = useRef(width);
  widthRef.current = width;

  useEffect(() => {
    setWidth(readPanelWidth(id, defaultWidth));
  }, [id, defaultWidth]);

  const remember = (next: number) => {
    const clamped = clampPanelWidth(next);
    widthRef.current = clamped;
    setWidth(clamped);
    try {
      window.localStorage.setItem(panelWidthKey(id), String(clamped));
    } catch {
      // The width still applies for this visit.
    }
  };

  const drag = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (expanded) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = widthRef.current;
    const move = (ev: MouseEvent) => {
      remember(startWidth + (startX - ev.clientX));
    };
    const stop = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', stop);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', stop);
  };

  return (
    <aside
      className={cn('side-panel', className)}
      hidden={hidden}
      data-expanded={expanded ? 'true' : undefined}
      data-panel={id}
      style={expanded ? undefined : { width, minWidth: width }}
    >
      <Button
        type="button"
        className="side-panel-handle"
        aria-label="Resize panel"
        onMouseDown={drag}
      />
      <div className="side-panel-tools">
        <Button
          type="button"
          className="side-panel-expand"
          aria-label={expanded ? 'Restore panel' : 'Expand panel'}
          onClick={() => setExpanded(current => !current)}
        >
          {expanded ? (
            <Minimize2 className="size-3.5" aria-hidden />
          ) : (
            <Maximize2 className="size-3.5" aria-hidden />
          )}
        </Button>
      </div>
      {children}
    </aside>
  );
}
