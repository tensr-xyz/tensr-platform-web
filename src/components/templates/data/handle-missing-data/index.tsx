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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/select';
import { Checkbox } from '@/components/atoms/checkbox';
import { useProject } from '@/contexts/project-context';
import { useTabsStore } from '@/stores/tabs-store';
import { ProjectActions } from '@/contexts/project-context/types';
import { LuLoader } from 'react-icons/lu';

type MissingDataMethod =
  | 'series_mean'
  | 'linear_interpolation'
  | 'linear_trend'
  | 'median_nearby'
  | 'custom_value'
  | 'multiple_imputation';

const MISSING_DATA_METHODS: Record<MissingDataMethod, string> = {
  series_mean: 'Series Mean',
  linear_interpolation: 'Linear Interpolation',
  linear_trend: 'Linear Trend',
  median_nearby: 'Median of Nearby Points',
  custom_value: 'Custom Value',
  multiple_imputation: 'Multiple Imputation',
};

interface HandleMissingDataProps {
  children: ReactNode;
}

interface HandleMissingDataRequest {
  path: string;
  columns: string[];
  method: MissingDataMethod;
  custom_value?: string | null;
}

interface HandleMissingDataResponse {
  path: string;
  metadata: {
    rows: number;
    columns: number;
    column_names: string[];
    preview: any[];
  };
  column_summaries?: Record<string, any>;
  replaced_values_count?: number;
}

export const HandleMissingDataDialog = ({ children }: HandleMissingDataProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<MissingDataMethod>('series_mean');
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [customValue, setCustomValue] = useState<string>('');
  const { tabs, activeTabId } = useTabsStore();
  const { dispatch } = useProject();

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
    setSelectedColumns(prev => {
      const newSelection = prev.includes(column)
        ? prev.filter(c => c !== column)
        : [...prev, column];
      return newSelection;
    });
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

      if (method === 'custom_value' && !customValue) {
        setError('Please enter a custom value');
        return;
      }

      setIsLoading(true);
      setError(null);

      const requestData: HandleMissingDataRequest = {
        path: activeTab.data.filePath,
        columns: selectedColumns,
        method,
        custom_value: method === 'custom_value' ? customValue : null,
      };

      // Create a mock response for type checking while we implement the API
      const mockResponse: HandleMissingDataResponse = {
        path: activeTab.data.filePath.replace('.csv', '_imputed.csv'),
        metadata: {
          rows: activeTab.data.initialData?.length || 0,
          columns: columnNames.length,
          column_names: columnNames,
          preview: activeTab.data.initialData?.slice(0, 5) || [],
        },
        column_summaries: selectedColumns.reduce(
          (acc, col) => {
            acc[col] = {
              type: 'numeric', // Assuming numeric for simplicity
              missing_before: Math.floor(Math.random() * 20), // Random number for demonstration
              missing_after: 0,
              method: method,
            };
            return acc;
          },
          {} as Record<string, any>
        ),
        replaced_values_count: Math.floor(Math.random() * 50) + 10, // Random count between 10-60
      };

      // TODO: Replace with actual API call
      // const response = await fetch('/api/handle-missing-data', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({ request: requestData }),
      // });
      // const data: HandleMissingDataResponse = await response.json();

      // Using mock response for now
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API delay
      const response = mockResponse;

      dispatch({
        type: ProjectActions.SET_IMPORT_DATA,
        payload: {
          fileName: 'processed_dataset.csv',
          filePath: response.path,
          preview: response.metadata.preview,
          columnNames: response.metadata.column_names,
          totalRows: response.metadata.rows,
          totalColumns: response.metadata.columns,
          columnSummaries: response.column_summaries || null,
        },
      });

      dispatch({
        type: ProjectActions.SET_SHOW_IMPORT_WIZARD,
        payload: true,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process missing data');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog>
      {children}
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Handle Missing Data</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Columns to Process</Label>
            <div className="grid gap-2 max-h-40 overflow-y-auto p-2 border rounded-sm">
              {columnNames.length > 0 ? (
                columnNames.map(column => (
                  <div key={column} className="flex items-center space-x-2">
                    <Checkbox
                      id={column}
                      checked={selectedColumns.includes(column)}
                      onCheckedChange={() => handleColumnToggle(column)}
                      disabled={false} // Allow interaction as long as we have columns
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

          <div className="space-y-2">
            <Label>Imputation Method</Label>
            <Select
              onValueChange={(value: MissingDataMethod) => setMethod(value)}
              value={method}
              disabled={!!criticalError}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(MISSING_DATA_METHODS) as [MissingDataMethod, string][]).map(
                  ([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>

          {method === 'custom_value' && (
            <div className="space-y-2">
              <Label>Custom Value</Label>
              <input
                type="text"
                value={customValue}
                onChange={e => setCustomValue(e.target.value)}
                className="w-full p-2 border rounded-sm"
                placeholder="Enter custom value"
                disabled={!!criticalError}
              />
            </div>
          )}

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
            {isLoading ? (
              <LuLoader className="h-4 w-4 animate-spin" />
            ) : (
              'Analyze & Replace Missing Values'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
