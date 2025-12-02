import { ReactNode, useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/molecules/dialog';
import { Alert, AlertDescription } from '@/components/atoms/alert';
import { Button } from '@/components/atoms/button';
import { Label } from '@/components/atoms/label';
import { Checkbox } from '@/components/atoms/checkbox';
import { useTabsStore } from '@/stores/tabs-store';
import { Loader2 as Loader } from 'lucide-react';

interface DataQualityMetric {
  total_rows: number;
  total_columns: number;
  numeric_columns: string[];
  categorical_columns: string[];
  date_columns: string[];
  column_metrics: Record<
    string,
    {
      data_type: string;
      missing_count: number;
      missing_percentage: number;
      unique_count: number;
      unique_percentage: number;
      min_value?: string | number;
      max_value?: string | number;
      mean?: number;
      std_dev?: number;
      quartiles?: number[];
      top_values?: Array<{ value: string; count: number }>;
      patterns?: Array<{ pattern: string; count: number }>;
    }
  >;
}

interface DataQualityProps {
  children: ReactNode;
}

export const DataQualityDialog = ({ children }: DataQualityProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<DataQualityMetric | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const { tabs, activeTabId } = useTabsStore();

  const activeTab = useMemo(() => tabs.find(tab => tab.id === activeTabId), [tabs, activeTabId]);

  const criticalError = useMemo(() => {
    if (!activeTab) return 'Please open a dataset first';
    if (!activeTab.data?.initialData) return 'No data available';
    if (!activeTab.data?.filePath) return 'No file path available';
    return null;
  }, [activeTab]);

  const columnNames = useMemo(() => {
    if (!activeTab?.data?.initialData?.[0]) {
      return [];
    }
    const cols = Object.keys(activeTab.data.initialData[0]).filter(key => key !== 'id');
    return cols;
  }, [activeTab?.data?.initialData]);

  const handleColumnToggle = (column: string) => {
    setSelectedColumns(prev =>
      prev.includes(column) ? prev.filter(c => c !== column) : [...prev, column]
    );
  };

  const handleAnalyze = async () => {
    try {
      if (!activeTab?.data?.filePath) {
        setError('File path not available');
        return;
      }

      if (selectedColumns.length === 0) {
        setError('Please select at least one column');
        return;
      }

      setIsLoading(true);
      setError(null);

      // Original code:
      // const response = await invoke<DataQualityMetric>('analyze_data_quality', {
      //   request: {
      //     path: activeTab.data.filePath,
      //     columns: selectedColumns,
      //   },
      // });

      // Create a mock response with appropriate typing
      const response: DataQualityMetric = {
        total_rows: 1000,
        total_columns: columnNames.length,
        numeric_columns: selectedColumns.filter(
          col =>
            col.toLowerCase().includes('price') ||
            col.toLowerCase().includes('amount') ||
            col.toLowerCase().includes('count') ||
            col.toLowerCase().includes('id')
        ),
        categorical_columns: selectedColumns.filter(
          col =>
            col.toLowerCase().includes('type') ||
            col.toLowerCase().includes('category') ||
            col.toLowerCase().includes('name')
        ),
        date_columns: selectedColumns.filter(
          col => col.toLowerCase().includes('date') || col.toLowerCase().includes('time')
        ),
        column_metrics: Object.fromEntries(
          selectedColumns.map(col => {
            // Determine the type based on column name
            const isNumeric =
              col.toLowerCase().includes('price') ||
              col.toLowerCase().includes('amount') ||
              col.toLowerCase().includes('count') ||
              col.toLowerCase().includes('id');
            const isDate = col.toLowerCase().includes('date') || col.toLowerCase().includes('time');
            const dataType = isNumeric ? 'numeric' : isDate ? 'date' : 'categorical';

            // Create metrics based on type
            const baseMetrics = {
              data_type: dataType,
              missing_count: Math.floor(Math.random() * 50),
              missing_percentage: Math.random() * 5,
              unique_count: Math.floor(Math.random() * 200) + 50,
              unique_percentage: Math.random() * 20 + 10,
            };

            if (dataType === 'numeric') {
              return [
                col,
                {
                  ...baseMetrics,
                  min_value: Math.floor(Math.random() * 100),
                  max_value: Math.floor(Math.random() * 1000) + 500,
                  mean: Math.random() * 500 + 100,
                  std_dev: Math.random() * 100 + 10,
                  quartiles: [
                    Math.random() * 200 + 50,
                    Math.random() * 200 + 250,
                    Math.random() * 200 + 450,
                  ],
                },
              ];
            } else if (dataType === 'categorical') {
              return [
                col,
                {
                  ...baseMetrics,
                  top_values: Array(5)
                    .fill(null)
                    .map((_, i) => ({
                      value: `Category ${i + 1}`,
                      count: Math.floor(Math.random() * 200) + 50,
                    })),
                  patterns: Array(3)
                    .fill(null)
                    .map((_, i) => ({
                      pattern: `Pattern ${String.fromCharCode(65 + i)}`,
                      count: Math.floor(Math.random() * 100) + 20,
                    })),
                },
              ];
            } else {
              return [
                col,
                {
                  ...baseMetrics,
                  min_value: '2023-01-01',
                  max_value: '2023-12-31',
                  patterns: Array(2)
                    .fill(null)
                    .map((_, i) => ({
                      pattern: i === 0 ? 'YYYY-MM-DD' : 'MM/DD/YYYY',
                      count: Math.floor(Math.random() * 400) + 100,
                    })),
                },
              ];
            }
          })
        ),
      };

      setMetrics(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze data quality');
    } finally {
      setIsLoading(false);
    }
  };

  const renderMetrics = () => {
    if (!metrics) return null;

    return (
      <div className="mt-4 space-y-4">
        <div className="bg-muted p-4 rounded-lg">
          <h3 className="font-medium mb-2">Dataset Overview</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>Total Rows:</div>
            <div>{metrics.total_rows}</div>
            <div>Total Columns:</div>
            <div>{metrics.total_columns}</div>
            <div>Numeric Columns:</div>
            <div>{metrics.numeric_columns.length}</div>
            <div>Categorical Columns:</div>
            <div>{metrics.categorical_columns.length}</div>
            <div>Date Columns:</div>
            <div>{metrics.date_columns.length}</div>
          </div>
        </div>

        {selectedColumns.map(colName => {
          const metrics_data = metrics.column_metrics[colName];
          if (!metrics_data) return null;

          return (
            <div key={colName} className="bg-muted p-4 rounded-lg">
              <h3 className="font-medium mb-2">{colName}</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>Data Type:</div>
                <div>{metrics_data.data_type}</div>
                <div>Missing Values:</div>
                <div>
                  {metrics_data.missing_percentage.toFixed(2)}% ({metrics_data.missing_count})
                </div>
                <div>Unique Values:</div>
                <div>
                  {metrics_data.unique_percentage.toFixed(2)}% ({metrics_data.unique_count})
                </div>

                {metrics_data.min_value !== undefined && (
                  <>
                    <div>Min Value:</div>
                    <div>{metrics_data.min_value}</div>
                    <div>Max Value:</div>
                    <div>{metrics_data.max_value}</div>
                  </>
                )}

                {metrics_data.mean !== undefined && (
                  <>
                    <div>Mean:</div>
                    <div>{metrics_data.mean?.toFixed(2) ?? 'N/A'}</div>
                    <div>Standard Deviation:</div>
                    <div>{metrics_data.std_dev?.toFixed(2) ?? 'N/A'}</div>
                  </>
                )}

                {metrics_data.quartiles && (
                  <>
                    <div>Quartiles (Q1/Q2/Q3):</div>
                    <div>{metrics_data.quartiles.map(q => q.toFixed(2)).join(' / ')}</div>
                  </>
                )}

                {metrics_data.top_values && (
                  <div className="col-span-2">
                    <div className="mt-2 mb-1 font-medium">Top Values:</div>
                    <div className="grid grid-cols-2 gap-1">
                      {metrics_data.top_values.map(({ value, count }, i) => (
                        <div key={i} className="flex justify-between">
                          <span>{value}</span>
                          <span>{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {metrics_data.patterns && (
                  <div className="col-span-2">
                    <div className="mt-2 mb-1 font-medium">Common Patterns:</div>
                    <div className="grid grid-cols-2 gap-1">
                      {metrics_data.patterns.map(({ pattern, count }, i) => (
                        <div key={i} className="flex justify-between">
                          <span>{pattern}</span>
                          <span>{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Dialog>
      {children}
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Data Quality Report</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Columns to Analyze</Label>
            <div className="grid gap-2 max-h-40 overflow-y-auto p-2 border rounded-sm">
              {columnNames.length > 0 ? (
                columnNames.map(column => (
                  <div key={column} className="flex items-center space-x-2">
                    <Checkbox
                      id={column}
                      checked={selectedColumns.includes(column)}
                      onCheckedChange={() => handleColumnToggle(column)}
                    />
                    <Label htmlFor={column} className="cursor-pointer">
                      {column}
                    </Label>
                  </div>
                ))
              ) : (
                <div className="text-sm text-gray-500">No columns available</div>
              )}
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="text-sm text-gray-500">
            File: {activeTab?.data?.filePath || 'No file selected'}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleAnalyze} disabled={isLoading || !!criticalError}>
            {isLoading ? <Loader className="h-4 w-4 animate-spin" /> : 'Analyze Data Quality'}
          </Button>
        </DialogFooter>

        {metrics && renderMetrics()}
      </DialogContent>
    </Dialog>
  );
};

export default DataQualityDialog;
