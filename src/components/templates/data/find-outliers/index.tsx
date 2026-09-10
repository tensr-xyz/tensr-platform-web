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
import { Loader2 as Loader } from 'lucide-react';
import { getStytchBearerForTensrApi } from '@/utils/auth';
import { findDatasetOutliers } from '@/lib/dataset-data-ops';
import { formatApiErrorMessage } from '@/lib/api-error';
import { resolveWorkspaceDatasetId, WORKSPACE_DATASET_REQUIRED } from '@/lib/workspace-dataset';
import { useTabsStore } from '@/stores/tabs-store';
import { useProjectStore } from '@/stores/project-store';

type FindOutliersResult = {
  n_rows: number;
  total_flagged_rows: number;
  columns: Array<{
    column: string;
    outlier_count: number;
    pct_of_rows: number;
    lower_bound: number;
    upper_bound: number;
  }>;
};

export function FindOutliersDialog({ children }: { children: ReactNode }) {
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
  const [result, setResult] = useState<FindOutliersResult | null>(null);
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
    setResult(null);
    try {
      const res = (await findDatasetOutliers(
        datasetId,
        { columns: selectedColumns },
        token
      )) as FindOutliersResult;
      setResult(res);
    } catch (err) {
      setError(formatApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Find Outliers</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Columns</Label>
            <div className="grid max-h-40 gap-2 overflow-y-auto rounded-sm border p-2">
              {columnNames.length ? (
                columnNames.map(col => (
                  <div key={col} className="flex items-center space-x-2">
                    <Checkbox
                      id={`find-out-${col}`}
                      checked={selectedColumns.includes(col)}
                      onCheckedChange={() => toggle(col)}
                    />
                    <Label htmlFor={`find-out-${col}`} className="cursor-pointer">
                      {col}
                    </Label>
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground">No columns available</div>
              )}
            </div>
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {result && (
            <div className="max-h-48 space-y-2 overflow-y-auto text-sm">
              <p>
                Flagged {result.total_flagged_rows} of {result.n_rows} rows (IQR rule).
              </p>
              {result.columns.map(c => (
                <div key={c.column} className="rounded border p-2 text-xs">
                  <strong>{c.column}</strong>: {c.outlier_count} outliers ({c.pct_of_rows}%) ·
                  bounds [{c.lower_bound.toFixed(2)}, {c.upper_bound.toFixed(2)}]
                </div>
              ))}
              {!result.columns.length && (
                <p className="text-muted-foreground">No outliers found.</p>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={() => void run()} disabled={busy || !!criticalError}>
            {busy ? <Loader className="h-4 w-4 animate-spin" /> : 'Find Outliers'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
