'use client';

import React, { useMemo, useState } from 'react';
import { ScrollArea } from '@/components/atoms/scroll-area';
import { Button } from '@/components/atoms/button';
import { ColumnTypeBadge, resolveColumnIsNumeric } from '@/components/molecules/column-type-badge';
import type { ColumnSummary } from '@/types/file';
import type { Column } from '@/stores/tabs-store';
import { useChartState } from '@/contexts/chart-context';
import { ChartType } from '@/contexts/chart-context/types';
import {
  setChartType,
  setColorAxis,
  setSizeAxis,
  setXAxis,
  setYAxis,
} from '@/contexts/chart-context/actions';
import {
  TrendingUp as ChartLine,
  BarChart3 as ChartBar,
  ScatterChart as ChartScatter,
  AreaChart as ChartArea,
} from 'lucide-react';
import { cn } from '@/utils';

type AxisSlot = 'x' | 'y' | 'color' | 'size';

const AXIS_SLOTS: { id: AxisSlot; label: string; numericOnly?: boolean }[] = [
  { id: 'x', label: 'X axis' },
  { id: 'y', label: 'Y axis', numericOnly: true },
  { id: 'color', label: 'Colour' },
  { id: 'size', label: 'Size', numericOnly: true },
];

const CHART_TYPES = [
  { id: ChartType.BAR, icon: ChartBar, label: 'Bar' },
  { id: ChartType.LINE, icon: ChartLine, label: 'Line' },
  { id: ChartType.SCATTER, icon: ChartScatter, label: 'Scatter' },
  { id: ChartType.AREA, icon: ChartArea, label: 'Area' },
];

type Props = {
  columnList: string[];
  initialColumns: Column[];
  columnStats: Record<string, ColumnSummary>;
  columnSampleValues: Record<string, unknown[]>;
};

export function ChartConfigurationPanel({
  columnList,
  initialColumns,
  columnStats,
  columnSampleValues,
}: Props) {
  const { state, dispatch } = useChartState();
  const [activeSlot, setActiveSlot] = useState<AxisSlot>('x');

  const columnMeta = useMemo(() => {
    return columnList.map(id => {
      const col = initialColumns.find(c => c.id === id);
      const isNumeric = resolveColumnIsNumeric(
        id,
        columnStats,
        col?.type,
        undefined,
        columnSampleValues[id]
      );
      return { id, header: col?.header ?? id, isNumeric };
    });
  }, [columnList, initialColumns, columnStats, columnSampleValues]);

  const slotValue = (slot: AxisSlot): string | null => {
    switch (slot) {
      case 'x':
        return state.xAxis;
      case 'y':
        return state.yAxis;
      case 'color':
        return state.colorAxis;
      case 'size':
        return state.sizeAxis;
    }
  };

  const assignColumn = (columnId: string) => {
    switch (activeSlot) {
      case 'x':
        dispatch(setXAxis(columnId));
        break;
      case 'y':
        dispatch(setYAxis(columnId));
        break;
      case 'color':
        dispatch(setColorAxis(columnId));
        break;
      case 'size':
        dispatch(setSizeAxis(columnId));
        break;
    }
  };

  const clearSlot = (slot: AxisSlot) => {
    switch (slot) {
      case 'x':
        dispatch(setXAxis(null));
        break;
      case 'y':
        dispatch(setYAxis(null));
        break;
      case 'color':
        dispatch(setColorAxis(null));
        break;
      case 'size':
        dispatch(setSizeAxis(null));
        break;
    }
  };

  const activeSlotDef = AXIS_SLOTS.find(s => s.id === activeSlot)!;

  return (
    <div className="flex flex-col">
      <div className="shrink-0 space-y-3 border-b border-border px-2.5 pb-3 pt-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Chart type
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {CHART_TYPES.map(({ id, icon: Icon, label }) => (
            <Button
              key={id}
              type="button"
              variant={state.type === id ? 'secondary' : 'outline'}
              size="sm"
              className="h-8 justify-start gap-1.5 px-2 text-xs"
              onClick={() => dispatch(setChartType(id))}
            >
              <Icon className="size-3.5 shrink-0 opacity-80" aria-hidden />
              {label}
            </Button>
          ))}
        </div>
      </div>

      <div className="shrink-0 space-y-2 border-b border-border px-2.5 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Axes
        </p>
        <div className="flex flex-col gap-1">
          {AXIS_SLOTS.map(slot => {
            const value = slotValue(slot.id);
            const isActive = activeSlot === slot.id;
            return (
              <button
                key={slot.id}
                type="button"
                onClick={() => setActiveSlot(slot.id)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition-colors',
                  isActive
                    ? 'border-primary/40 bg-primary/5 text-foreground'
                    : 'border-border bg-card/50 text-muted-foreground hover:border-border hover:bg-muted/40'
                )}
              >
                <span className="w-14 shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {slot.label}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                  {value || '—'}
                </span>
                {value ? (
                  <span
                    role="button"
                    tabIndex={0}
                    className="shrink-0 text-[10px] text-muted-foreground hover:text-foreground"
                    onClick={e => {
                      e.stopPropagation();
                      clearSlot(slot.id);
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.stopPropagation();
                        clearSlot(slot.id);
                      }
                    }}
                  >
                    Clear
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <p className="text-[10px] leading-relaxed text-muted-foreground">
          Select an axis above, then choose a variable below.
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 px-2.5 pb-2 pt-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Variables
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Assign to {activeSlotDef.label.toLowerCase()}
          </p>
        </div>
        <ScrollArea className="min-h-0 flex-1 px-1">
          <ul className="flex flex-col gap-0.5 pb-3">
            {columnMeta.map(col => {
              if (activeSlotDef.numericOnly && !col.isNumeric) return null;
              const assigned = slotValue(activeSlot) === col.id;
              return (
                <li key={col.id}>
                  <button
                    type="button"
                    onClick={() => assignColumn(col.id)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors',
                      assigned
                        ? 'bg-primary/10 text-foreground ring-1 ring-primary/25'
                        : 'text-foreground hover:bg-muted/50'
                    )}
                  >
                    <ColumnTypeBadge isNumeric={col.isNumeric} variant="hint" />
                    <span className="min-w-0 flex-1 truncate">{col.header}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      </div>

      {state.type === ChartType.SCATTER ? (
        <div className="shrink-0 border-t border-border px-2.5 py-2 text-[10px] text-muted-foreground">
          Scatter plots use X and Y; colour and size encode extra dimensions when set.
        </div>
      ) : null}
    </div>
  );
}
