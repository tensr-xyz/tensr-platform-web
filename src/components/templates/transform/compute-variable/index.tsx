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
import { useTabs } from '@/contexts/tabs-context';
import { useProject } from '@/contexts/project-context';
import { ProjectActions } from '@/contexts/project-context/types';
import { LuLoader } from 'react-icons/lu';

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
}

interface ComputeVariableMetadata {
  rows: number;
  columns: number;
  column_names: string[];
  preview: any[];
}

interface ComputeVariableResponse {
  success: boolean;
  new_column_name: string;
  rows_affected: number;
  path: string;
  metadata: ComputeVariableMetadata;
  column_summaries?: Record<string, any>;
}

interface ComputeVariablesProps {
  children: ReactNode;
}

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

  const { state: tabState } = useTabs();
  const { dispatch } = useProject();

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

      // Mock the response with proper structure that matches ComputeVariableResponse
      const response: ComputeVariableResponse = {
        success: true,
        new_column_name: newVariableName,
        rows_affected: 0,
        path: 'mocked/path/to/computed_file.csv',
        metadata: {
          rows: 0,
          columns: 0,
          column_names: [],
          preview: [],
        },
        column_summaries: {},
      };

      // The actual API call would be something like:
      // const response = await invoke<ComputeVariableResponse>('compute_variable', {
      //   request,
      // });

      setSuccess(response);

      // Update project state with new data
      dispatch({
        type: ProjectActions.SET_IMPORT_DATA,
        payload: {
          fileName: 'computed_dataset.csv',
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
