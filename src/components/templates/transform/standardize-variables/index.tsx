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
import { useRouter } from 'next/navigation';
import { getAccessToken } from '@/utils/auth';
import { standardizeDataset } from '@/lib/dataset-data-ops';
import { getDatasetIdFromTab, WORKSPACE_DATASET_REQUIRED } from '@/lib/workspace-dataset';
import { useTabsStore } from '@/stores/tabs-store';

export function StandardizeVariablesDialog({ children }: { children: ReactNode }) {
  const router = useRouter();
  const token = getAccessToken();
  const { tabs, activeTabId } = useTabsStore();
  const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId), [tabs, activeTabId]);
  const datasetId = getDatasetIdFromTab(activeTab);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const numericCols = useMemo(() => {
    if (!activeTab?.data?.initialColumns) return [];
    return activeTab.data.initialColumns
      .filter(c => c.type === 'number' || c.type === 'numeric')
      .map(c => c.id);
  }, [activeTab?.data?.initialColumns]);

  const toggle = (col: string) => {
    setSelected(prev => (prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]));
  };

  const run = async () => {
    if (!datasetId) {
      setError(WORKSPACE_DATASET_REQUIRED);
      return;
    }
    if (!selected.length) {
      setError('Select at least one column');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await standardizeDataset(datasetId, { columns: selected, suffix: '_z' }, token);
      router.push(
        `/workspace/dataset/${res.dataset_id}?name=${encodeURIComponent(res.original_filename)}`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Standardize failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Standardize Variables</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Z-score selected columns (mean 0, SD 1). New columns are added with a <code>_z</code>{' '}
          suffix.
        </p>
        <div className="max-h-48 space-y-1 overflow-y-auto border rounded-md p-2">
          {numericCols.map(col => (
            <label key={col} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={selected.includes(col)}
                onChange={() => toggle(col)}
              />
              {col}
            </label>
          ))}
        </div>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button onClick={run} disabled={busy}>
            {busy ? 'Working…' : 'Create standardized columns'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
