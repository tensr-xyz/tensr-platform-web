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
import { rakeDatasetWeights } from '@/lib/dataset-data-ops';
import { adoptDerivedDataset, LINEAGE_HIDDEN_COLUMNS } from '@/lib/adopt-derived-dataset';
import { getDatasetIdFromTab, WORKSPACE_DATASET_REQUIRED } from '@/lib/workspace-dataset';
import { useTabsStore } from '@/stores/tabs-store';
import {
  buildRakePayload,
  rakeMarginFromColumn,
  RAKE_COPY,
  type RakeMargin,
} from '@/lib/rake-weights';

export function RakeWeightsDialog({ children }: { children: ReactNode }) {
  const token = getAccessToken();
  const { tabs, activeTabId } = useTabsStore();
  const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId), [tabs, activeTabId]);
  const datasetId = getDatasetIdFromTab(activeTab);
  const [open, setOpen] = useState(false);
  const [margins, setMargins] = useState<RakeMargin[]>([]);
  const [pendingColumn, setPendingColumn] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const columns = useMemo(() => {
    if (!activeTab?.data?.initialColumns) return [];
    return activeTab.data.initialColumns
      .map(c => c.id)
      .filter(id => !LINEAGE_HIDDEN_COLUMNS.has(id));
  }, [activeTab?.data?.initialColumns]);

  const rows = useMemo(() => activeTab?.data?.initialData || [], [activeTab?.data?.initialData]);

  const addMargin = () => {
    if (!pendingColumn) return;
    if (margins.some(m => m.column === pendingColumn)) {
      setError(`${pendingColumn} is already a raking variable.`);
      return;
    }
    setError(null);
    setMargins(prev => [...prev, rakeMarginFromColumn(pendingColumn, rows)]);
    setPendingColumn('');
  };

  const setTarget = (column: string, category: string, value: string) => {
    setMargins(prev =>
      prev.map(m =>
        m.column === column ? { ...m, targets: { ...m.targets, [category]: value } } : m
      )
    );
  };

  const run = async () => {
    if (!datasetId) {
      setError(WORKSPACE_DATASET_REQUIRED);
      return;
    }
    const payload = buildRakePayload(margins);
    if (!Object.keys(payload.categorical_targets).length) {
      setError('Add at least one raking variable with numeric targets.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await rakeDatasetWeights(datasetId, payload, token);
      adoptDerivedDataset({
        dataset_id: res.derived_dataset_id || res.dataset_id,
        original_filename: res.original_filename,
        n_rows: res.n_rows,
        n_cols: res.n_cols,
        preview: res.preview,
      });
      setOpen(false);
      setMargins([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rake failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Rake Weights</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-xs text-muted-foreground">{RAKE_COPY}</p>
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1 space-y-1">
              <Label>Categorical variable</Label>
              <Select value={pendingColumn} onValueChange={setPendingColumn}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose column" />
                </SelectTrigger>
                <SelectContent>
                  {columns.map(c => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="button" variant="outline" onClick={addMargin} disabled={!pendingColumn}>
              Add
            </Button>
          </div>
          {margins.map(margin => (
            <div key={margin.column} className="rounded-md border border-border p-2">
              <p className="text-xs font-medium">{margin.column}</p>
              <div className="mt-2 space-y-1">
                {Object.keys(margin.targets).map(category => (
                  <div key={category} className="flex items-center gap-2">
                    <span className="w-1/2 text-xs">{category}</span>
                    <Input
                      className="h-8 text-xs"
                      inputMode="decimal"
                      value={margin.targets[category]}
                      onChange={e => setTarget(margin.column, category, e.target.value)}
                      placeholder="Target n"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" onClick={() => void run()} disabled={busy}>
            {busy ? 'Raking…' : 'Create raked version'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
