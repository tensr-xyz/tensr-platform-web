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
import { computeDataset } from '@/lib/dataset-data-ops';
import { adoptDerivedDataset, LINEAGE_HIDDEN_COLUMNS } from '@/lib/adopt-derived-dataset';
import { buildComputeBody, type ComputeKind } from '@/lib/compute-transform';
import { getDatasetIdFromTab, WORKSPACE_DATASET_REQUIRED } from '@/lib/workspace-dataset';
import { useTabsStore } from '@/stores/tabs-store';

export function ComputeVariablesDialog({ children }: { children: ReactNode }) {
  const token = getAccessToken();
  const { tabs, activeTabId } = useTabsStore();
  const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId), [tabs, activeTabId]);
  const datasetId = getDatasetIdFromTab(activeTab);
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState('');
  const [kind, setKind] = useState<ComputeKind>('formula');
  const [expr, setExpr] = useState('');
  const [sources, setSources] = useState<string[]>([]);
  const [source, setSource] = useState('');
  const [subtractFrom, setSubtractFrom] = useState('6');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const columns = useMemo(() => {
    if (!activeTab?.data?.initialColumns) return [];
    return activeTab.data.initialColumns
      .map(c => c.id)
      .filter(id => !LINEAGE_HIDDEN_COLUMNS.has(id));
  }, [activeTab?.data?.initialColumns]);

  const toggleSource = (col: string) => {
    setSources(prev => (prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]));
  };

  const insertColumn = (col: string) => {
    setExpr(prev => {
      const trimmed = prev.trimEnd();
      if (!trimmed) return col;
      return `${trimmed} ${col}`;
    });
  };

  const run = async () => {
    if (!datasetId) {
      setError(WORKSPACE_DATASET_REQUIRED);
      return;
    }
    const subtract = Number(subtractFrom);
    const body = buildComputeBody({
      target,
      kind,
      expr,
      sources,
      source,
      subtractFrom: kind === 'reverse_score' && Number.isFinite(subtract) ? subtract : undefined,
    });
    if ('error' in body) {
      setError(body.error);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await computeDataset(datasetId, body, token);
      adoptDerivedDataset(res);
      setOpen(false);
      setTarget('');
      setExpr('');
      setSources([]);
      setSource('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Compute failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Compute Variable</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Creates a new column on a derived dataset. Formulas may use column names, numbers, and + −
          × ÷.
        </p>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="compute-target">New variable name</Label>
            <Input
              id="compute-target"
              value={target}
              onChange={e => setTarget(e.target.value)}
              placeholder="e.g. age_plus_score"
            />
          </div>
          <div className="space-y-1">
            <Label>Compute as</Label>
            <Select value={kind} onValueChange={value => setKind(value as ComputeKind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="formula">Formula (+ − × ÷)</SelectItem>
                <SelectItem value="row_mean">Row mean</SelectItem>
                <SelectItem value="reverse_score">Reverse score</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {kind === 'formula' ? (
            <div className="space-y-2">
              <Label htmlFor="compute-expr">Formula</Label>
              <Input
                id="compute-expr"
                value={expr}
                onChange={e => setExpr(e.target.value)}
                placeholder="age + score"
              />
              <div className="flex flex-wrap gap-1">
                {columns.map(col => (
                  <Button
                    key={col}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => insertColumn(col)}
                  >
                    {col}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          {kind === 'row_mean' ? (
            <div className="space-y-1">
              <Label>Source columns</Label>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
                {columns.map(col => (
                  <label key={col} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={sources.includes(col)}
                      onChange={() => toggleSource(col)}
                    />
                    {col}
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          {kind === 'reverse_score' ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Source column</Label>
                <Select value={source} onValueChange={setSource}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose column" />
                  </SelectTrigger>
                  <SelectContent>
                    {columns.map(col => (
                      <SelectItem key={col} value={col}>
                        {col}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="compute-scale">Subtract from (scale maximum + 1)</Label>
                <Input
                  id="compute-scale"
                  type="number"
                  value={subtractFrom}
                  onChange={e => setSubtractFrom(e.target.value)}
                />
              </div>
            </div>
          ) : null}

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>
        <DialogFooter>
          <Button onClick={run} disabled={busy}>
            {busy ? 'Working…' : 'Compute Variable'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ComputeVariablesDialog;
