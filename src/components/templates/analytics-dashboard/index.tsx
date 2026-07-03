'use client';

import React, { useEffect, useCallback, useMemo, useRef } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ScatterChart,
  Scatter,
  AreaChart,
  Area,
  ResponsiveContainer,
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/molecules/chart';
import { useChartState } from '@/contexts/chart-context';
import { ChartType } from '@/contexts/chart-context/types';
import {
  CHART_AXIS_TICK_STYLE,
  CHART_CURSOR_FILL,
  CHART_GRID_STYLE,
  CHART_SERIES_COLORS,
} from '@/lib/chart-theme';

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
  columns: { id: string; name?: string; type?: string }[];
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ filePath, columns }) => {
  const { state } = useChartState();
  const xAxis = state.xAxis ?? '';
  const yAxis = state.yAxis ?? '';
  const chartType = state.type;

  const [columnFrequencies, setColumnFrequencies] = React.useState<
    Record<string, ColumnFrequencyResponse>
  >({});
  const [loadingColumn, setLoadingColumn] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const initializedRef = useRef(false);
  const requestedColumnsRef = useRef(new Set<string>());

  const loadColumnFrequencies = useCallback(
    async (columnName: string) => {
      if (!filePath || !columnName || requestedColumnsRef.current.has(columnName)) return;
      if (columnFrequencies[columnName]) return;

      requestedColumnsRef.current.add(columnName);
      setLoadingColumn(columnName);
      setError(null);

      try {
        const response: ColumnFrequencyResponse = {
          frequencies: Array(10)
            .fill(null)
            .map((_, i) => ({
              value: `Value ${i + 1}`,
              count: Math.floor(Math.random() * 100) + 1,
              percentage: Math.random() * 0.5,
            })),
          column_type: columnName.toLowerCase().includes('date') ? 'date' : 'categorical',
        };
        setColumnFrequencies(prev => ({ ...prev, [columnName]: response }));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load frequencies');
        requestedColumnsRef.current.delete(columnName);
      } finally {
        setLoadingColumn(null);
      }
    },
    [filePath, columnFrequencies]
  );

  useEffect(() => {
    if (initializedRef.current || columns.length === 0) return;
    if (!state.xAxis && columns[0]) {
      initializedRef.current = true;
    }
  }, [columns, state.xAxis]);

  useEffect(() => {
    if (xAxis) loadColumnFrequencies(xAxis);
    if (yAxis && yAxis !== xAxis) loadColumnFrequencies(yAxis);
  }, [xAxis, yAxis, loadColumnFrequencies]);

  const chartData = useMemo(() => {
    if (!xAxis || !columnFrequencies[xAxis]) return [];

    if (xAxis === yAxis || !yAxis || !columnFrequencies[yAxis]) {
      return columnFrequencies[xAxis].frequencies
        .sort((a, b) => b.count - a.count)
        .slice(0, 24)
        .map(freq => ({
          name: freq.value,
          value: freq.count,
        }));
    }

    const topXValues = [...columnFrequencies[xAxis].frequencies]
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
    const topYValues = [...columnFrequencies[yAxis].frequencies]
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);

    return topXValues.map((xFreq, index) => {
      const yFreq = topYValues[index] || { value: 'N/A', count: 0 };
      return {
        name: xFreq.value,
        [xAxis]: xFreq.count,
        [yAxis]: yFreq.count,
        yName: yFreq.value,
      };
    });
  }, [xAxis, yAxis, columnFrequencies]);

  const chartMargin = { top: 28, right: 28, left: 8, bottom: 56 };
  const barRadius: [number, number, number, number] = [3, 3, 0, 0];

  const renderEmpty = (message: string) => (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-8 text-center">
      <p className="text-sm font-medium text-foreground">{message}</p>
      <p className="max-w-sm text-xs text-muted-foreground">
        Choose chart type and assign variables in the left panel, including graph options below.
      </p>
    </div>
  );

  const renderChart = () => {
    if (!xAxis || !yAxis) {
      return renderEmpty('Select variables to preview your chart');
    }
    if (!chartData.length) {
      return renderEmpty(
        loadingColumn
          ? 'Loading chart data…'
          : error
            ? `Error: ${error}`
            : 'No data for these variables'
      );
    }

    const commonX = (
      <XAxis
        dataKey="name"
        tick={CHART_AXIS_TICK_STYLE}
        height={52}
        angle={-32}
        textAnchor="end"
        axisLine={{ stroke: 'hsl(var(--border))' }}
        tickLine={{ stroke: 'hsl(var(--border))' }}
        interval={0}
      />
    );
    const commonY = (
      <YAxis
        tick={CHART_AXIS_TICK_STYLE}
        axisLine={false}
        tickLine={{ stroke: 'hsl(var(--border))', strokeOpacity: 0.5 }}
        width={48}
      />
    );
    const grid = <CartesianGrid {...CHART_GRID_STYLE} vertical={false} strokeDasharray="3 3" />;
    const tooltip = (
      <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: CHART_CURSOR_FILL }} />
    );

    if (xAxis === yAxis) {
      if (chartType === ChartType.LINE) {
        return (
          <ChartContainer config={{}} className="h-full w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={chartMargin}>
                {grid}
                {commonX}
                {commonY}
                {tooltip}
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={CHART_SERIES_COLORS[0]}
                  strokeWidth={2}
                  dot={{ r: 3, fill: CHART_SERIES_COLORS[0] }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        );
      }
      return (
        <ChartContainer config={{}} className="h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={chartMargin}>
              {grid}
              {commonX}
              {commonY}
              {tooltip}
              <Bar dataKey="value" fill={CHART_SERIES_COLORS[0]} radius={barRadius} />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      );
    }

    if (chartType === ChartType.SCATTER) {
      const scatterData = chartData.map((d, i) => {
        const row = d as Record<string, string | number>;
        return {
          x: Number(row[xAxis]) || 0,
          y: Number(row[yAxis]) || 0,
          name: String(row.name ?? ''),
          fill: CHART_SERIES_COLORS[i % CHART_SERIES_COLORS.length],
        };
      });
      return (
        <ChartContainer config={{}} className="h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={chartMargin}>
              {grid}
              <XAxis
                type="number"
                dataKey="x"
                name={xAxis}
                tick={CHART_AXIS_TICK_STYLE}
                axisLine={{ stroke: 'hsl(var(--border))' }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name={yAxis}
                tick={CHART_AXIS_TICK_STYLE}
                axisLine={false}
                tickLine={{ stroke: 'hsl(var(--border))', strokeOpacity: 0.5 }}
                width={48}
              />
              {tooltip}
              <Scatter data={scatterData} fill={CHART_SERIES_COLORS[0]} />
            </ScatterChart>
          </ResponsiveContainer>
        </ChartContainer>
      );
    }

    if (chartType === ChartType.AREA) {
      return (
        <ChartContainer config={{}} className="h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={chartMargin}>
              {grid}
              {commonX}
              {commonY}
              {tooltip}
              <Area
                type="monotone"
                dataKey={yAxis}
                stroke={CHART_SERIES_COLORS[0]}
                fill={CHART_SERIES_COLORS[0]}
                fillOpacity={0.12}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
      );
    }

    if (chartType === ChartType.LINE) {
      return (
        <ChartContainer config={{}} className="h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={chartMargin}>
              {grid}
              {commonX}
              {commonY}
              {tooltip}
              <Line
                type="monotone"
                dataKey={yAxis}
                stroke={CHART_SERIES_COLORS[0]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      );
    }

    return (
      <ChartContainer config={{}} className="h-full w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={chartMargin}>
            {grid}
            {commonX}
            {commonY}
            {tooltip}
            <Bar dataKey={yAxis} fill={CHART_SERIES_COLORS[0]} radius={barRadius} />
            {chartType === ChartType.BAR && xAxis !== yAxis ? (
              <Bar dataKey={xAxis} fill={CHART_SERIES_COLORS[1]} radius={barRadius} />
            ) : null}
          </BarChart>
        </ResponsiveContainer>
      </ChartContainer>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <div className="min-h-0 flex-1">{renderChart()}</div>
    </div>
  );
};

export default AnalyticsDashboard;
