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
import { useTabs } from '@/contexts/tabs-context';
import { LuLoader } from 'react-icons/lu';
import useAuth from '@/hooks/api/use-auth';
import { updateTab } from '@/contexts/tabs-context/actions';
import { ColumnSummary } from '@/types/file';

// API base URL
const API_BASE_URL = process.env.NEXT_PUBLIC_FARGATE_API_URL;

interface ValueToCount {
  type_: 'single' | 'range' | 'sysmis'; // Changed from 'type' to 'type_' to match Rust
  value1?: string; // For single values or range start
  value2?: string; // For range end
}

interface CountValuesRequest {
  path: string;
  target_variable: string;
  source_variables: string[];
  values_to_count: ValueToCount[];
  token?: string;
}

interface CountValuesResponse {
  success: boolean;
  new_column_name: string;
  new_column_values: string[];
  column_info: ColumnSummary;
  rows_affected: number;
  column_type: string;
}

interface CountValuesDialogProps {
  children: ReactNode;
}

export const CountValuesDialog = ({ children }: CountValuesDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<CountValuesResponse | null>(null);
  const [targetVariable, setTargetVariable] = useState('');
  const [sourceVariables, setSourceVariables] = useState<string[]>([]);
  const [valuesToCount, setValuesToCount] = useState<ValueToCount[]>([]);

  const { state: tabState, dispatch: tabDispatch } = useTabs();
  const { tokens } = useAuth();

  const token = tokens?.accessToken;

  const activeTab = useMemo(
    () => tabState.tabs.find(tab => tab.id === tabState.activeTabId),
    [tabState.tabs, tabState.activeTabId]
  );

  const columnNames = useMemo(() => {
    if (!activeTab?.data?.initialData?.[0]) {
      return [];
    }
    const cols = Object.keys(activeTab.data.initialData[0]).filter(key => key !== 'id');
    return cols;
  }, [activeTab?.data?.initialData]);

  const handleVariableSelect = (variable: string) => {
    setSourceVariables(prev =>
      prev.includes(variable) ? prev.filter(v => v !== variable) : [...prev, variable]
    );
  };

  const addValueToCount = (type_: 'single' | 'range' | 'sysmis') => {
    const newValue: ValueToCount = { type_ }; // Changed from type to type_
    if (type_ !== 'sysmis') {
      newValue.value1 = '';
      if (type_ === 'range') {
        newValue.value2 = '';
      }
    }
    setValuesToCount(prev => [...prev, newValue]);
  };

  const updateValueToCount = (index: number, field: 'value1' | 'value2', value: string) => {
    setValuesToCount(prev =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const removeValueToCount = (index: number) => {
    setValuesToCount(prev => prev.filter((_, i) => i !== index));
  };

  const validateInput = () => {
    if (!targetVariable) return 'Please enter a target variable name';
    if (sourceVariables.length === 0) return 'Please select at least one source variable';
    if (valuesToCount.length === 0) return 'Please specify at least one value to count';

    // Validate all value entries are complete
    const incompleteValue = valuesToCount.find(v => {
      if (v.type_ === 'single' && !v.value1) return true;
      if (v.type_ === 'range' && (!v.value1 || !v.value2)) return true;
      return false;
    });

    if (incompleteValue) return 'Please complete all value entries';
    return null;
  };

  const handleCount = async () => {
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

      const request: CountValuesRequest = {
        path: activeTab.data.filePath,
        target_variable: targetVariable,
        source_variables: sourceVariables,
        values_to_count: valuesToCount,
      };

      // Call the API endpoint
      const response = await fetch(`${API_BASE_URL}/api/transform/count-values`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || 'Failed to count values');
      }

      // Get the response data - now a CountValuesResponse instead of ProcessedDataResponse
      const data: CountValuesResponse = await response.json();
      setSuccess(data); // You might want to update your success state type

      if (!activeTab.data.initialData) {
        throw new Error('No data available in the current tab');
      }

      // Update the current tab's data with the new column
      const updatedData = [...activeTab.data.initialData];

      // Add the new column values to each row of data
      for (let i = 0; i < updatedData.length; i++) {
        if (i < data.new_column_values.length) {
          const value = data.new_column_values[i];
          // Convert value based on column type
          let parsedValue: any = value;
          if (data.column_type === 'Float64' && value !== 'null') {
            parsedValue = parseFloat(value);
          } else if (data.column_type === 'Int64' && value !== 'null') {
            parsedValue = parseInt(value, 10);
          } else if (value === 'null') {
            parsedValue = null;
          }

          updatedData[i][data.new_column_name] = parsedValue;
        }
      }

      // Create a new column definition
      const newColumn = {
        id: data.new_column_name,
        accessor: data.new_column_name,
        header: data.new_column_name,
        width: 150,
        type: data.column_type.toLowerCase().includes('float')
          ? 'number'
          : data.column_type.toLowerCase().includes('int')
            ? 'number'
            : 'string',
      };

      // Update the tab with new data and columns
      const updatedColumns = [...(activeTab.data.initialColumns || []), newColumn];

      // Update stats with the new column info
      const updatedStats = {
        ...(activeTab.data.columnStats || {}),
        [data.new_column_name]: data.column_info,
      };

      // Update the tab with the new data
      tabDispatch(
        updateTab(activeTab.id, {
          data: {
            ...activeTab.data,
            initialData: updatedData,
            initialColumns: updatedColumns,
            columnStats: updatedStats,
            totalColumns: (activeTab.data.totalColumns || 0) + 1,
          },
        })
      );

      // Reset form
      setTargetVariable('');
      setSourceVariables([]);
      setValuesToCount([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to count values');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog>
      {children}
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Count Values</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Target Variable */}
          <div className="space-y-2">
            <Label htmlFor="target-variable">Target Variable</Label>
            <Input
              id="target-variable"
              value={targetVariable}
              onChange={e => setTargetVariable(e.target.value)}
              placeholder="Enter target variable name"
            />
          </div>

          {/* Source Variables */}
          <div className="space-y-2">
            <Label>Variables to Search Through</Label>
            <div className="grid gap-2 max-h-40 overflow-y-auto p-2 border rounded-sm">
              {columnNames.map(variable => (
                <div key={variable} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={`var-${variable}`}
                    checked={sourceVariables.includes(variable)}
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

          {/* Values to Count */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label>Values to Count</Label>
              <div className="space-x-2">
                <Button variant="outline" size="sm" onClick={() => addValueToCount('single')}>
                  Add Single Value
                </Button>
                <Button variant="outline" size="sm" onClick={() => addValueToCount('range')}>
                  Add Range
                </Button>
                <Button variant="outline" size="sm" onClick={() => addValueToCount('sysmis')}>
                  Add SYSMIS
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              {valuesToCount.map((value, index) => (
                <div key={index} className="flex gap-2 items-center">
                  {value.type_ === 'single' && (
                    <Input
                      value={value.value1 || ''}
                      onChange={e => updateValueToCount(index, 'value1', e.target.value)}
                      placeholder="Enter value"
                      className="w-[200px]"
                    />
                  )}
                  {value.type_ === 'range' && (
                    <>
                      <Input
                        value={value.value1 || ''}
                        onChange={e => updateValueToCount(index, 'value1', e.target.value)}
                        placeholder="From"
                        className="w-[150px]"
                      />
                      <span>through</span>
                      <Input
                        value={value.value2 || ''}
                        onChange={e => updateValueToCount(index, 'value2', e.target.value)}
                        placeholder="To"
                        className="w-[150px]"
                      />
                    </>
                  )}
                  {value.type_ === 'sysmis' && (
                    <span className="text-sm text-gray-600">System-missing value (SYSMIS)</span>
                  )}
                  <Button variant="destructive" size="sm" onClick={() => removeValueToCount(index)}>
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert variant="default">
              <AlertDescription>
                Successfully created target variable &apos;{targetVariable}&apos;
              </AlertDescription>
            </Alert>
          )}

          <div className="text-sm text-gray-500">
            File: {activeTab?.data?.filePath || 'No file selected'}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleCount} disabled={isLoading || !activeTab?.data?.filePath}>
            {isLoading ? <LuLoader className="h-4 w-4 animate-spin" /> : 'Count Values'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CountValuesDialog;
