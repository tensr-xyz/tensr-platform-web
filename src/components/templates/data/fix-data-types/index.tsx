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

type DataType = 'string' | 'integer' | 'float' | 'date' | 'boolean' | 'auto';

const DATA_TYPES: Record<DataType, string> = {
  auto: 'Auto-detect',
  string: 'Text',
  integer: 'Integer',
  float: 'Decimal',
  date: 'Date/Time',
  boolean: 'Boolean',
};

interface ColumnTypeConfig {
  name: string;
  targetType: DataType;
  selected: boolean;
}

interface FixDataTypesProps {
  children: ReactNode;
}

interface FixDataTypesRequest {
  path: string;
  columns: {
    name: string;
    target_type: DataType;
  }[];
}

interface FixDataTypesResponse {
  path: string;
  metadata: {
    rows: number;
    columns: number;
    column_names: string[];
    preview: any[];
  };
  column_summaries?: Record<string, any>;
}

export const FixDataTypesDialog = ({ children }: FixDataTypesProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [columnConfigs, setColumnConfigs] = useState<ColumnTypeConfig[]>([]);
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

  // Initialize column configs when active tab changes
  useEffect(() => {
    if (activeTab?.data?.initialData?.[0]) {
      const columns = Object.keys(activeTab.data.initialData[0])
        .filter(key => key !== 'id')
        .map(name => ({
          name,
          targetType: 'auto' as DataType,
          selected: false,
        }));
      setColumnConfigs(columns);
    }
  }, [activeTab?.data?.initialData]);

  const handleColumnToggle = (columnName: string) => {
    setColumnConfigs(prev =>
      prev.map(config =>
        config.name === columnName ? { ...config, selected: !config.selected } : config
      )
    );
  };

  const handleTypeChange = (columnName: string, newType: DataType) => {
    setColumnConfigs(prev =>
      prev.map(config =>
        config.name === columnName ? { ...config, targetType: newType, selected: true } : config
      )
    );
  };

  const handleFixTypes = async () => {
    try {
      if (!activeTab?.data?.filePath) {
        setError('File path not available');
        return;
      }

      const selectedConfigs = columnConfigs.filter(config => config.selected);
      if (selectedConfigs.length === 0) {
        setError('Please select at least one column');
        return;
      }

      setIsLoading(true);
      setError(null);

      const requestData: FixDataTypesRequest = {
        path: activeTab.data.filePath,
        columns: selectedConfigs.map(config => ({
          name: config.name,
          target_type: config.targetType,
        })),
      };

      // Create mock response for type checking until the API is implemented
      const mockResponse: FixDataTypesResponse = {
        path: activeTab.data.filePath.replace('.csv', '_processed.csv'),
        metadata: {
          rows: activeTab.data.initialData?.length || 0,
          columns: columnConfigs.length,
          column_names: columnConfigs.map(col => col.name),
          preview: activeTab.data.initialData?.slice(0, 5) || [],
        },
        column_summaries: columnConfigs.reduce(
          (acc, col) => {
            acc[col.name] = {
              type: col.selected ? col.targetType : 'auto',
              valid_count: activeTab.data.initialData?.length || 0,
              missing_count: 0,
            };
            return acc;
          },
          {} as Record<string, any>
        ),
      };

      // TODO: Replace with actual API call when implemented
      // const response = await fetch('/api/fix-data-types', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({ request: requestData }),
      // });
      // const data: FixDataTypesResponse = await response.json();

      // Using mock response for now
      await new Promise(resolve => setTimeout(resolve, 800)); // Simulate API delay
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
      setError(err instanceof Error ? err.message : 'Failed to fix data types');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog>
      {children}
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Fix Data Types</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Select Columns and Target Types</Label>
            <div className="grid gap-2 max-h-64 overflow-y-auto p-2 border rounded-sm">
              {columnConfigs.map(column => (
                <div key={column.name} className="flex items-center gap-2">
                  <Checkbox
                    id={column.name}
                    checked={column.selected}
                    onCheckedChange={() => handleColumnToggle(column.name)}
                    disabled={false}
                  />
                  <Label htmlFor={column.name} className="w-32 truncate">
                    {column.name}
                  </Label>
                  <Select
                    value={column.targetType}
                    onValueChange={(value: DataType) => handleTypeChange(column.name, value)}
                    disabled={!column.selected}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.entries(DATA_TYPES) as [DataType, string][]).map(
                        ([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>
              ))}
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
          <Button onClick={handleFixTypes} disabled={isLoading || !!criticalError}>
            {isLoading ? <LuLoader className="h-4 w-4 animate-spin" /> : 'Fix Data Types'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
