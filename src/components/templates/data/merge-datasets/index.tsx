import { ReactNode, useState } from 'react';
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
import { RadioGroup, RadioGroupItem } from '@/components/atoms/radio-group';
import { useProject } from '@/contexts/project-context';
import { ProjectActions } from '@/contexts/project-context/types';
import { Loader2 as Loader } from 'lucide-react';

const MERGE_TYPES = {
  CASES: 'add_cases',
  VARIABLES: 'add_variables',
} as const;

interface MergeDatasetProps {
  children: ReactNode;
}

type MergeType = (typeof MERGE_TYPES)[keyof typeof MERGE_TYPES];

interface MergeDatasetRequest {
  primary_path: string;
  secondary_path: string;
  merge_type: MergeType;
}

interface MergeDatasetResponse {
  path: string;
  metadata: {
    rows: number;
    columns: number;
    column_names: string[];
    preview: any[];
  };
  column_summaries?: Record<string, any>;
}

export const MergeDatasetDialog = ({ children }: MergeDatasetProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mergeType, setMergeType] = useState<MergeType>(MERGE_TYPES.CASES);
  const [secondaryDataset, setSecondaryDataset] = useState<string>('');
  const { state, dispatch } = useProject();

  const handleSelectSecondaryDataset = async () => {
    try {
      setError(null);

      // Mock implementation of file dialog
      // In a real implementation, you would use a file dialog API or component
      const mockFileSelectionDialog = async (): Promise<string | null> => {
        // Simulate a file selection dialog
        console.log('Opening file selection dialog...');
        // Return a mock file path
        return '/path/to/selected/secondary_dataset.csv';
      };

      const filePath = await mockFileSelectionDialog();
      if (filePath) {
        setSecondaryDataset(filePath);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select secondary dataset');
    }
  };

  const handleMerge = async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!state.currentProject?.path || !secondaryDataset) {
        throw new Error('Please select both datasets to merge');
      }

      const requestData: MergeDatasetRequest = {
        primary_path: state.currentProject.path,
        secondary_path: secondaryDataset,
        merge_type: mergeType,
      };

      // Create a mock response for type checking until the API is implemented
      const mockColumnsCount = mergeType === MERGE_TYPES.VARIABLES ? 10 : 5;
      const mockRowsCount = mergeType === MERGE_TYPES.CASES ? 20 : 10;

      const mockColumnNames = Array.from({ length: mockColumnsCount }, (_, i) => {
        if (mergeType === MERGE_TYPES.VARIABLES && i >= 5) {
          return `new_var_${i - 4}`;
        }
        return `var_${i + 1}`;
      });

      // Create a mock preview dataset
      const mockPreview = Array.from({ length: 5 }, (_, rowIdx) => {
        const rowData: Record<string, any> = { id: rowIdx + 1 };
        mockColumnNames.forEach((colName, colIdx) => {
          rowData[colName] = `Value ${rowIdx + 1}-${colIdx + 1}`;
        });
        return rowData;
      });

      const mockResponse: MergeDatasetResponse = {
        path: `/path/to/output/merged_dataset_${Date.now()}.csv`,
        metadata: {
          rows: mockRowsCount,
          columns: mockColumnsCount,
          column_names: mockColumnNames,
          preview: mockPreview,
        },
        column_summaries: mockColumnNames.reduce(
          (acc, col, idx) => {
            acc[col] = {
              type: idx % 2 === 0 ? 'numeric' : 'string',
              missing_count: 0,
              unique_count: mockRowsCount,
            };
            return acc;
          },
          {} as Record<string, any>
        ),
      };

      // TODO: Replace with actual API call
      // const response = await fetch('/api/merge-datasets', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({ request: requestData }),
      // });
      // const data: MergeDatasetResponse = await response.json();

      // Using mock response for now
      await new Promise(resolve => setTimeout(resolve, 1200)); // Simulate API delay
      const response = mockResponse;

      dispatch({
        type: ProjectActions.SET_IMPORT_DATA,
        payload: {
          fileName: 'merged_dataset.csv',
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
      setError(err instanceof Error ? err.message : 'Failed to merge datasets');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog>
      {children}
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Merge Datasets</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Merge Type</Label>
            <RadioGroup
              defaultValue={MERGE_TYPES.CASES}
              onValueChange={value => setMergeType(value as MergeType)}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value={MERGE_TYPES.CASES} id="cases" />
                <Label htmlFor="cases">Add Cases (Stack datasets vertically)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value={MERGE_TYPES.VARIABLES} id="variables" />
                <Label htmlFor="variables">Add Variables (Join datasets horizontally)</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label>Secondary Dataset</Label>
            <div className="flex gap-2">
              <Button
                onClick={handleSelectSecondaryDataset}
                variant="outline"
                className="flex-1"
                disabled={isLoading}
              >
                {isLoading ? <Loader className="h-4 w-4 animate-spin" /> : 'Select File'}
              </Button>
              {secondaryDataset && (
                <span className="text-sm text-muted-foreground truncate">
                  {secondaryDataset.split('/').pop()}
                </span>
              )}
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button onClick={handleMerge} disabled={isLoading}>
            {isLoading ? 'Merging...' : 'Merge Datasets'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
