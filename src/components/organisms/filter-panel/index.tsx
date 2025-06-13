import { useState, useCallback, useMemo, memo, useEffect } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/molecules/accordion';
import { Input } from '@/components/atoms/input';
import { ScrollArea } from '@/components/atoms/scroll-area';
import { LuEye, LuEyeOff, LuLoader } from 'react-icons/lu';
import { BarChart, Bar, XAxis, ResponsiveContainer, ReferenceArea, YAxis, Cell } from 'recharts';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';
import { useTabs } from '@/contexts/tabs-context';
import { updateTab } from '@/contexts/tabs-context/actions';
import _ from 'lodash';
import useDebounce from '@/hooks/ui/use-debounce';
import useAuth from '@/hooks/api/use-auth';
import { AlertCircle } from 'lucide-react';

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

// Create FrequencyItem component with displayName
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
  <div className="flex flex-col items-center justify-center h-64 space-y-4">
    <LuLoader className="w-8 h-8 animate-spin text-primary" />
    <p className="text-sm text-muted-foreground">Loading data...</p>
  </div>
));
LoadingContent.displayName = 'LoadingContent';

// Add displayName to EmptyContent
const EmptyContent = memo(() => (
  <div className="flex flex-col items-center justify-center h-64 space-y-4">
    <p className="text-sm text-muted-foreground">No data available</p>
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
  }: {
    data: ColumnFrequencyResponse;
    columnName: string;
    range: RangeState;
    onRangeChange: (columnName: string, start: number, end: number) => void;
    distinctCount: number;
    totalCount: number;
  }) => {
    const [isSelecting, setIsSelecting] = useState(false);
    const [selectionStart, setSelectionStart] = useState<number | null>(null);

    // Safely check if data is valid before processing
    const isDataValid = useMemo(() => {
      return (
        data &&
        Array.isArray(data.frequencies) &&
        data.frequencies.length > 0 &&
        data.frequencies.every(f => !isNaN(parseFloat(f.value)))
      );
    }, [data]);

    const chartData = useMemo(() => {
      if (!isDataValid) return [];

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
    }, [data, distinctCount, isDataValid]);

    // Safely calculate domain and formatting
    const { domain, tickFormatter, color } = useMemo(() => {
      if (!chartData || chartData.length === 0) {
        return {
          domain: [0, 10] as [number, number],
          tickFormatter: (value: number) => value.toString(),
          color: generateColor(columnName),
        };
      }

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

    // If data is not valid, show a message
    if (!isDataValid) {
      return <EmptyContent />;
    }

    // If chart data is empty, show a message
    if (chartData.length === 0) {
      return <EmptyContent />;
    }

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
                  <Cell
                    key={`cell-${index}`}
                    fill={color}
                    opacity={isInRange(entry.value) ? 1 : 0.3}
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
    // Generate a consistent color for the entire column
    const backgroundColor = useMemo(() => generateColor(columnName), [columnName]);

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

    // Show user-friendly empty state if no values match filter
    const renderEmptyState = () => (
      <div className="px-4 py-6 text-sm text-muted-foreground text-center">
        {valueFilter ? 'No values match your search filter' : 'No values available'}
      </div>
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

        {filteredFrequencies.length > 0 ? (
          <div className="h-[300px]">
            <VirtualizedList
              itemCount={filteredFrequencies.length}
              itemSize={28}
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
    data: ColumnFrequencyResponse | null;
    onFilterChange: (columnName: string, values: Set<string>) => void;
    isLoading: boolean;
  }) => {
    const [valueFilter, setValueFilter] = useState('');
    const [selectedValues, setSelectedValues] = useState(new Set<string>());
    const [debouncedFilter] = useDebounce(valueFilter, 300); // Assuming useDebounce is imported

    const isNumericColumn = useCallback((columnType: string) => {
      if (!columnType) return false;
      const type = columnType.toLowerCase();
      return (
        type === 'numeric' || // Check for exact "numeric" type first
        type.startsWith('i') ||
        type.startsWith('f') ||
        type.includes('int') ||
        type.includes('float')
      );
    }, []);

    // Initialize range state safely with null checks
    const [range, setRange] = useState<RangeState>(() => {
      if (
        data &&
        isNumericColumn(data.column_type) &&
        Array.isArray(data.frequencies) &&
        data.frequencies.length > 0
      ) {
        try {
          const values = data.frequencies.map(f => parseFloat(f.value));
          return {
            start: Math.min(...values),
            end: Math.max(...values),
            isDragging: false,
          };
        } catch (err) {
          console.error('Error initializing range state:', err);
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
        try {
          const values = data.frequencies.map(f => parseFloat(f.value));
          setRange({
            start: Math.min(...values),
            end: Math.max(...values),
            isDragging: false,
          });
        } catch (err) {
          console.error('Error updating range state:', err);
        }
      }
    }, [data, isNumericColumn]);

    // Memoize these calculations with null checks
    const { distinctCount, totalCount } = useMemo(() => {
      if (!data || !Array.isArray(data.frequencies)) {
        return { distinctCount: 0, totalCount: 0 };
      }
      return {
        distinctCount: data.frequencies.length,
        totalCount: data.frequencies.reduce((sum, freq) => sum + freq.count, 0),
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
          const valuesInRange = new Set(
            data.frequencies
              .map(freq => ({ value: parseFloat(freq.value), original: freq.value }))
              .filter(({ value }) => value >= Math.min(start, end) && value <= Math.max(start, end))
              .map(({ original }) => original)
          );
          onFilterChange(columnName, valuesInRange);
        }
      },
      [columnName, data, onFilterChange]
    );

    // Show loading state if loading
    if (isLoading) {
      return <LoadingContent />;
    }

    // Show empty state if no data
    if (!data || !Array.isArray(data.frequencies) || data.frequencies.length === 0) {
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
AccordionHeader.displayName = 'AccordionHeader';

// Updated FilterPanel component to use fetch instead of invoke
const FilterPanel = ({ filePath, columnNames, onFilterChange }: FilterPanelProps) => {
  const { state, dispatch } = useTabs();
  const { tokens } = useAuth();
  const activeTab = state.tabs.find(tab => tab.id === state.activeTabId);
  const columnVisibility = activeTab?.data?.columnVisibility || {};

  const [columnData, setColumnData] = useState<Record<string, ColumnFrequencyResponse | null>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [expandedColumns, setExpandedColumns] = useState<string[]>([]);

  // Track which columns are expanded
  const handleAccordionChange = (value: string[]) => {
    setExpandedColumns(value);

    // Load data for newly expanded columns
    value.forEach(columnName => {
      if (!columnData[columnName] && !loading[columnName]) {
        loadColumnFrequencies(columnName);
      }
    });
  };

  // Improved data loading function with better error handling
  const loadColumnFrequencies = useCallback(
    async (columnName: string) => {
      if (!filePath || columnData[columnName] || loading[columnName]) return;

      const params = {
        request: {
          path: filePath,
        },
        column_name: columnName,
      };

      try {
        // Set loading state
        setLoading(prev => ({ ...prev, [columnName]: true }));
        setErrors(prev => ({ ...prev, [columnName]: null }));

        // Use fetch for the HTTP request
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_FARGATE_API_URL}/api/analysis/column-frequencies`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${tokens?.idToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(params),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to load data for column: ${columnName}`);
        }

        const data = await response.json();

        // Validate the response data
        if (!data || !Array.isArray(data.frequencies)) {
          throw new Error(`Invalid data format received for column: ${columnName}`);
        }

        // Store the data
        setColumnData(prev => ({
          ...prev,
          [columnName]: data,
        }));
      } catch (err) {
        console.error(`Error loading column frequencies for ${columnName}:`, err);
        setErrors(prev => ({
          ...prev,
          [columnName]: err instanceof Error ? err.message : 'Failed to load frequencies',
        }));

        // Set empty data to prevent repeated failures
        setColumnData(prev => ({
          ...prev,
          [columnName]: null,
        }));
      } finally {
        setLoading(prev => ({ ...prev, [columnName]: false }));
      }
    },
    [filePath, columnData, loading, tokens]
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

  // Retry loading on error
  const handleRetry = useCallback(
    (columnName: string) => {
      setErrors(prev => ({ ...prev, [columnName]: null }));
      loadColumnFrequencies(columnName);
    },
    [loadColumnFrequencies]
  );

  return (
    <div className="h-full flex flex-col">
      <ScrollArea className="flex-1">
        <Accordion
          type="multiple"
          className="w-full"
          value={expandedColumns}
          onValueChange={handleAccordionChange}
        >
          {columnNames.map(columnName => (
            <AccordionItem key={columnName} value={columnName}>
              <AccordionTrigger className="hover:no-underline">
                <AccordionHeader
                  columnName={columnName}
                  isVisible={columnVisibility[columnName] !== false}
                  onToggleVisibility={() => handleToggleVisibility(columnName)}
                  isLoading={loading[columnName]}
                />
              </AccordionTrigger>
              <AccordionContent className="hover:bg-transparent">
                {errors[columnName] ? (
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
                    isLoading={loading[columnName]}
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
FilterPanel.displayName = 'FilterPanel';

export default FilterPanel;
