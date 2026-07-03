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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/select';
import { Checkbox } from '@/components/atoms/checkbox';
import { Loader2 as Loader } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getAccessToken } from '@/utils/auth';
import { rankDatasetCases } from '@/lib/dataset-data-ops';
import { getDatasetIdFromTab, WORKSPACE_DATASET_REQUIRED } from '@/lib/workspace-dataset';
import { useTabsStore } from '@/stores/tabs-store';

export function RankCasesDialog({ children }: { children: ReactNode }) {
  const router = useRouter();
  const token = getAccessToken();
  const { tabs, activeTabId } = useTabsStore();
  const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId), [tabs, activeTabId]);
  const datasetId = getDatasetIdFromTab(activeTab);
  const [selected, setSelected] = useState<string[]>([]);
  const [method, setMethod] = useState<'ordinal' | 'fractional' | 'savage'>('ordinal');
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
      const res = await rankDatasetCases(datasetId, { columns: selected, method }, token);
      router.push(
        `/workspace/dataset/${res.dataset_id}?name=${encodeURIComponent(res.original_filename)}`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rank failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rank Cases</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Rank method</Label>
            <Select value={method} onValueChange={v => setMethod(v as typeof method)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ordinal">Ordinal (competition rank)</SelectItem>
                <SelectItem value="fractional">Fractional (average rank)</SelectItem>
                <SelectItem value="savage">Savage scores</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2">
            {numericCols.map(col => (
              <label key={col} className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox checked={selected.includes(col)} onCheckedChange={() => toggle(col)} />
                {col}
              </label>
            ))}
          </div>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>
        <DialogFooter>
          <Button onClick={run} disabled={busy}>
            {busy ? <Loader className="h-4 w-4 animate-spin" /> : 'Rank cases'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default RankCasesDialog;
