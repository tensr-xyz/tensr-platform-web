import React, { useState, useMemo, useCallback } from 'react';
import { ScrollArea } from '@/components/atoms/scroll-area';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/atoms/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/select';
import { Alert, AlertDescription } from '@/components/atoms/alert';
import { ChartContainer, ChartTooltip } from '@/components/molecules/chart';
import { Scatter, ScatterChart, XAxis, YAxis, CartesianGrid } from 'recharts';
import { LuTriangleAlert } from 'react-icons/lu';
import DistributionChart from '@/components/templates/analytics-dashboard/distribution-chart.tsx';
import { useChartState } from '@/contexts/chart-context';
import _ from 'lodash';

interface RelationshipChartProps {
  col1: string;
  col2: string;
  data: Array<Record<string, any>>;
}

interface ScatterDataPoint {
  name: string;
  x: number;
  y: number;
}

const RelationshipChart = React.memo<RelationshipChartProps>(({ col1, col2, data }) => {
  const chartConfig = {
    scatter: {
      label: `${col1} vs ${col2}`,
      color: 'hsl(var(--chart-1))',
    },
  };

  const scatterData = data
    .map(
      (row: Record<string, any>): ScatterDataPoint => ({
        name: row.Player || '',
        x: parseFloat(row[col1]),
        y: parseFloat(row[col2]),
      })
    )
    .filter((point: ScatterDataPoint) => !isNaN(point.x) && !isNaN(point.y));

  if (!col1 || !col2 || scatterData.length === 0) return null;

  return (
    <div className="w-full h-[400px]">
      <ChartContainer config={chartConfig} className="w-full h-full">
        <ScatterChart
          margin={{
            top: 20,
            right: 20,
            bottom: 60,
            left: 60,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="x"
            name={col1}
            label={{
              value: col1,
              position: 'bottom',
              offset: 40,
            }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name={col2}
            label={{
              value: col2,
              angle: -90,
              position: 'left',
              offset: 40,
            }}
          />
          <ChartTooltip
            cursor={{ strokeDasharray: '3 3' }}
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="bg-background border p-2 shadow-md">
                    <p className="font-medium">{payload[0].payload.name}</p>
                    <p>{`${col1}: ${payload[0].value}`}</p>
                    <p>{`${col2}: ${payload[0].payload.y}`}</p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Scatter name="Players" data={scatterData} fill="hsl(var(--chart-1))" />
        </ScatterChart>
      </ChartContainer>
    </div>
  );
});

export const createHistogramData = (data: any[], columnId: string, binCount = 20) => {
  try {
    // Extract and validate values
    const values = data
      .map(row => parseFloat(row[columnId]))
      .filter(val => !isNaN(val) && val !== null && val !== undefined);

    if (values.length === 0) return [];

    const min = Math.min(...values);
    const max = Math.max(...values);

    // If min equals max, create a single bin centered on that value
    if (min === max) {
      return [
        {
          range: min.toFixed(1),
          frequency: values.length,
          mean: min,
          median: min,
          standardDev: 0,
        },
      ];
    }

    // Create slightly wider bounds to ensure all points are included
    const padding = (max - min) * 0.01;
    const effectiveMin = min - padding;
    const effectiveMax = max + padding;
    const binSize = (effectiveMax - effectiveMin) / binCount;

    // Initialize bins
    const bins = Array.from({ length: binCount }, (_, i) => ({
      binStart: effectiveMin + i * binSize,
      binEnd: effectiveMin + (i + 1) * binSize,
      count: 0,
      values: [] as number[],
    }));

    // Distribute values into bins
    values.forEach(value => {
      // Safely calculate bin index
      const index = Math.floor((value - effectiveMin) / binSize);
      const binIndex = Math.min(Math.max(0, index), binCount - 1);

      if (bins[binIndex]) {
        bins[binIndex].count++;
        bins[binIndex].values.push(value);
      }
    });

    // Format bin data
    return bins.map(bin => ({
      range: bin.binStart.toFixed(1),
      rangeEnd: bin.binEnd.toFixed(1),
      frequency: bin.count,
      mean: bin.values.length > 0 ? _.mean(bin.values) : 0,
      median:
        bin.values.length > 0
          ? bin.values.sort((a, b) => a - b)[Math.floor(bin.values.length / 2)]
          : 0,
      standardDev:
        bin.values.length > 1
          ? Math.sqrt(_.mean(bin.values.map(v => Math.pow(v - _.mean(bin.values), 2))))
          : 0,
    }));
  } catch (error) {
    console.error('Error creating histogram data:', error);
    return [];
  }
};

export const calculateVariance = (values: number[]): number => {
  if (values.length === 0) return 0;
  const mean = _.mean(values);
  return _.mean(values.map(x => Math.pow(x - mean, 2)));
};

export const calculateStats = (values: number[]) => {
  if (!values || values.length === 0) return null;

  try {
    const filteredValues = values.filter(v => !isNaN(v) && v !== null && v !== undefined);
    if (filteredValues.length === 0) return null;

    const mean = _.mean(filteredValues);
    const variance = calculateVariance(filteredValues);
    const standardDev = Math.sqrt(variance);
    const sortedValues = _.sortBy(filteredValues);

    return {
      count: filteredValues.length,
      mean,
      median: sortedValues[Math.floor(filteredValues.length / 2)],
      standardDev,
      min: _.min(filteredValues),
      max: _.max(filteredValues),
      quartiles: {
        q1: sortedValues[Math.floor(filteredValues.length * 0.25)],
        q3: sortedValues[Math.floor(filteredValues.length * 0.75)],
      },
      skewness: calculateSkewness(filteredValues, mean, standardDev),
      kurtosis: calculateKurtosis(filteredValues, mean, standardDev),
    };
  } catch (error) {
    console.error('Error calculating stats:', error);
    return null;
  }
};

const calculateSkewness = (values: number[], mean: number, standardDev: number): number => {
  if (values.length < 3 || standardDev === 0) return 0;
  const n = values.length;
  const cubedDeviations = values.map(x => Math.pow((x - mean) / standardDev, 3));
  return (n / ((n - 1) * (n - 2))) * _.sum(cubedDeviations);
};

const calculateKurtosis = (values: number[], mean: number, standardDev: number): number => {
  if (values.length < 4 || standardDev === 0) return 0;
  const n = values.length;
  const fourthPowerDeviations = values.map(x => Math.pow((x - mean) / standardDev, 4));
  return (
    ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * _.sum(fourthPowerDeviations) -
    (3 * Math.pow(n - 1, 2)) / ((n - 2) * (n - 3))
  );
};

interface AnalyticsDashboardProps {
  data: Record<string, any>[];
  columns: Array<{ id: string; type: string }>;
  activeView: string;
}

const AnalyticsDashboard = ({ data, columns, activeView }: AnalyticsDashboardProps) => {
  const { state } = useChartState();
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null);
  const [comparisonColumn, setComparisonColumn] = useState<string | null>(null);

  const numericColumns = useMemo(() => {
    return columns.filter(col => {
      const firstValue = data.find(row => row[col.id] !== null)?.[col.id];
      return !isNaN(parseFloat(firstValue));
    });
  }, [columns, data]);

  const getColumnStats = useCallback(
    (columnId: string) => {
      const values = data.map(row => parseFloat(row[columnId])).filter(val => !isNaN(val));
      return calculateStats(values);
    },
    [data]
  );

  const histogramDataCallback = useCallback(
    (colId: string) => createHistogramData(data, colId),
    [data]
  );

  const renderOverview = () => (
    <>
      <Card>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 p-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Total Rows</h3>
              <p className="text-2xl font-bold">{data.length}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Numeric Columns</h3>
              <p className="text-2xl font-bold">{numericColumns.length}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Missing Values</h3>
              <p className="text-2xl font-bold">
                {data.reduce(
                  (acc, row) => acc + Object.values(row).filter(v => v === null || v === '').length,
                  0
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Data Quality Insights</CardTitle>
          <CardDescription>Potential issues detected in your data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {numericColumns.map(col => {
              const stats = getColumnStats(col.id);
              if (stats?.count !== data.length) {
                const missingCount = data.length - (stats?.count || 0);
                return (
                  <Alert key={col.id} variant="destructive">
                    <LuTriangleAlert className="h-4 w-4" />
                    <AlertDescription>
                      {col.id} has {missingCount} missing values
                    </AlertDescription>
                  </Alert>
                );
              }
              return null;
            })}
          </div>
        </CardContent>
      </Card>
    </>
  );

  const renderDistribution = () => {
    const stats = selectedColumn ? getColumnStats(selectedColumn) : null;

    return (
      <>
        <div className="flex items-center space-x-4 mb-4">
          <Select value={selectedColumn || ''} onValueChange={setSelectedColumn}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select variable" />
            </SelectTrigger>
            <SelectContent>
              {numericColumns.map(col => (
                <SelectItem key={col.id} value={col.id}>
                  {col.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {stats && (
            <div className="flex space-x-4 text-sm">
              <div className="px-3 py-1 bg-muted rounded-md">Mean: {stats.mean.toFixed(1)}</div>
              <div className="px-3 py-1 bg-muted rounded-md">Median: {stats.median.toFixed(1)}</div>
              <div className="px-3 py-1 bg-muted rounded-md">
                SD: {stats.standardDev.toFixed(1)}
              </div>
            </div>
          )}
        </div>

        {selectedColumn && stats && (
          <Card>
            <CardHeader>
              <CardTitle>Distribution of {selectedColumn}</CardTitle>
              <CardDescription>
                Skewness: {stats.skewness.toFixed(2)} | Kurtosis: {stats.kurtosis.toFixed(2)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DistributionChart
                key={`${selectedColumn}-${state.type}`} // Add key to force re-render
                columnId={selectedColumn}
                chartType={state.type}
                createHistogramData={histogramDataCallback}
              />
            </CardContent>
          </Card>
        )}
      </>
    );
  };

  const renderRelationships = () => (
    <>
      <div className="flex gap-4 mb-4">
        <Select value={selectedColumn || ''} onValueChange={setSelectedColumn}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select first variable" />
          </SelectTrigger>
          <SelectContent>
            {numericColumns.map(col => (
              <SelectItem key={col.id} value={col.id}>
                {col.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={comparisonColumn || ''} onValueChange={setComparisonColumn}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select second variable" />
          </SelectTrigger>
          <SelectContent>
            {numericColumns.map(col => (
              <SelectItem key={col.id} value={col.id}>
                {col.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedColumn && comparisonColumn && (
        <Card>
          <CardHeader>
            <CardTitle>Variable Analysis</CardTitle>
            <CardDescription>
              Relationship between {selectedColumn} and {comparisonColumn}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RelationshipChart col1={selectedColumn} col2={comparisonColumn} data={data} />
          </CardContent>
        </Card>
      )}
    </>
  );

  return (
    <div className="h-full">
      <ScrollArea className="h-full">
        <div className="p-4 space-y-4">
          {activeView === 'overview' && renderOverview()}
          {activeView === 'distribution' && renderDistribution()}
          {activeView === 'relationships' && renderRelationships()}
        </div>
      </ScrollArea>
    </div>
  );
};

export default React.memo(AnalyticsDashboard, (prevProps, nextProps) => {
  return (
    prevProps.data === nextProps.data &&
    prevProps.columns === nextProps.columns &&
    prevProps.activeView === nextProps.activeView
  );
});
