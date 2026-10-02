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
import { poststratifyDatasetWeights } from '@/lib/dataset-data-ops';
import { LINEAGE_HIDDEN_COLUMNS } from '@/lib/adopt-derived-dataset';
import { showDerivedResult } from '@/lib/show-derived-result';
import { getDatasetIdFromTab, WORKSPACE_DATASET_REQUIRED } from '@/lib/workspace-dataset';
import { rakeMarginFromColumn } from '@/lib/rake-weights';
import { useTabsStore } from '@/stores/tabs-store';

export function CellWeightsDialog({ children }: { children: ReactNode }) {
  const token = getAccessToken();
  const { tabs, activeTabId } = useTabsStore();
  const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId), [tabs, activeTabId]);
  const datasetId = getDatasetIdFromTab(activeTab);
  const [open, setOpen] = useState(false);
  const [column, setColumn] = useState('');
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const columns = useMemo(() => {
    if (!activeTab?.data?.initialColumns) return [];
    return activeTab.data.initialColumns
      .map(c => c.id)
      .filter(id => !LINEAGE_HIDDEN_COLUMNS.has(id));
  }, [activeTab?.data?.initialColumns]);
  const rows = useMemo(() => activeTab?.data?.initialData || [], [activeTab?.data?.initialData]);

  const chooseColumn = (next: string) => {
    setColumn(next);
    setTargets(rakeMarginFromColumn(next, rows).targets);
    setNotice(null);
  };

  const run = async () => {
    if (!datasetId) {
      setError(WORKSPACE_DATASET_REQUIRED);
      return;
    }
    const cells: Record<string, number> = {};
    for (const [level, raw] of Object.entries(targets)) {
      const n = Number(raw);
      if (String(raw).trim() === '' || !Number.isFinite(n)) continue;
      cells[level] = n;
    }
    if (!column || Object.keys(cells).length === 0) {
      setError('Choose a column and enter a target for each cell you want to weight.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = { variables: [column], cells, missing_handling: 'exclude' as const };
      const res = await poststratifyDatasetWeights(datasetId, payload, token);
      showDerivedResult(
        'poststratify',
        { ...res, dataset_id: res.derived_dataset_id || res.dataset_id },
        payload
      );
      const diagnostics = res.diagnostics;
      setNotice(
        diagnostics
          ? `ESS ${Number(diagnostics.kish_ess).toFixed(1)}, DEFF ${Number(diagnostics.deff).toFixed(2)}, efficiency ${Number(diagnostics.weighting_efficiency).toFixed(2)}, weights ${Number(diagnostics.min_weight).toFixed(2)}–${Number(diagnostics.max_weight).toFixed(2)}.`
          : 'Cell weights saved.'
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cell weighting failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cell weighting</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-xs text-muted-foreground">
            Post-stratify one column to target counts or shares. This saves a new dataset version.
          </p>
          <div className="space-y-1">
            <Label>Column</Label>
            <Select value={column} onValueChange={chooseColumn}>
              <SelectTrigger>
                <SelectValue placeholder="Choose column" />
              </SelectTrigger>
              <SelectContent>
                {columns.map(name => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {Object.keys(targets).map(level => (
            <div key={level} className="flex items-center gap-2">
              <span className="w-1/2 text-xs">{level}</span>
              <Input
                className="h-8 text-xs"
                inputMode="decimal"
                value={targets[level]}
                onChange={event => setTargets(prev => ({ ...prev, [level]: event.target.value }))}
                placeholder="Target"
              />
            </div>
          ))}
          {notice ? (
            <Alert>
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          ) : null}
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" onClick={() => void run()} disabled={busy}>
            {busy ? 'Weighting…' : 'Create weighted version'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
