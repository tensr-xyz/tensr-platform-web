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
import { LuLoader } from 'react-icons/lu';

const MERGE_TYPES = {
  CASES: 'add_cases',
  VARIABLES: 'add_variables',
} as const;

interface MergeDatasetProps {
  children: ReactNode;
}

export const MergeDatasetDialog = ({ children }: MergeDatasetProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mergeType, setMergeType] = useState<(typeof MERGE_TYPES)[keyof typeof MERGE_TYPES]>(
    MERGE_TYPES.CASES
  );
  const [secondaryDataset, setSecondaryDataset] = useState<string>('');
  const { state, dispatch } = useProject();

  const handleSelectSecondaryDataset = async () => {
    try {
      setError(null);
      const filePath = await invoke<string | null>('open_file_dialog');
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

      const response = await invoke<any>('merge_datasets', {
        request: {
          primary_path: state.currentProject.path,
          secondary_path: secondaryDataset,
          merge_type: mergeType,
        },
      });

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
              onValueChange={value =>
                setMergeType(value as (typeof MERGE_TYPES)[keyof typeof MERGE_TYPES])
              }
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
                {isLoading ? <LuLoader className="h-4 w-4 animate-spin" /> : 'Select File'}
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
