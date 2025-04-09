import { useState, useCallback, useMemo, memo } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/molecules/accordion';
import { Input } from '@/components/atoms/input';
import { ScrollArea } from '@/components/atoms/scroll-area';
import { LuEye, LuEyeOff, LuLoader } from 'react-icons/lu';
import { BarChart, Bar, XAxis, ResponsiveContainer, ReferenceArea, YAxis } from 'recharts';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';
import { useTabs } from '@/contexts/tabs-context';
import { updateTab } from '@/contexts/tabs-context/actions';
import _ from 'lodash';
import useDebounce from '@/hooks/ui/use-debounce';

interface VirtualizedListProps {
  itemCount: number;
  itemSize: number;
  renderRow: (props: { index: number; style: React.CSSProperties }) => React.ReactNode;
}

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

interface ValueFrequency {
  value: string;
  count: number;
  percentage: number;
}

interface ColumnFrequencyResponse {
  frequencies: ValueFrequency[];
  column_type: string;
}

interface FilterPanelProps {
  filePath?: string;
  columnNames: string[];
  onFilterChange: (columnName: string, values: Set<string>) => void;
}

interface RangeState {
  start: number;
  end: number;
  isDragging: boolean;
}

const generateColor = (input: string) => {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = input.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Generate HSL with good saturation and lightness for visibility
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 70%, 50%)`;
};

const FrequencyItem = memo(
  ({
    value,
    count,
    percentage,
    isSelected,
    onToggle,
    backgroundColor,
  }: {
    value: string;
    count: number;
    percentage: number;
    isSelected: boolean;
    onToggle: () => void;
    backgroundColor: string;
  }) => {
    const getBackgroundWithOpacity = (color: string) => {
      // If color is HSL format
      if (color.startsWith('hsl')) {
        return color.replace('hsl', 'hsla').replace(')', ', 0.1)');
      }
      return color + '1A'; // Hex opacity
    };

    return (
      <div
        onClick={onToggle}
        className="flex items-center justify-between py-1 px-2 hover:opacity-90 cursor-pointer"
        style={{
          backgroundColor: getBackgroundWithOpacity(backgroundColor),
          color: backgroundColor,
        }}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {isSelected ? (
            <LuEye className="w-4 h-4 flex-shrink-0" />
          ) : (
            <LuEyeOff className="w-4 h-4 flex-shrink-0" />
          )}
          <span className="truncate" style={{ color: backgroundColor }}>
            {value}
          </span>
        </div>
        <span className="ml-2 flex-shrink-0" style={{ color: backgroundColor }}>
          {count.toLocaleString()} ({percentage.toFixed(1)}%)
        </span>
      </div>
    );
  }
);

interface FrequencyItem {
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
    frequencies: FrequencyItem[];
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

export const NumericFrequencyContent: React.FC<NumericFrequencyContentProps> = ({
  data,
  columnName,
  range,
  onRangeChange,
  distinctCount,
  totalCount,
}) => {
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<number | null>(null);

  const chartData: ChartDataItem[] = useMemo(() => {
    const values = data.frequencies.map(f => parseFloat(f.value));
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const dataRange = maxValue - minValue;

    let bucketSize: number;
    if (distinctCount <= 30) {
      bucketSize = 1;
    } else {
      const numberOfBins = Math.ceil(2 * Math.pow(distinctCount, 1 / 3));
      bucketSize = dataRange / numberOfBins;
      const magnitude = Math.pow(10, Math.floor(Math.log10(bucketSize)));
      const normalizedSize = bucketSize / magnitude;
      const niceSize = [1, 2, 5, 10].find(n => n >= normalizedSize) || 10;
      bucketSize = niceSize * magnitude;
    }

    const buckets = _.groupBy(data.frequencies, freq => {
      const value = parseFloat(freq.value);
      return Math.floor(value / bucketSize) * bucketSize;
    });

    return Object.entries(buckets)
      .map(([bucketValue, items]) => ({
        value: parseFloat(bucketValue),
        count: items.reduce((sum, item) => sum + item.count, 0),
        originalValues: items.map(item => ({
          value: item.value,
          count: item.count,
        })),
      }))
      .sort((a, b) => a.value - b.value);
  }, [data.frequencies, distinctCount]);

  const { domain, tickFormatter, color } = useMemo(() => {
    const values = chartData.map(d => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const dataRange = max - min;
    const shouldUseKFormat = max > 1000;

    return {
      domain: [min - dataRange * 0.05, max + dataRange * 0.05] as [number, number],
      tickFormatter: shouldUseKFormat
        ? (value: number) => `${(value / 1000).toFixed(1)}K`
        : (value: number) => value.toFixed(distinctCount <= 30 ? 0 : 1),
      color: generateColor(columnName),
    };
  }, [chartData, distinctCount, columnName]);

  const handleMouseDown = useCallback(
    (e: ChartMouseEvent) => {
      if (e?.activeLabel) {
        const value = parseFloat(e.activeLabel);
        setIsSelecting(true);
        setSelectionStart(value);
        onRangeChange(columnName, value, value);
      }
    },
    [columnName, onRangeChange]
  );

  const handleMouseMove = useCallback(
    (e: ChartMouseEvent) => {
      if (isSelecting && e?.activeLabel && selectionStart !== null) {
        const value = parseFloat(e.activeLabel);
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

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{distinctCount.toLocaleString()} distinct values</span>
        <span>{totalCount.toLocaleString()} total</span>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            barCategoryGap={1}
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
            />
            <YAxis hide />
            <Bar
              dataKey="count"
              fill={color}
              opacity={0.7}
              maxBarSize={distinctCount <= 30 ? 20 : 40}
            >
              {chartData.map((entry, index) => (
                <rect
                  key={`bar-${index}`}
                  fill={color}
                  opacity={isInRange(entry.value) ? 1 : 0.3}
                  x={entry.x}
                  y={entry.y}
                  width={entry.width}
                  height={entry.height}
                />
              ))}
            </Bar>
            {range.start !== range.end && (
              <ReferenceArea
                x1={Math.min(range.start, range.end)}
                x2={Math.max(range.start, range.end)}
                fill={color}
                fillOpacity={0.1}
                strokeOpacity={0.5}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="text-xs text-muted-foreground">
        Range: {Math.min(range.start, range.end).toFixed(1)} -{' '}
        {Math.max(range.start, range.end).toFixed(1)}
      </div>
    </div>
  );
};

const TextFrequencyContent = memo(
  ({
    data,
    selectedValues,
    valueFilter,
    onValueFilterChange,
    onToggleValue,
    distinctCount,
    totalCount,
    columnName,
  }: {
    data: ColumnFrequencyResponse;
    selectedValues: Set<string>;
    valueFilter: string;
    onValueFilterChange: (value: string) => void;
    onToggleValue: (value: string) => void;
    distinctCount: number;
    totalCount: number;
    columnName: string;
  }) => {
    // Generate one color for the entire column
    const backgroundColor = useMemo(() => generateColor(columnName), [columnName]);

    const filteredFrequencies = useMemo(
      () =>
        data.frequencies.filter(({ value }) =>
          value.toLowerCase().includes((valueFilter || '').toLowerCase())
        ),
      [data.frequencies, valueFilter]
    );

    const renderRow = useCallback(
      ({ index, style }: { index: number; style: React.CSSProperties }) => {
        const item = filteredFrequencies[index];
        return (
          <div style={style}>
            <FrequencyItem
              value={item.value}
              count={item.count}
              percentage={item.percentage}
              isSelected={selectedValues.has(item.value)}
              onToggle={() => onToggleValue(item.value)}
              backgroundColor={backgroundColor}
            />
          </div>
        );
      },
      [filteredFrequencies, selectedValues, onToggleValue, backgroundColor]
    );

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <span>{distinctCount.toLocaleString()} distinct values</span>
          </div>
          <span>{totalCount.toLocaleString()} total</span>
        </div>

        <div>
          <Input
            placeholder="Filter values..."
            value={valueFilter}
            onChange={e => onValueFilterChange(e.target.value)}
            className="h-8"
          />
        </div>

        <div className="h-[300px]">
          <VirtualizedList
            itemCount={filteredFrequencies.length}
            itemSize={28}
            renderRow={renderRow}
          />
        </div>

        {filteredFrequencies.length === 0 && (
          <div className="px-4 py-2 text-sm text-muted-foreground text-center">
            No matching values found
          </div>
        )}
      </div>
    );
  }
);

const ColumnContent = memo(
  ({
    columnName,
    data,
    onFilterChange,
  }: {
    columnName: string;
    data: ColumnFrequencyResponse;
    onFilterChange: (columnName: string, values: Set<string>) => void;
  }) => {
    const [valueFilter, setValueFilter] = useState('');
    const [selectedValues, setSelectedValues] = useState(new Set<string>());
    const [debouncedFilter] = useDebounce(valueFilter, 300);

    const isNumericColumn = useCallback((columnType: string) => {
      const type = columnType.toLowerCase();
      return (
        type.startsWith('i') ||
        type.startsWith('f') ||
        type.includes('int') ||
        type.includes('float')
      );
    }, []);

    const [range, setRange] = useState<RangeState>(() => {
      if (isNumericColumn(data.column_type)) {
        const values = data.frequencies.map(f => parseFloat(f.value));
        return {
          start: Math.min(...values),
          end: Math.max(...values),
          isDragging: false,
        };
      }
      return { start: 0, end: 0, isDragging: false };
    });

    // Memoize these calculations
    const { distinctCount, totalCount } = useMemo(
      () => ({
        distinctCount: data.frequencies.length,
        totalCount: data.frequencies.reduce((sum, freq) => sum + freq.count, 0),
      }),
      [data.frequencies]
    );

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
        const valuesInRange = new Set(
          data.frequencies
            .map(freq => ({ value: parseFloat(freq.value), original: freq.value }))
            .filter(({ value }) => value >= Math.min(start, end) && value <= Math.max(start, end))
            .map(({ original }) => original)
        );
        onFilterChange(columnName, valuesInRange);
      },
      [columnName, data.frequencies, onFilterChange]
    );

    if (isNumericColumn(data.column_type)) {
      return (
        <NumericFrequencyContent
          data={data}
          columnName={columnName}
          range={range}
          onRangeChange={handleRangeChange}
          distinctCount={distinctCount}
          totalCount={totalCount}
        />
      );
    }

    return (
      <TextFrequencyContent
        data={data}
        selectedValues={selectedValues}
        valueFilter={debouncedFilter}
        onValueFilterChange={setValueFilter}
        onToggleValue={handleToggleValue}
        distinctCount={distinctCount}
        totalCount={totalCount}
        columnName={columnName}
      />
    );
  }
);

const AccordionHeader = memo(
  ({
    columnName,
    isVisible,
    onToggleVisibility,
    isLoading,
  }: {
    columnName: string;
    isVisible: boolean;
    onToggleVisibility: () => void;
    isLoading: boolean;
  }) => {
    // Stop event propagation to prevent accordion from toggling
    const handleVisibilityClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggleVisibility();
    };

    return (
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          <span>{columnName}</span>
          {isLoading && <LuLoader className="w-4 h-4 animate-spin" />}
        </div>
        <button onClick={handleVisibilityClick} className="p-1 hover:bg-accent/50 rounded-sm">
          {isVisible ? (
            <LuEye className="w-4 h-4" />
          ) : (
            <LuEyeOff className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
      </div>
    );
  }
);

const FilterPanel = ({ filePath, columnNames, onFilterChange }: FilterPanelProps) => {
  const { state, dispatch } = useTabs();
  const activeTab = state.tabs.find(tab => tab.id === state.activeTabId);
  const columnVisibility = activeTab?.data?.columnVisibility || {};

  const [columnData, setColumnData] = useState<Record<string, ColumnFrequencyResponse>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const loadColumnFrequencies = useCallback(
    async (columnName: string) => {
      if (!filePath || columnData[columnName]) return;

      const params = {
        request: {
          path: filePath,
        },
        columnName,
      };

      try {
        setLoading(prev => ({ ...prev, [columnName]: true }));
        const response = {};
        // const response = await invoke<ColumnFrequencyResponse>('get_column_frequencies', params);
        setColumnData(prev => ({
          ...prev,
          [columnName]: response,
        }));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load frequencies');
      } finally {
        setLoading(prev => ({ ...prev, [columnName]: false }));
      }
    },
    [filePath, columnData]
  );

  const handleToggleVisibility = useCallback(
    (columnId: string) => {
      if (!activeTab) return;

      const newVisibility = {
        ...columnVisibility,
        [columnId]: !columnVisibility[columnId],
      };

      dispatch(
        updateTab(activeTab.id, {
          data: {
            ...activeTab.data,
            columnVisibility: newVisibility,
          },
        })
      );
    },
    [activeTab, columnVisibility, dispatch]
  );

  return (
    <div className="h-full flex flex-col">
      {error && <div className="p-4 text-red-500">{error}</div>}
      <ScrollArea className="flex-1">
        <Accordion type="multiple" className="w-full">
          {columnNames.map(columnName => (
            <AccordionItem key={columnName} value={columnName}>
              <AccordionTrigger
                onClick={() => loadColumnFrequencies(columnName)}
                className="hover:no-underline"
              >
                <AccordionHeader
                  columnName={columnName}
                  isVisible={columnVisibility[columnName] !== false}
                  onToggleVisibility={() => handleToggleVisibility(columnName)}
                  isLoading={loading[columnName]}
                />
              </AccordionTrigger>
              <AccordionContent className="hover:bg-transparent">
                {columnData[columnName] && (
                  <ColumnContent
                    columnName={columnName}
                    data={columnData[columnName]}
                    onFilterChange={onFilterChange}
                  />
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </ScrollArea>
    </div>
  );
};

export default FilterPanel;
