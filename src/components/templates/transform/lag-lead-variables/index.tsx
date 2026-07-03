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
import { useRouter } from 'next/navigation';
import { getAccessToken } from '@/utils/auth';
import { shiftDatasetColumns } from '@/lib/dataset-data-ops';
import { getDatasetIdFromTab, WORKSPACE_DATASET_REQUIRED } from '@/lib/workspace-dataset';
import { useTabsStore } from '@/stores/tabs-store';

type ShiftDirection = 'lag' | 'lead';

function LagLeadDialog({
  children,
  direction,
  title,
}: {
  children: ReactNode;
  direction: ShiftDirection;
  title: string;
}) {
  const router = useRouter();
  const token = getAccessToken();
  const { tabs, activeTabId } = useTabsStore();
  const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId), [tabs, activeTabId]);
  const datasetId = getDatasetIdFromTab(activeTab);
  const [selected, setSelected] = useState<string[]>([]);
  const [periods, setPeriods] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const columnNames = useMemo(() => {
    if (!activeTab?.data?.initialColumns) return [];
    return activeTab.data.initialColumns.map(c => c.id);
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
    const n = Number(periods);
    if (!periods.trim() || Number.isNaN(n) || n < 1) {
      setError('Periods must be at least 1');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await shiftDatasetColumns(
        datasetId,
        { columns: selected, direction, periods: n },
        token
      );
      router.push(
        `/workspace/dataset/${res.dataset_id}?name=${encodeURIComponent(res.original_filename)}`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Transform failed');
    } finally {
      setBusy(false);
    }
  };

  const hint =
    direction === 'lag'
      ? 'Lag copies values from earlier rows into new columns (e.g. previous observation).'
      : 'Lead copies values from later rows into new columns (e.g. next observation).';

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{hint}</p>
        <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2">
          {columnNames.map(col => (
            <label key={col} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.includes(col)}
                onChange={() => toggle(col)}
              />
              {col}
            </label>
          ))}
        </div>
        <div className="space-y-1">
          <Label htmlFor="shift-periods">Number of periods</Label>
          <Input
            id="shift-periods"
            type="number"
            min={1}
            value={periods}
            onChange={e => setPeriods(e.target.value)}
          />
        </div>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button onClick={run} disabled={busy}>
            {busy ? 'Working…' : 'Create shifted columns'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LagCasesDialog({ children }: { children: ReactNode }) {
  return (
    <LagLeadDialog direction="lag" title="Lag Cases">
      {children}
    </LagLeadDialog>
  );
}

export function LeadCasesDialog({ children }: { children: ReactNode }) {
  return (
    <LagLeadDialog direction="lead" title="Lead Cases">
      {children}
    </LagLeadDialog>
  );
}
