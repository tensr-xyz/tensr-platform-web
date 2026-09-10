'use client';

import { ReactNode, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/molecules/dialog';
import { Alert, AlertDescription } from '@/components/atoms/alert';
import { Button } from '@/components/atoms/button';
import { Label } from '@/components/atoms/label';
import { Checkbox } from '@/components/atoms/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/select';
import { useRouter } from 'next/navigation';
import { Loader2 as Loader } from 'lucide-react';
import { getStytchBearerForTensrApi } from '@/utils/auth';
import { handleDatasetOutliers } from '@/lib/dataset-data-ops';
import { formatApiErrorMessage } from '@/lib/api-error';
import { resolveWorkspaceDatasetId, WORKSPACE_DATASET_REQUIRED } from '@/lib/workspace-dataset';
import { useTabsStore } from '@/stores/tabs-store';
import { useProjectStore } from '@/stores/project-store';

type OutlierMethod = 'cap' | 'remove' | 'flag';

const METHODS: Record<OutlierMethod, string> = {
  cap: 'Cap (winsorize to IQR bounds)',
  remove: 'Remove outlier rows',
  flag: 'Flag with *_outlier columns',
};

export function HandleOutliersDialog({ children }: { children: ReactNode }) {
  const router = useRouter();
  const token = getStytchBearerForTensrApi();
  const { tabs, activeTabId } = useTabsStore();
  const fileSystem = useProjectStore(s => s.fileSystem);
  const currentProject = useProjectStore(s => s.currentProject);
  const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId), [tabs, activeTabId]);
  const datasetId = resolveWorkspaceDatasetId({
    tab: activeTab,
    projectId: currentProject?.id,
    fileSystem,
  });

  const columnNames = useMemo(() => {
    if (!activeTab?.data?.initialData?.[0]) return [];
    return Object.keys(activeTab.data.initialData[0]).filter(k => k !== 'id');
  }, [activeTab?.data?.initialData]);

  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [method, setMethod] = useState<OutlierMethod>('cap');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const criticalError = !activeTab
    ? 'Please open a dataset first'
    : !datasetId
      ? WORKSPACE_DATASET_REQUIRED
      : null;

  const toggle = (col: string) => {
    setSelectedColumns(prev => (prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]));
  };

  const run = async () => {
    if (!datasetId) {
      setError(WORKSPACE_DATASET_REQUIRED);
      return;
    }
    if (selectedColumns.length === 0) {
      setError('Select at least one column');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await handleDatasetOutliers(
        datasetId,
        { columns: selectedColumns, method },
        token
      );
      router.push(
        `/workspace/dataset/${response.dataset_id}?name=${encodeURIComponent(response.original_filename)}`
      );
    } catch (err) {
      setError(formatApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Handle Outliers</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Columns</Label>
            <div className="grid max-h-40 gap-2 overflow-y-auto rounded-sm border p-2">
              {columnNames.length ? (
                columnNames.map(col => (
                  <div key={col} className="flex items-center space-x-2">
                    <Checkbox
                      id={`handle-out-${col}`}
                      checked={selectedColumns.includes(col)}
                      onCheckedChange={() => toggle(col)}
                    />
                    <Label htmlFor={`handle-out-${col}`} className="cursor-pointer">
                      {col}
                    </Label>
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground">No columns available</div>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Method</Label>
            <Select
              value={method}
              onValueChange={(v: OutlierMethod) => setMethod(v)}
              disabled={!!criticalError}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(METHODS) as [OutlierMethod, string][]).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
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
          <Button onClick={() => void run()} disabled={busy || !!criticalError}>
            {busy ? <Loader className="h-4 w-4 animate-spin" /> : 'Handle Outliers'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
