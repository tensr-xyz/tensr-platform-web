import { ReactNode, useState, useMemo, useCallback } from 'react';
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
import { useProject } from '@/contexts/project-context';
import { LuLoader } from 'react-icons/lu';
import useAuth from '@/hooks/api/use-auth';

const COMPUTATION_TYPES = {
  arithmetic: 'arithmetic',
  aggregation: 'aggregation',
  conditional: 'conditional',
  transform: 'transform',
} as const;

type ComputationType = (typeof COMPUTATION_TYPES)[keyof typeof COMPUTATION_TYPES];

const OPERATIONS = {
  arithmetic: [
    { value: 'add', label: 'Add' },
    { value: 'subtract', label: 'Subtract' },
    { value: 'multiply', label: 'Multiply' },
    { value: 'divide', label: 'Divide' },
  ],
  aggregation: [
    { value: 'sum', label: 'Sum' },
    { value: 'mean', label: 'Mean' },
    { value: 'median', label: 'Median' },
    { value: 'min', label: 'Minimum' },
    { value: 'max', label: 'Maximum' },
  ],
  transform: [
    { value: 'log', label: 'Logarithm' },
    { value: 'sqrt', label: 'Square Root' },
    { value: 'square', label: 'Square' },
    { value: 'abs', label: 'Absolute Value' },
  ],
  conditional: [
    { value: 'if_then', label: 'If-Then' },
    { value: 'case_when', label: 'Case When' },
  ],
} as const;

interface ComputeVariableRequest {
  path: string;
  new_variable_name: string;
  computation_type: ComputationType;
  source_columns: string[];
  operation: string;
  constant?: number;
  token?: string;
}

interface ComputeVariableResponse {
  success: boolean;
  new_column_name: string;
  new_column_values: string[];
  column_info: any;
  rows_affected: number;
  column_type: string;
}

interface ColumnInfo {
  name: string;
  data_type: string;
  numeric_stats?: any;
  categorical_stats?: any;
}

interface ComputeVariablesProps {
  children: ReactNode;
}

// API base URL
const API_BASE_URL = process.env.NEXT_PUBLIC_FARGATE_API_URL;

export const ComputeVariablesDialog = ({ children }: ComputeVariablesProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<ComputeVariableResponse | null>(null);
  const [newVariableName, setNewVariableName] = useState('');
  const [computationType, setComputationType] = useState<ComputationType>(
    COMPUTATION_TYPES.arithmetic
  );
  const [operation, setOperation] = useState('');
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [constant, setConstant] = useState<string>('');

  const { tabs, activeTabId, updateTab } = useTabsStore();
  const { tokens } = useAuth();
  const { dispatch: projectDispatch } = useProject();

  const token = tokens?.accessToken;

  const activeTab = useMemo(() => tabs.find(tab => tab.id === activeTabId), [tabs, activeTabId]);

  const columnNames = useMemo(() => {
    if (!activeTab?.data?.initialData?.[0]) {
      return [];
    }
    const cols = Object.keys(activeTab.data.initialData[0]).filter(key => key !== 'id');
    return cols;
  }, [activeTab?.data?.initialData]);

  const criticalError = useMemo(() => {
    if (!activeTab) return 'Please open a dataset first';
    if (!activeTab.data?.initialData) return 'No data available';
    if (!activeTab.data?.filePath) return 'No file path available';
    return null;
  }, [activeTab]);

  const handleColumnSelect = (column: string) => {
    setSelectedColumns(prev =>
      prev.includes(column) ? prev.filter(c => c !== column) : [...prev, column]
    );
  };

  const validateInput = () => {
    if (!newVariableName) return 'Please enter a name for the new variable';
    if (!computationType) return 'Please select a computation type';
    if (!operation) return 'Please select an operation';
    if (selectedColumns.length === 0) return 'Please select at least one column';
    if (
      computationType === COMPUTATION_TYPES.arithmetic &&
      !constant &&
      selectedColumns.length === 1
    ) {
      return 'Please enter a constant value or select another column';
    }
    return null;
  };

  const handleCompute = async () => {
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

      const request: ComputeVariableRequest = {
        path: activeTab.data.filePath,
        new_variable_name: newVariableName,
        computation_type: computationType,
        source_columns: selectedColumns,
        operation: operation,
        constant: constant ? parseFloat(constant) : undefined,
      };

      // Call the actual API endpoint
      const response = await fetch(`${API_BASE_URL}/api/transform/compute-variable`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || 'Failed to compute variable');
      }

      const data: ComputeVariableResponse = await response.json();
      setSuccess(data);

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
      setNewVariableName('');
      setSelectedColumns([]);
      setConstant('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to compute variable');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog>
      {children}
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Compute Variables</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-variable">New Variable Name</Label>
            <Input
              id="new-variable"
              value={newVariableName}
              onChange={e => setNewVariableName(e.target.value)}
              placeholder="Enter new variable name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="computation-type">Computation Type</Label>
            <Select
              value={computationType}
              onValueChange={(value: ComputationType) => {
                setComputationType(value);
                setOperation('');
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select computation type" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(COMPUTATION_TYPES).map(([key, value]) => (
                  <SelectItem key={value} value={value}>
                    {key.charAt(0).toUpperCase() + key.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="operation">Operation</Label>
            <Select value={operation} onValueChange={setOperation} disabled={!computationType}>
              <SelectTrigger>
                <SelectValue placeholder="Select operation" />
              </SelectTrigger>
              <SelectContent>
                {OPERATIONS[computationType]?.map(op => (
                  <SelectItem key={op.value} value={op.value}>
                    {op.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Source Columns</Label>
            <div className="grid gap-2 max-h-40 overflow-y-auto p-2 border rounded-sm">
              {columnNames.map(column => (
                <div key={column} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={`col-${column}`}
                    checked={selectedColumns.includes(column)}
                    onChange={() => handleColumnSelect(column)}
                    className="rounded-sm border-gray-300"
                  />
                  <Label htmlFor={`col-${column}`} className="cursor-pointer">
                    {column}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {computationType === COMPUTATION_TYPES.arithmetic && (
            <div className="space-y-2">
              <Label htmlFor="constant">Constant Value (Optional)</Label>
              <Input
                id="constant"
                type="number"
                value={constant}
                onChange={e => setConstant(e.target.value)}
                placeholder="Enter a constant value"
              />
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert>
              <AlertDescription>
                Successfully created new variable &apos;{success.new_column_name}&apos; (
                {success.rows_affected} rows affected)
              </AlertDescription>
            </Alert>
          )}

          <div className="text-sm text-gray-500">
            File: {activeTab?.data?.filePath || 'No file selected'}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleCompute} disabled={isLoading || !!criticalError}>
            {isLoading ? <LuLoader className="h-4 w-4 animate-spin" /> : 'Compute Variable'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ComputeVariablesDialog;
