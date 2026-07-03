import { ReactNode, useEffect, useState } from 'react';
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
import { RadioGroup, RadioGroupItem } from '@/components/atoms/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/select';
import { useRouter } from 'next/navigation';
import { getAccessToken } from '@/utils/auth';
import { apiClient } from '@/lib/api-client';
import { mergeDatasets } from '@/lib/dataset-data-ops';
import { getDatasetIdFromTab, WORKSPACE_DATASET_REQUIRED } from '@/lib/workspace-dataset';
import { useTabsStore } from '@/stores/tabs-store';
import { Loader2 as Loader } from 'lucide-react';

const MERGE_TYPES = {
  CASES: 'add_cases',
  VARIABLES: 'add_variables',
} as const;

interface MergeDatasetProps {
  children: ReactNode;
}

type MergeType = (typeof MERGE_TYPES)[keyof typeof MERGE_TYPES];

export const MergeDatasetDialog = ({ children }: MergeDatasetProps) => {
  const router = useRouter();
  const token = getAccessToken();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mergeType, setMergeType] = useState<MergeType>(MERGE_TYPES.CASES);
  const [secondaryDataset, setSecondaryDataset] = useState<string>('');
  const [datasetOptions, setDatasetOptions] = useState<{ id: string; name: string }[]>([]);
  const { tabs, activeTabId } = useTabsStore();
  const activeTab = tabs.find(t => t.id === activeTabId);
  const primaryDatasetId = getDatasetIdFromTab(activeTab);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await apiClient.projects.list();
        if (cancelled) return;
        setDatasetOptions(
          rows
            .filter(r => r.id && r.id !== primaryDatasetId)
            .map(r => ({ id: String(r.id), name: String(r.name || r.id) }))
        );
      } catch {
        if (!cancelled) setDatasetOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [primaryDatasetId]);

  const handleMerge = async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!primaryDatasetId) {
        throw new Error(WORKSPACE_DATASET_REQUIRED);
      }
      if (!secondaryDataset) {
        throw new Error('Select a second dataset to merge');
      }

      const response = await mergeDatasets(
        primaryDatasetId,
        {
          secondary_dataset_id: secondaryDataset,
          merge_type: mergeType,
        },
        token
      );

      router.push(
        `/workspace/dataset/${response.dataset_id}?name=${encodeURIComponent(response.original_filename)}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to merge datasets');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
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
                <Label htmlFor="cases">Add cases (stack rows)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value={MERGE_TYPES.VARIABLES} id="variables" />
                <Label htmlFor="variables">Add variables (join columns)</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label>Second dataset</Label>
            <Select value={secondaryDataset} onValueChange={setSecondaryDataset}>
              <SelectTrigger>
                <SelectValue placeholder="Choose dataset" />
              </SelectTrigger>
              <SelectContent>
                {datasetOptions.map(opt => (
                  <SelectItem key={opt.id} value={opt.id}>
                    {opt.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button onClick={handleMerge} disabled={isLoading || !primaryDatasetId}>
            {isLoading ? 'Merging...' : 'Merge Datasets'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
