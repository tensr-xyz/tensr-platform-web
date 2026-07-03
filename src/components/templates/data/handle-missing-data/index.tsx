import { ReactNode, useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
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
import { useRouter } from 'next/navigation';
import { getAccessToken } from '@/utils/auth';
import { imputeDatasetMissing } from '@/lib/dataset-data-ops';
import { getDatasetIdFromTab, WORKSPACE_DATASET_REQUIRED } from '@/lib/workspace-dataset';
import { useTabsStore } from '@/stores/tabs-store';
import { Loader2 as Loader } from 'lucide-react';

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

export const HandleMissingDataDialog = ({ children }: HandleMissingDataProps) => {
  const router = useRouter();
  const token = getAccessToken();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<MissingDataMethod>('series_mean');
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [customValue, setCustomValue] = useState<string>('');
  const { tabs, activeTabId } = useTabsStore();

  const activeTab = useMemo(() => tabs.find(tab => tab.id === activeTabId), [tabs, activeTabId]);
  const datasetId = getDatasetIdFromTab(activeTab);

  const criticalError = useMemo(() => {
    if (!activeTab) return 'Please open a dataset first';
    if (!activeTab.data?.initialData) return 'No data available';
    if (!datasetId) return WORKSPACE_DATASET_REQUIRED;
    return null;
  }, [activeTab, datasetId]);

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
      if (!datasetId) {
        setError(WORKSPACE_DATASET_REQUIRED);
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

      const response = await imputeDatasetMissing(
        datasetId,
        {
          columns: selectedColumns,
          method,
          custom_value: method === 'custom_value' ? customValue : null,
        },
        token
      );

      router.push(
        `/workspace/dataset/${response.dataset_id}?name=${encodeURIComponent(response.original_filename)}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process missing data');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
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
        </div>

        <DialogFooter>
          <Button onClick={handleAnalyze} disabled={isLoading || !!criticalError}>
            {isLoading ? (
              <Loader className="h-4 w-4 animate-spin" />
            ) : (
              'Analyze & Replace Missing Values'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
