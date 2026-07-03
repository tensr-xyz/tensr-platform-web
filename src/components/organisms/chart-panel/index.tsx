'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/molecules/accordion';
import { Button } from '@/components/atoms/button';
import { Badge } from '@/components/atoms/badge';
import { ScrollArea } from '@/components/atoms/scroll-area';
import { Plus, X, Lightbulb, TrendingUp, BarChart3, Sparkles } from 'lucide-react';
import { useChartState } from '@/contexts/chart-context';
import { ChartType } from '@/contexts/chart-context/types';
import {
  addSeries,
  removeSeries,
  setChartType,
  setSuggestion,
  setXAxis,
  setYAxis,
} from '@/contexts/chart-context/actions';
import { cn } from '@/utils';

interface Column {
  id: string;
  type: string;
}

interface ChartPanelProps {
  columns?: Column[];
  /** Left panel: full config. Right panel: suggestions + series only. */
  mode?: 'full' | 'options';
}

const SUGGESTIONS = [
  {
    id: 'time-series',
    title: 'Time series',
    description: 'Plot a numeric measure over a date or sequence column.',
    icon: TrendingUp,
    recommended: true,
    apply: (cols: Column[]) => {
      const dateCol = cols.find(c => /date|time|year|month|day|period/i.test(c.id));
      const numCol = cols.find(c =>
        ['number', 'integer', 'float'].includes(c.type?.toLowerCase() ?? '')
      );
      return {
        type: ChartType.LINE,
        x: dateCol?.id ?? cols[0]?.id,
        y: numCol?.id ?? cols.find(c => c.id !== dateCol?.id)?.id,
      };
    },
  },
  {
    id: 'distribution',
    title: 'Distribution',
    description: 'Compare frequency or counts across categories.',
    icon: BarChart3,
    recommended: false,
    apply: (cols: Column[]) => {
      const cat = cols.find(
        c => !['number', 'integer', 'float'].includes(c.type?.toLowerCase() ?? '')
      );
      const num = cols.find(c =>
        ['number', 'integer', 'float'].includes(c.type?.toLowerCase() ?? '')
      );
      return {
        type: ChartType.BAR,
        x: cat?.id ?? cols[0]?.id,
        y: num?.id ?? cat?.id,
      };
    },
  },
] as const;

const ChartPanel = ({ columns = [], mode = 'full' }: ChartPanelProps) => {
  const { state, dispatch } = useChartState();
  const isOptionsOnly = mode === 'options';

  const applySuggestion = (suggestionId: string) => {
    const suggestion = SUGGESTIONS.find(s => s.id === suggestionId);
    if (!suggestion) return;
    const applied = suggestion.apply(columns);
    dispatch(setSuggestion(suggestionId));
    if (applied.type) dispatch(setChartType(applied.type));
    if (applied.x) dispatch(setXAxis(applied.x ?? null));
    if (applied.y) dispatch(setYAxis(applied.y ?? null));
  };

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1">
        <Accordion
          type="single"
          collapsible
          defaultValue="chart-suggestions"
          className="w-full px-2"
        >
          <AccordionItem value="chart-suggestions" className="border-border/80">
            <AccordionTrigger className="py-2.5 text-xs font-medium hover:no-underline">
              <span className="flex items-center gap-1.5">
                <Sparkles className="size-3 text-primary opacity-80" aria-hidden />
                Suggestions
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-3">
              <div className="flex flex-col gap-2">
                {SUGGESTIONS.map(suggestion => {
                  const Icon = suggestion.icon;
                  const isActive = state.activeSuggestion === suggestion.id;
                  return (
                    <button
                      key={suggestion.id}
                      type="button"
                      onClick={() => applySuggestion(suggestion.id)}
                      className={cn(
                        'w-full rounded-lg border p-3 text-left transition-colors',
                        isActive
                          ? 'border-primary/35 bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary)/0.12)]'
                          : 'border-border bg-card hover:border-primary/25 hover:bg-muted/30'
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        <span
                          className={cn(
                            'mt-0.5 grid size-7 shrink-0 place-items-center rounded-md border',
                            isActive
                              ? 'border-primary/30 bg-primary/10 text-primary'
                              : 'border-border bg-muted/40 text-muted-foreground'
                          )}
                        >
                          <Icon className="size-3.5" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs font-medium text-foreground">
                              {suggestion.title}
                            </span>
                            {suggestion.recommended ? (
                              <Badge
                                variant="secondary"
                                className="h-4 px-1.5 text-[9px] font-semibold uppercase tracking-wide"
                              >
                                Suggested
                              </Badge>
                            ) : null}
                          </div>
                          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                            {suggestion.description}
                          </p>
                        </div>
                        <Lightbulb
                          className={cn(
                            'size-3.5 shrink-0',
                            isActive ? 'text-primary' : 'text-muted-foreground/50'
                          )}
                          aria-hidden
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </AccordionContent>
          </AccordionItem>

          {!isOptionsOnly ? (
            <>
              <AccordionItem value="chart-type" className="border-border/80">
                <AccordionTrigger className="py-2.5 text-xs font-medium hover:no-underline">
                  Chart type
                </AccordionTrigger>
                <AccordionContent className="pb-3">
                  <p className="text-[11px] text-muted-foreground">
                    Use the left panel to choose chart type and assign variables.
                  </p>
                </AccordionContent>
              </AccordionItem>
            </>
          ) : null}

          <AccordionItem value="chart-series" className="border-border/80">
            <AccordionTrigger className="py-2.5 text-xs font-medium hover:no-underline">
              Series
            </AccordionTrigger>
            <AccordionContent className="pb-3">
              <div className="space-y-2">
                {state.series.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">
                    Add series to compare multiple measures on the same chart.
                  </p>
                ) : null}
                {state.series.map(series => (
                  <div
                    key={series.id}
                    className="flex items-center justify-between rounded-md border border-border bg-card/50 px-2 py-1.5 text-xs"
                  >
                    <span className="truncate">{series.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 shrink-0"
                      onClick={() => dispatch(removeSeries(series.id))}
                    >
                      <X className="size-3" aria-hidden />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-full justify-center gap-1.5 text-xs"
                  onClick={() =>
                    dispatch(
                      addSeries({
                        id: crypto.randomUUID(),
                        name: 'New series',
                        dataKey: state.yAxis ?? '',
                        color: 'hsl(var(--primary))',
                      })
                    )
                  }
                >
                  <Plus className="size-3" aria-hidden />
                  Add series
                </Button>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </ScrollArea>
    </div>
  );
};

export default ChartPanel;
