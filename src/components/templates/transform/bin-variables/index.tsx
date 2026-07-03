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
import { Input } from '@/components/atoms/input';
import { Label } from '@/components/atoms/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/select';
import { useRouter } from 'next/navigation';
import { getAccessToken } from '@/utils/auth';
import { binDatasetColumn } from '@/lib/dataset-data-ops';
import { getDatasetIdFromTab, WORKSPACE_DATASET_REQUIRED } from '@/lib/workspace-dataset';
import { useTabsStore } from '@/stores/tabs-store';

export function BinVariablesDialog({ children }: { children: ReactNode }) {
  const router = useRouter();
  const token = getAccessToken();
  const { tabs, activeTabId } = useTabsStore();
  const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId), [tabs, activeTabId]);
  const datasetId = getDatasetIdFromTab(activeTab);
  const [sourceColumn, setSourceColumn] = useState('');
  const [nBins, setNBins] = useState('5');
  const [strategy, setStrategy] = useState<'equal_width' | 'equal_frequency'>('equal_width');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const numericCols = useMemo(() => {
    if (!activeTab?.data?.initialColumns) return [];
    return activeTab.data.initialColumns
      .filter(c => c.type === 'number' || c.type === 'numeric')
      .map(c => c.id);
  }, [activeTab?.data?.initialColumns]);

  const run = async () => {
    if (!datasetId) {
      setError(WORKSPACE_DATASET_REQUIRED);
      return;
    }
    if (!sourceColumn) {
      setError('Select a column to bin');
      return;
    }
    const bins = Number(nBins);
    if (!Number.isFinite(bins) || bins < 2) {
      setError('Enter at least 2 bins');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await binDatasetColumn(
        datasetId,
        {
          source_column: sourceColumn,
          n_bins: bins,
          strategy,
        },
        token
      );
      router.push(
        `/workspace/dataset/${res.dataset_id}?name=${encodeURIComponent(res.original_filename)}`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Binning failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Visual Binning</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Source variable</Label>
            <Select value={sourceColumn} onValueChange={setSourceColumn}>
              <SelectTrigger>
                <SelectValue placeholder="Choose column" />
              </SelectTrigger>
              <SelectContent>
                {numericCols.map(c => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="n-bins">Number of bins</Label>
            <Input id="n-bins" value={nBins} onChange={e => setNBins(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Binning method</Label>
            <Select value={strategy} onValueChange={v => setStrategy(v as typeof strategy)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="equal_width">Equal width</SelectItem>
                <SelectItem value="equal_frequency">Equal frequency (quantiles)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button onClick={run} disabled={busy}>
            {busy ? 'Working…' : 'Create binned column'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
