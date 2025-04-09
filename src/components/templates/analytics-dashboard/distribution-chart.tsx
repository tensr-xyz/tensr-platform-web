import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  Area,
  AreaChart,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/molecules/chart';
import { ChartType } from '@/contexts/chart-context/types';

interface DistributionChartProps {
  columnId: string;
  chartType: ChartType;
  createHistogramData: (columnId: string) => any[];
}

const formatTick = (value: number) => {
  return value.toFixed(1);
};

const DistributionChart = ({
  columnId,
  chartType,
  createHistogramData,
}: DistributionChartProps) => {
  const chartData = useMemo(() => {
    if (!columnId) return [];
    return createHistogramData(columnId);
  }, [columnId, createHistogramData]);

  const chartConfig = useMemo(
    () => ({
      frequency: {
        label: columnId,
        color: 'hsl(var(--chart-1))',
      },
    }),
    [columnId, chartType]
  ); // Added chartType as dependency

  if (!columnId) return null;

  const commonProps = {
    data: chartData,
    margin: { top: 10, right: 30, left: 40, bottom: 20 },
  };

  const commonAxes = (
    <>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis
        dataKey="range"
        height={40}
        tickFormatter={formatTick}
        type="number"
        domain={['auto', 'auto']}
      />
      <YAxis width={40} dataKey="frequency" />
      <ChartTooltip content={<ChartTooltipContent />} />
    </>
  );

  switch (chartType) {
    case ChartType.BAR:
      return (
        <div className="w-full h-[400px]">
          <ChartContainer config={chartConfig} className="w-full h-full">
            <BarChart {...commonProps}>
              {commonAxes}
              <Bar dataKey="frequency" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </div>
      );

    case ChartType.LINE:
      return (
        <div className="w-full h-[400px]">
          <ChartContainer config={chartConfig} className="w-full h-full">
            <LineChart {...commonProps}>
              {commonAxes}
              <Line type="monotone" dataKey="frequency" stroke="hsl(var(--chart-1))" dot={false} />
            </LineChart>
          </ChartContainer>
        </div>
      );

    case ChartType.AREA:
      return (
        <div className="w-full h-[400px]">
          <ChartContainer config={chartConfig} className="w-full h-full">
            <AreaChart {...commonProps}>
              {commonAxes}
              <Area
                type="monotone"
                dataKey="frequency"
                stroke="hsl(var(--chart-1))"
                fill="hsl(var(--chart-1))"
                fillOpacity={0.3}
              />
            </AreaChart>
          </ChartContainer>
        </div>
      );

    case ChartType.SCATTER:
      const scatterData = chartData.map(d => ({
        x: parseFloat(d.range),
        y: d.frequency,
      }));

      return (
        <div className="w-full h-[400px]">
          <ChartContainer config={chartConfig} className="w-full h-full">
            <ScatterChart {...commonProps}>
              {commonAxes}
              <Scatter data={scatterData} dataKey="y" fill="hsl(var(--chart-1))" />
            </ScatterChart>
          </ChartContainer>
        </div>
      );

    default:
      return (
        <div className="w-full h-[400px]">
          <ChartContainer config={chartConfig} className="w-full h-full">
            <BarChart {...commonProps}>
              {commonAxes}
              <Bar dataKey="frequency" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </div>
      );
  }
};

// We can either remove React.memo completely
// export default DistributionChart;

// Or specify the comparison function to include chartType
export default React.memo(DistributionChart, (prevProps, nextProps) => {
  return (
    prevProps.columnId === nextProps.columnId &&
    prevProps.chartType === nextProps.chartType &&
    prevProps.createHistogramData === nextProps.createHistogramData
  );
});
