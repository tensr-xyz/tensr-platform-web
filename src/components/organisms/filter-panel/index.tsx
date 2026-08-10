import { useState, useCallback, useMemo, memo, useEffect, useRef, useLayoutEffect } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/molecules/accordion';
import { Input } from '@/components/atoms/input';
import { ScrollArea } from '@/components/atoms/scroll-area';
import { Eye, EyeOff } from 'lucide-react';
import { LoaderCircle } from 'lucide-react';
import Loader from '@/components/molecules/loading';
import { BarChart, Bar, XAxis, ReferenceArea, YAxis, Cell } from 'recharts';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTabsStore } from '@/stores/tabs-store';
import useDebounce from '@/hooks/ui/use-debounce';
import { getIdToken } from '@/utils/auth';
import { getTensrApiBaseUrl, tensrApiUrl } from '@/lib/tensr-api-url';
import { cn } from '@/utils';
import {
  buildNumericChartBuckets,
  formatRangeNumber,
  parseFrequencyNumber,
} from '@/utils/column-frequency-chart';
import { AlertCircle } from 'lucide-react';
import {
  ColumnTypeBadge,
  isNumericDataType,
  resolveColumnIsNumeric,
} from '@/components/molecules/column-type-badge';
import type { ColumnSummary } from '@/types/file';
import type { Column } from '@/stores/tabs-store';

/**
 * Measure a host's clientWidth. The host must use overflow-hidden + min-w-0 so a
 * fixed-size Recharts SVG cannot expand it (otherwise RO never sees shrinks).
 */
function useHostWidth(fixedHeight: number) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const measure = () => {
      const next = Math.max(0, Math.floor(host.clientWidth));
      setWidth(prev => (prev === next ? prev : next));
    };

    measure();

    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => measure()) : null;
    observer?.observe(host);

    // Also watch the nearest panel / scrollport — panel drags update those first
    let ancestor: HTMLElement | null = host.parentElement;
    for (let i = 0; i < 6 && ancestor; i++) {
      observer?.observe(ancestor);
      if (
        ancestor.hasAttribute('data-panel') ||
        ancestor.hasAttribute('data-radix-scroll-area-viewport')
      ) {
        break;
      }
      ancestor = ancestor.parentElement;
    }

    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  return { hostRef, width, height: fixedHeight };
}

interface VirtualizedListProps {
  itemCount: number;
  itemSize: number;
  renderRow: (props: { index: number; style: React.CSSProperties }) => React.ReactNode;
}

// Add displayName to VirtualizedList
export const VirtualizedList = ({ itemCount, itemSize, renderRow }: VirtualizedListProps) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: itemCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => itemSize,
  });

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map(virtualRow => (
          <div
            key={virtualRow.index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${itemSize}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {renderRow({
              index: virtualRow.index,
              style: { height: itemSize },
            })}
          </div>
        ))}
      </div>
    </div>
  );
};
VirtualizedList.displayName = 'VirtualizedList';

interface ValueFrequency {
  value: string;
  count: number;
  percentage: number;
}

interface ColumnFrequencyResponse {
  frequencies: ValueFrequency[];
  column_type: string;
  /** Null/NA cells — returned separately by the API, not as value="". */
  missing_count?: number;
  total_count?: number;
}

const DATASET_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Dataset tabs may store a bare UUID or a path segment that contains one. */
function resolveDatasetIdForAnalysis(filePath: string): string | null {
  const trimmed = filePath.trim();
  if (DATASET_ID_RE.test(trimmed)) {
    return trimmed;
  }
  const embedded = trimmed.match(DATASET_ID_RE);
  return embedded ? embedded[0] : null;
}

interface FilterPanelProps {
  filePath?: string;
  columnNames: string[];
  columnStats?: Record<string, ColumnSummary>;
  initialColumns?: Column[];
  columnSampleValues?: Record<string, unknown[]>;
  onFilterChange: (columnName: string, values: Set<string>) => void;
}

interface RangeState {
  start: number;
  end: number;
  isDragging: boolean;
}

const CHART_FILLS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
] as const;

/** Stable accent per column — matches shadcn/tensr-style theme chart tokens in `globals.css`. */
function columnChartFill(columnName: string): string {
  let hash = 0;
  for (let i = 0; i < columnName.length; i++) {
    hash = columnName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CHART_FILLS[Math.abs(hash) % CHART_FILLS.length];
}

/** Categorical list: fixed row height + gap so virtualizer stride matches painted layout */
const LIST_ROW_GAP_PX = 4;
const LIST_ROW_HEIGHT_PX = 28;
const LIST_ROW_STRIDE_PX = LIST_ROW_HEIGHT_PX + LIST_ROW_GAP_PX;

// Create FrequencyItem component with displayName
const FrequencyItem = memo(
  ({
    value,
    count,
    percentage,
    isSelected,
    onToggle,
    accentColor,
    rowIndex,
    isLast,
  }: {
    value: string;
    count: number;
    percentage: number;
    isSelected: boolean;
    onToggle: () => void;
    accentColor: string;
    rowIndex: number;
    isLast: boolean;
  }) => {
    const rowBg = isSelected
      ? `color-mix(in oklch, ${accentColor} 26%, var(--background))`
      : rowIndex % 2 === 0
        ? `color-mix(in oklch, ${accentColor} 18%, var(--background))`
        : `color-mix(in oklch, ${accentColor} 10%, var(--background))`;

    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
        className={cn(
          'flex w-full cursor-pointer items-center justify-between gap-2 px-2 text-[10px] leading-snug transition-[filter] hover:brightness-[0.98]',
          !isLast && 'mb-1'
        )}
        style={{ background: rowBg, height: LIST_ROW_HEIGHT_PX }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          {isSelected ? (
            <Eye className="h-3 w-3 shrink-0 text-foreground" />
          ) : (
            <EyeOff className="h-3 w-3 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate font-medium text-foreground" title={value}>
            {value}
          </span>
        </div>
        <span className="shrink-0 tabular-nums">
          <span className="font-semibold" style={{ color: accentColor }}>
            {count.toLocaleString()}
          </span>{' '}
          <span className="font-normal text-muted-foreground opacity-90">
            ({percentage.toFixed(1)}%)
          </span>
        </span>
      </div>
    );
  }
);
FrequencyItem.displayName = 'FrequencyItem';

interface FrequencyItemProps {
  value: string;
  count: number;
}

interface ChartDataItem {
  value: number;
  count: number;
  originalValues: {
    value: string;
    count: number;
  }[];
  // For rect elements
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

interface Range {
  start: number;
  end: number;
}

interface NumericFrequencyContentProps {
  data: {
    frequencies: FrequencyItemProps[];
  };
  columnName: string;
  range: Range;
  onRangeChange: (columnName: string, start: number, end: number) => void;
  distinctCount: number;
  totalCount: number;
}

interface ChartMouseEvent {
  activeLabel?: string;
}

// Add displayName to ErrorDisplay
const ErrorDisplay = memo(({ message }: { message: string }) => (
  <div className="p-4 text-sm text-red-500 bg-red-50 rounded-md flex items-center space-x-2">
    <AlertCircle className="w-5 h-5 flex-shrink-0" />
    <span>{message}</span>
  </div>
));
ErrorDisplay.displayName = 'ErrorDisplay';

// Add displayName to LoadingContent
const LoadingContent = memo(() => (
  <div className="flex h-40 flex-col items-center justify-center gap-2">
    <Loader size="sm" />
    <p className="text-xs text-muted-foreground">Loading column…</p>
  </div>
));
LoadingContent.displayName = 'LoadingContent';

// Add displayName to EmptyContent
const EmptyContent = memo(() => (
  <div className="flex h-40 flex-col items-center justify-center">
    <p className="text-xs text-muted-foreground">No values in this column</p>
  </div>
));
EmptyContent.displayName = 'EmptyContent';

// Add displayName to NumericFrequencyContent
export const NumericFrequencyContent = memo(
  ({
    data,
    columnName,
    range,
    onRangeChange,
    distinctCount,
    totalCount,
    missingCount = 0,
  }: {
    data: ColumnFrequencyResponse;
    columnName: string;
    range: RangeState;
    onRangeChange: (columnName: string, start: number, end: number) => void;
    distinctCount: number;
    totalCount: number;
    missingCount?: number;
  }) => {
    const [isSelecting, setIsSelecting] = useState(false);
    const [selectionStart, setSelectionStart] = useState<number | null>(null);
    const CHART_HEIGHT = 192;
    const { hostRef, width: chartWidth, height: chartHeight } = useHostWidth(CHART_HEIGHT);

    const numericFrequencies = useMemo(() => {
      if (!data?.frequencies?.length) return [];
      return data.frequencies
        .map(freq => ({
          value: parseFrequencyNumber(freq.value),
          count: freq.count,
          original: freq.value,
        }))
        .filter(freq => Number.isFinite(freq.value));
    }, [data]);

    const dataExtent = useMemo(() => {
      if (!numericFrequencies.length) return null;
      const values = numericFrequencies.map(f => f.value);
      return { min: Math.min(...values), max: Math.max(...values) };
    }, [numericFrequencies]);

    const [minDraft, setMinDraft] = useState(() =>
      formatRangeNumber(Math.min(range.start, range.end))
    );
    const [maxDraft, setMaxDraft] = useState(() =>
      formatRangeNumber(Math.max(range.start, range.end))
    );

    useEffect(() => {
      setMinDraft(formatRangeNumber(Math.min(range.start, range.end)));
      setMaxDraft(formatRangeNumber(Math.max(range.start, range.end)));
    }, [range.start, range.end]);

    const chartData = useMemo(
      () => buildNumericChartBuckets(numericFrequencies, distinctCount),
      [numericFrequencies, distinctCount]
    );

    // Safely calculate domain and formatting
    const { domain, tickFormatter, color } = useMemo(() => {
      if (!chartData || chartData.length === 0 || !dataExtent) {
        return {
          domain: [0, 10] as [number, number],
          tickFormatter: (value: number) => value.toString(),
          color: columnChartFill(columnName),
        };
      }

      const values = chartData.map(d => d.value);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const dataRange = Math.max(max - min, Number.EPSILON);
      const shouldUseKFormat = max > 1000;
      const allInteger = values.every(v => Math.abs(v - Math.round(v)) < 1e-9);
      const fracDigits = allInteger ? 0 : dataExtent.max - dataExtent.min < 2 ? 2 : 1;

      return {
        domain: [min - dataRange * 0.05, max + dataRange * 0.05] as [number, number],
        tickFormatter: shouldUseKFormat
          ? (value: number) => `${(value / 1000).toFixed(1)}K`
          : (value: number) => value.toFixed(fracDigits),
        color: columnChartFill(columnName),
      };
    }, [chartData, dataExtent, columnName]);

    const commitDraftRange = useCallback(() => {
      const min = parseFrequencyNumber(minDraft);
      const max = parseFrequencyNumber(maxDraft);
      if (!Number.isFinite(min) || !Number.isFinite(max)) {
        setMinDraft(formatRangeNumber(Math.min(range.start, range.end)));
        setMaxDraft(formatRangeNumber(Math.max(range.start, range.end)));
        return;
      }
      onRangeChange(columnName, Math.min(min, max), Math.max(min, max));
    }, [minDraft, maxDraft, range.start, range.end, columnName, onRangeChange]);

    const handleMouseDown = useCallback(
      (e: any) => {
        if (e?.activeLabel !== undefined) {
          const value = parseFloat(String(e.activeLabel));
          setIsSelecting(true);
          setSelectionStart(value);
          onRangeChange(columnName, value, value);
        }
      },
      [columnName, onRangeChange]
    );

    const handleMouseMove = useCallback(
      (e: any) => {
        if (isSelecting && e?.activeLabel !== undefined && selectionStart !== null) {
          const value = parseFloat(String(e.activeLabel));
          onRangeChange(columnName, selectionStart, value);
        }
      },
      [isSelecting, selectionStart, columnName, onRangeChange]
    );

    const handleMouseUp = useCallback(() => {
      setIsSelecting(false);
      setSelectionStart(null);
    }, []);

    const isInRange = useCallback(
      (value: number) => {
        const min = Math.min(range.start, range.end);
        const max = Math.max(range.start, range.end);
        return value >= min && value <= max;
      },
      [range]
    );

    /** Full-span ReferenceArea looks like a chart "background" tint; only show when the user narrowed from full extent. */
    const showRangeHighlight = useMemo(() => {
      if (!dataExtent) return false;
      if (!(dataExtent.max > dataExtent.min)) return false;
      const span = dataExtent.max - dataExtent.min;
      const tol = Math.max(span * 1e-4, 1e-6);
      const r0 = Math.min(range.start, range.end);
      const r1 = Math.max(range.start, range.end);
      const coversFullExtent = r0 <= dataExtent.min + tol && r1 >= dataExtent.max - tol;
      return !coversFullExtent;
    }, [dataExtent, range.start, range.end]);

    if (chartData.length === 0) {
      return <EmptyContent />;
    }

    return (
      <div className="w-full min-w-0 max-w-full space-y-2">
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            {numericFrequencies.length.toLocaleString()} distinct
            {missingCount > 0 ? ` · ${missingCount.toLocaleString()} missing` : ''}
          </span>
          <span>{totalCount.toLocaleString()} total</span>
        </div>
        <div
          ref={hostRef}
          className="h-48 w-full min-w-0 max-w-full overflow-hidden text-muted-foreground [&_.recharts-surface]:bg-transparent [&_.recharts-surface]:outline-none [&_svg]:max-w-full [&_svg]:bg-transparent"
        >
          {chartWidth > 0 ? (
            <BarChart
              key={chartWidth}
              width={chartWidth}
              height={chartHeight}
              data={chartData}
              margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
              barCategoryGap={1}
              style={{ backgroundColor: 'transparent', maxWidth: '100%' }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
            >
              <XAxis
                dataKey="value"
                type="number"
                domain={domain}
                tickFormatter={tickFormatter}
                scale="linear"
                tick={{ fontSize: 8, fill: 'var(--muted-foreground)' }}
                axisLine={{ stroke: 'var(--border)', strokeWidth: 1 }}
                tickLine={false}
                height={22}
              />
              <YAxis hide domain={[0, 'dataMax']} />
              <Bar dataKey="count" radius={[2, 2, 0, 0]} maxBarSize={20}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={color}
                    opacity={isInRange(entry.value) ? 1 : 0.35}
                  />
                ))}
              </Bar>
              {showRangeHighlight && (
                <ReferenceArea
                  x1={Math.min(range.start, range.end)}
                  x2={Math.max(range.start, range.end)}
                  fill={color}
                  fillOpacity={0.12}
                  strokeOpacity={0.4}
                />
              )}
            </BarChart>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="shrink-0">Range</span>
          <Input
            type="text"
            inputMode="decimal"
            inputSize="sm"
            value={minDraft}
            onChange={e => setMinDraft(e.target.value)}
            onBlur={commitDraftRange}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.currentTarget.blur();
              }
            }}
            className="h-7 w-[4.5rem] px-2 font-mono tabular-nums"
            aria-label="Range minimum"
          />
          <span className="shrink-0">—</span>
          <Input
            type="text"
            inputMode="decimal"
            inputSize="sm"
            value={maxDraft}
            onChange={e => setMaxDraft(e.target.value)}
            onBlur={commitDraftRange}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.currentTarget.blur();
              }
            }}
            className="h-7 w-[4.5rem] px-2 font-mono tabular-nums"
            aria-label="Range maximum"
          />
        </div>
      </div>
    );
  }
);
NumericFrequencyContent.displayName = 'NumericFrequencyContent';

// Add displayName to TextFrequencyContent
const TextFrequencyContent = memo(
  ({
    data,
    selectedValues,
    valueFilter,
    onValueFilterChange,
    onToggleValue,
    distinctCount,
    totalCount,
    missingCount = 0,
    columnName,
  }: {
    data: ColumnFrequencyResponse;
    selectedValues: Set<string>;
    valueFilter: string;
    onValueFilterChange: (value: string) => void;
    onToggleValue: (value: string) => void;
    distinctCount: number;
    totalCount: number;
    missingCount?: number;
    columnName: string;
  }) => {
    const accentFill = useMemo(() => columnChartFill(columnName), [columnName]);

    // Safely filter the frequencies with validation
    const filteredFrequencies = useMemo(() => {
      // Validate data structure first
      if (!data || !Array.isArray(data.frequencies)) {
        return [];
      }

      // Filter values by search term
      return data.frequencies.filter(({ value }) =>
        value.toLowerCase().includes((valueFilter || '').toLowerCase())
      );
    }, [data, valueFilter]);

    // Render row function for virtualized list
    const renderRow = useCallback(
      ({ index, style }: { index: number; style: React.CSSProperties }) => {
        // Check bounds to prevent errors
        if (index < 0 || index >= filteredFrequencies.length) {
          return null;
        }

        const item = filteredFrequencies[index];
        return (
          <div className="h-full w-full" style={style}>
            <FrequencyItem
              value={item.value}
              count={item.count}
              percentage={item.percentage}
              isSelected={selectedValues.has(item.value)}
              onToggle={() => onToggleValue(item.value)}
              accentColor={accentFill}
              rowIndex={index}
              isLast={index === filteredFrequencies.length - 1}
            />
          </div>
        );
      },
      [filteredFrequencies, selectedValues, onToggleValue, accentFill]
    );

    // Show user-friendly empty state if no values match filter
    const renderEmptyState = () => (
      <div className="px-4 py-6 text-center text-xs text-muted-foreground">
        {valueFilter ? 'No values match your search filter' : 'No values available'}
      </div>
    );

    return (
      <div className="min-w-0 space-y-4">
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            {distinctCount.toLocaleString()} distinct
            {missingCount > 0 ? ` · ${missingCount.toLocaleString()} missing` : ''}
          </span>
          <span>{totalCount.toLocaleString()} total</span>
        </div>

        <div className="min-w-0">
          <Input
            placeholder="Filter values..."
            value={valueFilter}
            onChange={e => onValueFilterChange(e.target.value)}
            className="h-8"
          />
        </div>

        {filteredFrequencies.length > 0 ? (
          <div className="h-[300px] min-w-0">
            <VirtualizedList
              itemCount={filteredFrequencies.length}
              itemSize={LIST_ROW_STRIDE_PX}
              renderRow={renderRow}
            />
          </div>
        ) : (
          renderEmptyState()
        )}
      </div>
    );
  }
);
TextFrequencyContent.displayName = 'TextFrequencyContent';

// Add displayName to ColumnContent
const ColumnContent = memo(
  ({
    columnName,
    data,
    onFilterChange,
    isLoading,
  }: {
    columnName: string;
    data: ColumnFrequencyResponse | null | undefined;
    onFilterChange: (columnName: string, values: Set<string>) => void;
    isLoading: boolean;
  }) => {
    const [valueFilter, setValueFilter] = useState('');
    const [selectedValues, setSelectedValues] = useState(new Set<string>());
    const [debouncedFilter] = useDebounce(valueFilter, 300); // Assuming useDebounce is imported

    const isNumericColumn = useCallback((columnType: string) => isNumericDataType(columnType), []);

    // Initialize range state safely with null checks
    const [range, setRange] = useState<RangeState>(() => {
      if (
        data &&
        isNumericColumn(data.column_type) &&
        Array.isArray(data.frequencies) &&
        data.frequencies.length > 0
      ) {
        const values = data.frequencies
          .map(f => parseFrequencyNumber(f.value))
          .filter(Number.isFinite);
        if (values.length > 0) {
          return {
            start: Math.min(...values),
            end: Math.max(...values),
            isDragging: false,
          };
        }
      }
      return { start: 0, end: 0, isDragging: false };
    });

    // Update range when data changes
    useEffect(() => {
      if (
        data &&
        isNumericColumn(data.column_type) &&
        Array.isArray(data.frequencies) &&
        data.frequencies.length > 0
      ) {
        const values = data.frequencies
          .map(f => parseFrequencyNumber(f.value))
          .filter(Number.isFinite);
        if (values.length > 0) {
          setRange({
            start: Math.min(...values),
            end: Math.max(...values),
            isDragging: false,
          });
        }
      }
    }, [data, isNumericColumn]);

    // Memoize these calculations with null checks
    const { distinctCount, totalCount, missingCount } = useMemo(() => {
      if (!data || !Array.isArray(data.frequencies)) {
        return { distinctCount: 0, totalCount: 0, missingCount: 0 };
      }
      const freqTotal = data.frequencies.reduce((sum, freq) => sum + freq.count, 0);
      const missing = data.missing_count ?? 0;
      return {
        distinctCount: data.frequencies.length,
        totalCount: data.total_count ?? freqTotal + missing,
        missingCount: missing,
      };
    }, [data]);

    const handleToggleValue = useCallback(
      (value: string) => {
        setSelectedValues(prev => {
          const next = new Set(prev);
          if (next.has(value)) {
            next.delete(value);
          } else {
            next.add(value);
          }
          onFilterChange(columnName, next);
          return next;
        });
      },
      [columnName, onFilterChange]
    );

    const handleRangeChange = useCallback(
      (columnName: string, start: number, end: number) => {
        setRange(prev => ({
          ...prev,
          start,
          end,
          isDragging: true,
        }));

        // Create filtered values set based on range
        if (data && Array.isArray(data.frequencies)) {
          const lo = Math.min(start, end);
          const hi = Math.max(start, end);
          const valuesInRange = new Set(
            data.frequencies
              .map(freq => ({ value: parseFrequencyNumber(freq.value), original: freq.value }))
              .filter(({ value }) => Number.isFinite(value) && value >= lo && value <= hi)
              .map(({ original }) => original)
          );
          onFilterChange(columnName, valuesInRange);
        }
      },
      [columnName, data, onFilterChange]
    );

    // Pending or in-flight: show loader (avoid flashing empty/"Not found" before fetch settles)
    if (isLoading || data === undefined) {
      return <LoadingContent />;
    }

    // Loaded successfully but no observed values
    if (!data || !Array.isArray(data.frequencies)) {
      return <EmptyContent />;
    }

    if (data.frequencies.length === 0) {
      if ((data.missing_count ?? 0) > 0) {
        return (
          <div className="flex h-40 flex-col items-center justify-center gap-1 px-3 text-center">
            <p className="text-xs text-muted-foreground">No observed values in this column</p>
            <p className="text-[11px] text-muted-foreground/80">
              {(data.missing_count ?? 0).toLocaleString()} missing
            </p>
          </div>
        );
      }
      return <EmptyContent />;
    }

    // Render based on column type
    if (isNumericColumn(data.column_type)) {
      return (
        <NumericFrequencyContent
          data={data}
          columnName={columnName}
          range={range}
          onRangeChange={handleRangeChange}
          distinctCount={distinctCount}
          totalCount={totalCount}
          missingCount={missingCount}
        />
      );
    }

    // Default to text content
    return (
      <TextFrequencyContent
        data={data}
        selectedValues={selectedValues}
        valueFilter={debouncedFilter}
        onValueFilterChange={setValueFilter}
        onToggleValue={handleToggleValue}
        distinctCount={distinctCount}
        totalCount={totalCount}
        missingCount={missingCount}
        columnName={columnName}
      />
    );
  }
);
ColumnContent.displayName = 'ColumnContent';

// Add displayName to AccordionHeader
const AccordionHeader = memo(
  ({
    columnName,
    isVisible,
    isNumeric,
    isLoading,
    onToggleVisibility,
  }: {
    columnName: string;
    isVisible: boolean;
    isNumeric: boolean;
    isLoading: boolean;
    onToggleVisibility: () => void;
  }) => {
    const stop = (e: React.SyntheticEvent) => e.stopPropagation();

    return (
      <div className="flex h-[30px] w-full min-w-0 items-center gap-2 rounded-lg px-2.5 text-xs font-medium transition-colors hover:bg-muted/80">
        <ColumnTypeBadge isNumeric={isNumeric} />
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-left',
            isVisible ? 'text-foreground' : 'text-muted-foreground/60'
          )}
        >
          {columnName}
        </span>
        {isLoading ? (
          <LoaderCircle className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
        ) : null}
        <span
          role="button"
          tabIndex={0}
          className="grid size-5 shrink-0 place-items-center rounded-sm text-muted-foreground hover:bg-muted"
          onClick={e => {
            stop(e);
            onToggleVisibility();
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              stop(e);
              onToggleVisibility();
            }
          }}
          aria-label={isVisible ? `Hide ${columnName}` : `Show ${columnName}`}
        >
          {isVisible ? <Eye className="size-[11px]" /> : <EyeOff className="size-[11px]" />}
        </span>
      </div>
    );
  }
);
AccordionHeader.displayName = 'AccordionHeader';

// Updated FilterPanel component to use fetch instead of invoke
const FilterPanel = ({
  filePath,
  columnNames,
  columnStats,
  initialColumns,
  columnSampleValues,
  onFilterChange,
}: FilterPanelProps) => {
  const { tabs, activeTabId, updateTab } = useTabsStore();
  // Removed tokens - using getIdToken() directly
  const activeTab = tabs.find(tab => tab.id === activeTabId);
  const columnVisibility = activeTab?.columnVisibility || {};

  const [columnData, setColumnData] = useState<Record<string, ColumnFrequencyResponse | null>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [expandedColumns, setExpandedColumns] = useState<string[]>([]);
  const columnDataRef = useRef(columnData);
  const inFlightRef = useRef<Record<string, boolean>>({});
  columnDataRef.current = columnData;

  // Improved data loading function with better error handling
  const loadColumnFrequencies = useCallback(
    async (columnName: string) => {
      if (!filePath) return;
      // Already have successful data
      if (columnDataRef.current[columnName]) return;
      if (inFlightRef.current[columnName]) return;

      inFlightRef.current[columnName] = true;
      setLoading(prev => ({ ...prev, [columnName]: true }));
      setErrors(prev => ({ ...prev, [columnName]: null }));

      const base = getTensrApiBaseUrl();
      const datasetId = resolveDatasetIdForAnalysis(filePath);
      const url = datasetId
        ? tensrApiUrl(`/datasets/${datasetId}/explore/column_frequencies`)
        : `${base}/api/analysis/column-frequencies`;
      const body = datasetId
        ? { column: columnName }
        : {
            request: { path: filePath },
            column_name: columnName,
          };

      const maxAttempts = 4;
      const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      try {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${getIdToken()}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
          });

          if (response.ok) {
            const data = await response.json();
            if (!data || !Array.isArray(data.frequencies)) {
              throw new Error(`Invalid data format received for column: ${columnName}`);
            }
            setColumnData(prev => ({
              ...prev,
              [columnName]: data,
            }));
            setErrors(prev => ({ ...prev, [columnName]: null }));
            return;
          }

          // Explore can 404 briefly while the dataset service warms up — keep spinner + retry
          const retryable =
            response.status === 404 ||
            response.status === 409 ||
            response.status === 425 ||
            response.status >= 500;
          if (retryable && attempt < maxAttempts - 1) {
            await sleep(400 * (attempt + 1));
            continue;
          }

          let message = `Failed to load data for column: ${columnName} (${response.status})`;
          try {
            const errBody = (await response.json()) as { detail?: unknown; error?: string };
            if (typeof errBody.detail === 'string') {
              message = errBody.detail;
            } else if (Array.isArray(errBody.detail) && errBody.detail[0]?.msg) {
              message = String(errBody.detail[0].msg);
            } else if (errBody.error) {
              message = errBody.error;
            }
          } catch {
            /* non-JSON error body */
          }

          if (/not found/i.test(message) || response.status === 404) {
            message = 'Column data is still preparing. Try again in a moment.';
          }
          throw new Error(message);
        }
      } catch (err) {
        console.error(`Error loading column frequencies for ${columnName}:`, err);
        setErrors(prev => ({
          ...prev,
          [columnName]: err instanceof Error ? err.message : 'Failed to load frequencies',
        }));
        setColumnData(prev => ({
          ...prev,
          [columnName]: null,
        }));
      } finally {
        inFlightRef.current[columnName] = false;
        setLoading(prev => ({ ...prev, [columnName]: false }));
      }
    },
    [filePath]
  );

  // Track which columns are expanded
  const handleAccordionChange = (value: string[]) => {
    setExpandedColumns(value);

    // Load data for newly expanded columns
    value.forEach(columnName => {
      if (!columnDataRef.current[columnName] && !inFlightRef.current[columnName]) {
        void loadColumnFrequencies(columnName);
      }
    });
  };

  const handleToggleVisibility = useCallback(
    (columnId: string) => {
      if (!activeTab) return;

      const newVisibility = {
        ...columnVisibility,
        [columnId]: !columnVisibility[columnId],
      };

      updateTab(activeTab.id, {
        columnVisibility: newVisibility,
      });
    },
    [activeTab, columnVisibility, updateTab]
  );

  // Retry loading on error
  const handleRetry = useCallback(
    (columnName: string) => {
      setErrors(prev => ({ ...prev, [columnName]: null }));
      setColumnData(prev => {
        const next = { ...prev };
        delete next[columnName];
        return next;
      });
      void loadColumnFrequencies(columnName);
    },
    [loadColumnFrequencies]
  );

  return (
    <div className="flex min-w-0 flex-col px-1.5 pb-1">
      <Accordion
        type="multiple"
        className="w-full min-w-0"
        value={expandedColumns}
        onValueChange={handleAccordionChange}
      >
        {columnNames.map(columnName => {
          const loadedType = columnData[columnName]?.column_type;
          const col = initialColumns?.find(c => c.id === columnName);
          const isNumeric = resolveColumnIsNumeric(
            columnName,
            columnStats,
            col?.type,
            loadedType,
            columnSampleValues?.[columnName]
          );

          return (
            <AccordionItem key={columnName} value={columnName} className="min-w-0 border-none">
              <AccordionTrigger className="h-[30px] w-full min-w-0 flex-none p-0 hover:no-underline [&>svg]:hidden">
                <AccordionHeader
                  columnName={columnName}
                  isNumeric={isNumeric}
                  isVisible={columnVisibility[columnName] !== false}
                  onToggleVisibility={() => handleToggleVisibility(columnName)}
                  isLoading={loading[columnName]}
                />
              </AccordionTrigger>
              <AccordionContent className="min-w-0 cursor-default bg-transparent hover:bg-transparent">
                {errors[columnName] && !loading[columnName] ? (
                  <div className="p-2">
                    <ErrorDisplay message={errors[columnName] || 'An error occurred'} />
                    <button
                      onClick={() => handleRetry(columnName)}
                      className="mt-2 text-xs text-primary hover:underline"
                    >
                      Retry
                    </button>
                  </div>
                ) : (
                  <ColumnContent
                    columnName={columnName}
                    data={columnData[columnName]}
                    onFilterChange={onFilterChange}
                    isLoading={!!loading[columnName] || columnData[columnName] === undefined}
                  />
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
};
FilterPanel.displayName = 'FilterPanel';

export default FilterPanel;
