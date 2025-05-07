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
import { useTabs } from '@/contexts/tabs-context';
import { ProjectActions } from '@/contexts/project-context/types';
import { LuLoader } from 'react-icons/lu';

type StandardizationMethod =
  | 'z_score'
  | 'min_max'
  | 'decimal_scaling'
  | 'mean_normalization'
  | 'robust_scaling';

const STANDARDIZATION_METHODS: Record<StandardizationMethod, string> = {
  z_score: 'Z-Score ((x - mean) / std)',
  min_max: 'Min-Max Scaling (0-1)',
  decimal_scaling: 'Decimal Scaling',
  mean_normalization: 'Mean Normalization',
  robust_scaling: 'Robust Scaling (IQR)',
};

interface StandardizeValuesProps {
  children: ReactNode;
}

export const StandardizeValuesDialog = ({ children }: StandardizeValuesProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<StandardizationMethod>('z_score');
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [createNewColumns, setCreateNewColumns] = useState(true);
  const { state: tabState } = useTabs();
  const { dispatch } = useProject();

  const activeTab = useMemo(
    () => tabState.tabs.find(tab => tab.id === tabState.activeTabId),
    [tabState.tabs, tabState.activeTabId]
  );

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

    // Helper to check if a column appears to be numeric
    const isNumericColumn = (values: any[]) => {
      const sampleSize = Math.min(5, values.length);
      const sample = values.slice(0, sampleSize);
      return sample.some(v => !isNaN(Number(v)) && v !== '' && v !== null);
    };

    // Get column names and their values
    const columnData = Object.keys(activeTab.data.initialData[0])
      .filter(key => key !== 'id')
      .reduce(
        (acc, key) => {
          acc[key] = activeTab.data.initialData.map((row: { [x: string]: any }) => row[key]);
          return acc;
        },
        {} as Record<string, any[]>
      );

    // Filter for numeric columns
    const cols = Object.entries(columnData)
      .filter(([_, values]) => isNumericColumn(values))
      .map(([key]) => key);

    return cols;
  }, [activeTab?.data?.initialData]);

  const handleColumnToggle = (column: string) => {
    setSelectedColumns(prev =>
      prev.includes(column) ? prev.filter(c => c !== column) : [...prev, column]
    );
  };

  const handleStandardize = async () => {
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

      // Define a mock response with the appropriate structure
      const response = {
        path: 'mocked/path/to/standardized_file.csv',
        metadata: {
          preview: [],
          column_names: [],
          rows: 0,
          columns: 0,
        },
        column_summaries: {},
      };

      // The actual API call would be something like:
      // const response = await invoke<any>('standardize_values', {
      //   request: {
      //     path: activeTab.data.filePath,
      //     columns: selectedColumns,
      //     method,
      //     create_new_columns: createNewColumns,
      //   },
      // });

      dispatch({
        type: ProjectActions.SET_IMPORT_DATA,
        payload: {
          fileName: 'standardized_dataset.csv',
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
      setError(err instanceof Error ? err.message : 'Failed to standardize values');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog>
      {children}
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Standardize Values</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Numeric Columns to Standardize</Label>
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
                <div className="text-sm text-gray-500">No numeric columns available</div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Standardization Method</Label>
            <Select
              onValueChange={(value: StandardizationMethod) => setMethod(value)}
              value={method}
              disabled={!!criticalError}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(STANDARDIZATION_METHODS) as [StandardizationMethod, string][]).map(
                  ([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="createNewColumns"
              checked={createNewColumns}
              onCheckedChange={checked => setCreateNewColumns(checked as boolean)}
            />
            <Label htmlFor="createNewColumns">
              Create new columns (append &apos;_standardized&apos; to column names)
            </Label>
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
          <Button onClick={handleStandardize} disabled={isLoading || !!criticalError}>
            {isLoading ? <LuLoader className="h-4 w-4 animate-spin" /> : 'Standardize Values'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default StandardizeValuesDialog;
