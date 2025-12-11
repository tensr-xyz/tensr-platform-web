import { ReactNode, useState, useMemo } from 'react';
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
import { Input } from '@/components/atoms/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/select';
import { useTabsStore } from '@/stores/tabs-store';
import { Loader2 as Loader } from 'lucide-react';
import { ColumnSummary } from '@/types/file';
import useAuth from '@/hooks/api/use-auth';

type ShiftDirection = 'previous' | 'next';
type MissingValueHandling = 'sysmis' | 'value' | 'preserve';

const API_BASE_URL = process.env.NEXT_PUBLIC_FARGATE_API_URL;

interface ShiftValuesRequest {
  path: string;
  variables: string[];
  direction: ShiftDirection;
  units: number;
  missing_value_handling: MissingValueHandling;
  custom_missing_value?: number;
}

interface ShiftValuesResponse {
  success: boolean;
  updated_columns: Record<string, string[]>; // Map of column name to shifted values
  column_infos: Record<string, ColumnSummary>; // Map of column name to column summary
  rows_affected: number;
  column_types: Record<string, string>; // Map of column name to type
}

interface ShiftValuesDialogProps {
  children: ReactNode;
}

export const ShiftValuesDialog = ({ children }: ShiftValuesDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<ShiftValuesResponse | null>(null);

  // Shift configuration state
  const [selectedVariables, setSelectedVariables] = useState<string[]>([]);
  const [direction, setDirection] = useState<ShiftDirection>('previous');
  const [units, setUnits] = useState<number>(1);
  const [missingValueHandling, setMissingValueHandling] = useState<MissingValueHandling>('sysmis');
  const [customMissingValue, setCustomMissingValue] = useState<string>('');

  const { tabs, activeTabId, updateTab } = useTabsStore();
  // Removed tokens - using getIdToken() directly
  const { session } = useAuth();

  const token = session?.sessionJwt || null;

  const activeTab = useMemo(() => tabs.find(tab => tab.id === activeTabId), [tabs, activeTabId]);

  const columnNames = useMemo(() => {
    if (!activeTab?.data?.initialData?.[0]) {
      return [];
    }
    const cols = Object.keys(activeTab.data.initialData[0]).filter(key => key !== 'id');
    return cols;
  }, [activeTab?.data?.initialData]);

  const handleVariableSelect = (variable: string) => {
    setSelectedVariables(prev =>
      prev.includes(variable) ? prev.filter(v => v !== variable) : [...prev, variable]
    );
  };

  const validateInput = () => {
    if (selectedVariables.length === 0) return 'Please select at least one variable';
    if (units < 1) return 'Units must be greater than 0';
    if (missingValueHandling === 'value' && !customMissingValue) {
      return 'Please specify a custom value for missing values';
    }
    return null;
  };

  const handleShift = async () => {
    const validationError = validateInput();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!activeTab?.data?.filePath) {
      setError('File path not available');
      return;
    }

    if (!activeTab.id) {
      setError('No active tab found');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setSuccess(null);

      const request: ShiftValuesRequest = {
        path: activeTab.data.filePath,
        variables: selectedVariables,
        direction,
        units,
        missing_value_handling: missingValueHandling,
        custom_missing_value:
          missingValueHandling === 'value' ? parseFloat(customMissingValue) : undefined,
      };

      // Call the API endpoint
      const response = await fetch(`${API_BASE_URL}/api/transform/shift-values`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || 'Failed to shift values');
      }

      // Get the response data - now a ShiftValuesResponse
      const data: ShiftValuesResponse = await response.json();
      setSuccess(data);

      if (!activeTab.data.initialData) {
        throw new Error('No data available in the current tab');
      }

      // Update the current tab's data with the shifted columns
      const updatedData = [...activeTab.data.initialData];

      // For each shifted column, update the values
      for (const columnName of Object.keys(data.updated_columns)) {
        const columnValues = data.updated_columns[columnName];
        const columnType = data.column_types[columnName];

        // Add the shifted values to each row
        for (let i = 0; i < updatedData.length; i++) {
          if (i < columnValues.length) {
            const value = columnValues[i];
            // Convert value based on column type
            let parsedValue: any = value;
            if (columnType === 'Float64' && value !== 'null') {
              parsedValue = parseFloat(value);
            } else if (columnType === 'Int64' && value !== 'null') {
              parsedValue = parseInt(value, 10);
            } else if (value === 'null') {
              parsedValue = null;
            }

            updatedData[i][columnName] = parsedValue;
          }
        }
      }

      // Update stats with the new column info
      const updatedStats = {
        ...(activeTab.data.columnStats || {}),
      };

      // Add stats for each updated column
      for (const [columnName, columnInfo] of Object.entries(data.column_infos)) {
        updatedStats[columnName] = columnInfo;
      }

      // Update the tab with the new data
      updateTab(activeTab.id, {
        data: {
          ...activeTab.data,
          initialData: updatedData,
          columnStats: updatedStats,
        },
      });

      // Reset form after successful operation
      setSelectedVariables([]);
      setDirection('previous');
      setUnits(1);
      setMissingValueHandling('sysmis');
      setCustomMissingValue('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to shift values');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog>
      {children}
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Shift Values</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Variables Selection */}
          <div className="space-y-2">
            <Label>Variables to Shift</Label>
            <div className="grid gap-2 max-h-40 overflow-y-auto p-2 border rounded-sm">
              {columnNames.map(variable => (
                <div key={variable} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={`var-${variable}`}
                    checked={selectedVariables.includes(variable)}
                    onChange={() => handleVariableSelect(variable)}
                    className="rounded-sm border-gray-300"
                  />
                  <Label htmlFor={`var-${variable}`} className="cursor-pointer">
                    {variable}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Shift Direction */}
          <div className="space-y-2">
            <Label htmlFor="direction">Shift Direction</Label>
            <Select
              value={direction}
              onValueChange={(value: ShiftDirection) => setDirection(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select shift direction" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="previous">Previous Value (Lag)</SelectItem>
                <SelectItem value="next">Next Value (Lead)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Units */}
          <div className="space-y-2">
            <Label htmlFor="units">Number of Units</Label>
            <Input
              id="units"
              type="number"
              min="1"
              value={units}
              onChange={e => setUnits(parseInt(e.target.value) || 1)}
            />
          </div>

          {/* Missing Value Handling */}
          <div className="space-y-2">
            <Label htmlFor="missing-handling">Missing Value Handling</Label>
            <Select
              value={missingValueHandling}
              onValueChange={(value: MissingValueHandling) => setMissingValueHandling(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select how to handle missing values" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sysmis">System-Missing</SelectItem>
                <SelectItem value="value">Custom Value</SelectItem>
                <SelectItem value="preserve">Preserve Original Values</SelectItem>
              </SelectContent>
            </Select>

            {missingValueHandling === 'value' && (
              <Input
                type="number"
                value={customMissingValue}
                onChange={e => setCustomMissingValue(e.target.value)}
                placeholder="Enter value for missing data"
                className="mt-2"
              />
            )}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert variant="default">
              <AlertDescription>
                Successfully shifted values in {selectedVariables.length} variable(s) (
                {success.rows_affected} rows affected)
              </AlertDescription>
            </Alert>
          )}

          <div className="text-sm text-gray-500">
            File: {activeTab?.data?.filePath || 'No file selected'}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleShift} disabled={isLoading || !activeTab?.data?.filePath}>
            {isLoading ? <Loader className="h-4 w-4 animate-spin" /> : 'Shift Values'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ShiftValuesDialog;
