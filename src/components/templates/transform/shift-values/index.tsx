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
import { getAccessToken } from '@/utils/auth';
import { shiftDatasetColumns } from '@/lib/dataset-data-ops';
import { adoptDerivedDataset, LINEAGE_HIDDEN_COLUMNS } from '@/lib/adopt-derived-dataset';
import { getDatasetIdFromTab, WORKSPACE_DATASET_REQUIRED } from '@/lib/workspace-dataset';
import { useTabsStore } from '@/stores/tabs-store';

type ShiftDirection = 'lag' | 'lead';

export function ShiftValuesDialog({ children }: { children: ReactNode }) {
  const token = getAccessToken();
  const { tabs, activeTabId } = useTabsStore();
  const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId), [tabs, activeTabId]);
  const datasetId = getDatasetIdFromTab(activeTab);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [direction, setDirection] = useState<ShiftDirection>('lag');
  const [periods, setPeriods] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const columns = useMemo(() => {
    if (!activeTab?.data?.initialColumns) return [];
    return activeTab.data.initialColumns
      .map(c => c.id)
      .filter(id => !LINEAGE_HIDDEN_COLUMNS.has(id));
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
      adoptDerivedDataset(res);
      setOpen(false);
      setSelected([]);
      setDirection('lag');
      setPeriods('1');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Shift failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Shift Values</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Copies values from earlier (lag) or later (lead) rows into new columns. Vacated rows are
          system-missing. Same endpoint as Lag Cases / Lead Cases.
        </p>
        <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2">
          {columns.map(col => (
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
          <Label>Direction</Label>
          <Select value={direction} onValueChange={value => setDirection(value as ShiftDirection)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lag">Previous value (lag)</SelectItem>
              <SelectItem value="lead">Next value (lead)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="shift-values-periods">Number of periods</Label>
          <Input
            id="shift-values-periods"
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
            {busy ? 'Working…' : 'Shift Values'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ShiftValuesDialog;
