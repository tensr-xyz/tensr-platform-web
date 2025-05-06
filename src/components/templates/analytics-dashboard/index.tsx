import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { ScrollArea } from '@/components/atoms/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/select';

// Type definitions from FilterPanel
interface ValueFrequency {
  value: string;
  count: number;
  percentage: number;
}

interface ColumnFrequencyResponse {
  frequencies: ValueFrequency[];
  column_type: string;
}

interface AnalyticsDashboardProps {
  filePath: string;
  columns: { id: string; name?: string }[];
  viewMode?: string;
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  filePath,
  columns,
  viewMode = 'bottom',
}) => {
  // State for chart configuration
  const [xAxis, setXAxis] = useState('');
  const [yAxis, setYAxis] = useState('');
  const [chartType, setChartType] = useState('bar');

  // State for frequency data from API
  const [columnFrequencies, setColumnFrequencies] = useState<
    Record<string, ColumnFrequencyResponse>
  >({});
  const [loadingColumn, setLoadingColumn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Refs to track initialization and prevent infinite loops
  const initializedRef = useRef(false);
  const requestedColumnsRef = useRef(new Set<string>());

  // Colors for charts
  const COLORS = [
    '#4361ee',
    '#3a0ca3',
    '#7209b7',
    '#f72585',
    '#4cc9f0',
    '#4895ef',
    '#560bad',
    '#f15bb5',
    '#fee440',
    '#00bbf9',
    '#00f5d4',
    '#01497c',
    '#c77dff',
    '#ff9e00',
    '#9e2a2b',
  ];

  // Load frequency data for a column - FIXED to prevent infinite loops
  const loadColumnFrequencies = useCallback(
    async (columnName: string) => {
      // Don't make API calls for non-existent files or already requested columns
      if (!filePath || !columnName || requestedColumnsRef.current.has(columnName)) {
        return;
      }

      // Check if we already have this column's data in state
      if (columnFrequencies[columnName]) {
        return;
      }

      // Mark column as requested to prevent duplicate requests
      requestedColumnsRef.current.add(columnName);
      setLoadingColumn(columnName);
      setError(null);

      try {
        const params = {
          request: {
            path: filePath,
          },
          columnName,
        };

        const response = await invoke<ColumnFrequencyResponse>('get_column_frequencies', params);

        setColumnFrequencies(prev => ({
          ...prev,
          [columnName]: response,
        }));

        // We successfully loaded this column, keep it in the requested set
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load frequencies');

        // Remove from requested set on error to allow retry
        requestedColumnsRef.current.delete(columnName);
      } finally {
        setLoadingColumn(null);
      }
    },
    [filePath]
  ); // Only depend on filePath to prevent re-creation

  // Initial setup of columns - FIXED to prevent infinite loops
  useEffect(() => {
    // Only run once for initial setup
    if (initializedRef.current || columns.length === 0) return;

    // Helper to find appropriate columns
    const findCategoricalColumn = () => {
      return columns.find(col => {
        const lowerId = (col.id || '').toLowerCase();
        return (
          lowerId.includes('category') ||
          lowerId.includes('type') ||
          lowerId.includes('name') ||
          lowerId.includes('state') ||
          lowerId.includes('country')
        );
      });
    };

    const findNumericColumn = () => {
      return columns.find(col => {
        const lowerId = (col.id || '').toLowerCase();
        return (
          lowerId.includes('value') ||
          lowerId.includes('count') ||
          lowerId.includes('amount') ||
          lowerId.includes('total') ||
          lowerId.includes('case')
        );
      });
    };

    // Set X axis
    const categoricalColumn = findCategoricalColumn();
    const xAxisValue = categoricalColumn?.id || columns[0].id;

    // Set Y axis
    let yAxisValue = xAxisValue; // Default to the same as X-axis

    if (columns.length > 1) {
      const numericColumn = findNumericColumn();
      if (numericColumn && numericColumn.id !== xAxisValue) {
        yAxisValue = numericColumn.id;
      } else if (columns[1].id !== xAxisValue) {
        yAxisValue = columns[1].id;
      }
    }

    // Mark as initialized before setting state to prevent re-runs
    initializedRef.current = true;

    // Set the axis values
    setXAxis(xAxisValue);
    setYAxis(yAxisValue);
  }, [columns]); // Only depends on columns, not on xAxis/yAxis

  // Load frequencies when selected columns change
  useEffect(() => {
    if (!initializedRef.current) return;

    if (xAxis) {
      loadColumnFrequencies(xAxis);
    }

    if (yAxis && yAxis !== xAxis) {
      loadColumnFrequencies(yAxis);
    }
  }, [xAxis, yAxis, loadColumnFrequencies]);

  // Process data for chart
  const chartData = useMemo(() => {
    // Need at least X axis data
    if (!columnFrequencies[xAxis]) {
      return [];
    }

    // If X and Y are the same column (single dimension visualization)
    if (xAxis === yAxis) {
      return columnFrequencies[xAxis].frequencies
        .sort((a, b) => b.count - a.count)
        .slice(0, 20) // Limit to top 20 for readability
        .map(freq => ({
          name: freq.value,
          value: freq.count,
        }));
    }

    // For different dimensions, we need to create a more meaningful visualization

    // If we're missing Y dimension data
    if (!columnFrequencies[yAxis]) {
      return [];
    }

    // Get the top values from each dimension
    const topXValues = [...columnFrequencies[xAxis].frequencies]
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topYValues = [...columnFrequencies[yAxis].frequencies]
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Create a combined dataset that shows both dimensions' frequencies
    return topXValues.map((xFreq, index) => {
      // Find a Y value at the same rank
      const yFreq = topYValues[index] || { value: 'N/A', count: 0 };

      return {
        name: xFreq.value,
        [xAxis]: xFreq.count,
        [yAxis]: yFreq.count,
        yName: yFreq.value, // Include Y dimension name for tooltips
      };
    });
  }, [xAxis, yAxis, columnFrequencies]);

  // Render chart based on type
  const renderChart = () => {
    if (!chartData.length) {
      return (
        <div className="h-[400px] flex items-center justify-center text-muted-foreground">
          {loadingColumn
            ? 'Loading data...'
            : error
              ? `Error: ${error}`
              : 'No data available for the selected dimensions'}
        </div>
      );
    }

    if (xAxis === yAxis) {
      // Single dimension visualization
      if (chartType === 'pie') {
        return (
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={150}
                  fill="#8884d8"
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                >
                  {chartData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={value => [`${value} items`, 'Count']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        );
      }

      if (chartType === 'line') {
        return (
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 70 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  height={50}
                  angle={-45}
                  textAnchor="end"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  label={{
                    value: 'Count',
                    angle: -90,
                    position: 'insideLeft',
                    style: { textAnchor: 'middle' },
                  }}
                />
                <Tooltip formatter={value => [`${value} items`, 'Count']} />
                <Line type="monotone" dataKey="value" stroke={COLORS[0]} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        );
      }

      // Default to bar chart for single dimension
      return (
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 70 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                height={50}
                angle={-45}
                textAnchor="end"
              />
              <YAxis
                tick={{ fontSize: 11 }}
                label={{
                  value: 'Count',
                  angle: -90,
                  position: 'insideLeft',
                  style: { textAnchor: 'middle' },
                }}
              />
              <Tooltip formatter={value => [`${value} items`, 'Count']} />
              <Bar dataKey="value" fill={COLORS[0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    } else {
      // Multi-dimension visualization (comparing two dimensions)
      if (chartType === 'pie') {
        // Pie doesn't work well for two dimensions, fall back to bar
        return (
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 70 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  height={50}
                  angle={-45}
                  textAnchor="end"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  label={{
                    value: 'Count',
                    angle: -90,
                    position: 'insideLeft',
                    style: { textAnchor: 'middle' },
                  }}
                />
                <Tooltip
                  formatter={(value, name, props) => {
                    // For Y dimension values, show the actual value name
                    if (name === yAxis && props.payload) {
                      return [`${value} items (${props.payload.yName})`, name];
                    }
                    return [`${value} items`, name];
                  }}
                />
                <Bar dataKey={xAxis} fill={COLORS[0]} />
                <Bar dataKey={yAxis} fill={COLORS[1]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      }

      if (chartType === 'line') {
        return (
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 70 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  height={50}
                  angle={-45}
                  textAnchor="end"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  label={{
                    value: 'Count',
                    angle: -90,
                    position: 'insideLeft',
                    style: { textAnchor: 'middle' },
                  }}
                />
                <Tooltip
                  formatter={(value, name, props) => {
                    // For Y dimension values, show the actual value name
                    if (name === yAxis && props.payload) {
                      return [`${value} items (${props.payload.yName})`, name];
                    }
                    return [`${value} items`, name];
                  }}
                />
                <Line type="monotone" dataKey={xAxis} stroke={COLORS[0]} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey={yAxis} stroke={COLORS[1]} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        );
      }

      // Default to bar chart for two dimensions
      return (
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 70 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                height={50}
                angle={-45}
                textAnchor="end"
              />
              <YAxis
                tick={{ fontSize: 11 }}
                label={{
                  value: 'Count',
                  angle: -90,
                  position: 'insideLeft',
                  style: { textAnchor: 'middle' },
                }}
              />
              <Tooltip
                formatter={(value, name, props) => {
                  // For Y dimension values, show the actual value name
                  if (name === yAxis && props.payload) {
                    return [`${value} items (${props.payload.yName})`, name];
                  }
                  return [`${value} items`, name];
                }}
              />
              <Bar dataKey={xAxis} fill={COLORS[0]} />
              <Bar dataKey={yAxis} fill={COLORS[1]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }
  };

  // Simplified view for bottom mode
  if (viewMode === 'bottom') {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-4 p-2 border-b">
          <div className="flex-1">
            <Select value={xAxis} onValueChange={setXAxis}>
              <SelectTrigger className="h-7">
                <SelectValue placeholder="Select X dimension" />
              </SelectTrigger>
              <SelectContent>
                {columns.map(col => (
                  <SelectItem key={col.id} value={col.id}>
                    {col.name || col.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Select value={yAxis} onValueChange={setYAxis}>
              <SelectTrigger className="h-7">
                <SelectValue placeholder="Select Y dimension" />
              </SelectTrigger>
              <SelectContent>
                {columns.map(col => (
                  <SelectItem key={col.id} value={col.id}>
                    {col.name || col.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Select value={chartType} onValueChange={setChartType}>
              <SelectTrigger className="h-7 w-24">
                <SelectValue placeholder="Chart type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bar">Bar</SelectItem>
                <SelectItem value="line">Line</SelectItem>
                <SelectItem value="pie">Pie</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex-1">{renderChart()}</div>
      </div>
    );
  }

  // Full view with more controls and stats
  return (
    <div className="h-full flex flex-col">
      <div className="flex-1">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-4">
            <div>
              <div>
                <div className="flex flex-wrap items-center gap-4 mb-4">
                  <div>
                    <label className="text-sm font-medium block mb-1">X Dimension</label>
                    <Select value={xAxis} onValueChange={setXAxis}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select X dimension" />
                      </SelectTrigger>
                      <SelectContent>
                        {columns.map(col => (
                          <SelectItem key={col.id} value={col.id}>
                            {col.name || col.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium block mb-1">Y Dimension</label>
                    <Select value={yAxis} onValueChange={setYAxis}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select Y dimension" />
                      </SelectTrigger>
                      <SelectContent>
                        {columns.map(col => (
                          <SelectItem key={col.id} value={col.id}>
                            {col.name || col.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium block mb-1">Chart Type</label>
                    <Select value={chartType} onValueChange={setChartType}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select chart type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bar">Bar Chart</SelectItem>
                        <SelectItem value="line">Line Chart</SelectItem>
                        <SelectItem value="pie">Pie Chart</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {renderChart()}
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
