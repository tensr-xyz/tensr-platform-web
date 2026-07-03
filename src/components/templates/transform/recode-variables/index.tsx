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
import { Checkbox } from '@/components/atoms/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/select';
import { useRouter } from 'next/navigation';
import { getAccessToken } from '@/utils/auth';
import { recodeDatasetColumn } from '@/lib/dataset-data-ops';
import { getDatasetIdFromTab, WORKSPACE_DATASET_REQUIRED } from '@/lib/workspace-dataset';
import { useTabsStore } from '@/stores/tabs-store';

type MappingRow = { from: string; to: string };

export function RecodeVariablesDialog({ children }: { children: ReactNode }) {
  const router = useRouter();
  const token = getAccessToken();
  const { tabs, activeTabId } = useTabsStore();
  const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId), [tabs, activeTabId]);
  const datasetId = getDatasetIdFromTab(activeTab);
  const [sourceColumn, setSourceColumn] = useState('');
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [targetColumn, setTargetColumn] = useState('');
  const [mappings, setMappings] = useState<MappingRow[]>([{ from: '', to: '' }]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const columns = useMemo(() => {
    if (!activeTab?.data?.initialColumns) return [];
    return activeTab.data.initialColumns.map(c => c.id);
  }, [activeTab?.data?.initialColumns]);

  const updateMapping = (idx: number, key: 'from' | 'to', value: string) => {
    setMappings(prev => prev.map((row, i) => (i === idx ? { ...row, [key]: value } : row)));
  };

  const addRow = () => setMappings(prev => [...prev, { from: '', to: '' }]);

  const run = async () => {
    if (!datasetId) {
      setError(WORKSPACE_DATASET_REQUIRED);
      return;
    }
    if (!sourceColumn) {
      setError('Select a source column');
      return;
    }
    const valid = mappings.filter(m => m.from.trim() !== '');
    if (!valid.length) {
      setError('Add at least one value mapping');
      return;
    }
    if (!replaceExisting && !targetColumn.trim()) {
      setError('Enter a name for the new column');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await recodeDatasetColumn(
        datasetId,
        {
          source_column: sourceColumn,
          mappings: valid.map(m => ({ from_value: m.from, to_value: m.to })),
          replace_existing: replaceExisting,
          target_column: replaceExisting ? undefined : targetColumn.trim(),
        },
        token
      );
      router.push(
        `/workspace/dataset/${res.dataset_id}?name=${encodeURIComponent(res.original_filename)}`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Recode failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Recode Variables</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Source variable</Label>
            <Select value={sourceColumn} onValueChange={setSourceColumn}>
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
          <div className="flex items-center gap-2">
            <Checkbox
              id="recode-same"
              checked={replaceExisting}
              onCheckedChange={c => setReplaceExisting(c === true)}
            />
            <Label htmlFor="recode-same" className="font-normal text-sm">
              Recode into same variable
            </Label>
          </div>
          {!replaceExisting ? (
            <div className="space-y-1">
              <Label htmlFor="target-col">New variable name</Label>
              <Input
                id="target-col"
                value={targetColumn}
                onChange={e => setTargetColumn(e.target.value)}
                placeholder={`${sourceColumn || 'var'}_recode`}
              />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label>Value mappings</Label>
            {mappings.map((row, idx) => (
              <div key={idx} className="flex gap-2">
                <Input
                  placeholder="Old value"
                  value={row.from}
                  onChange={e => updateMapping(idx, 'from', e.target.value)}
                />
                <Input
                  placeholder="New value"
                  value={row.to}
                  onChange={e => updateMapping(idx, 'to', e.target.value)}
                />
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addRow}>
              Add mapping
            </Button>
          </div>
        </div>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button onClick={run} disabled={busy}>
            {busy ? 'Working…' : 'Apply recode'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
