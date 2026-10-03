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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/select';
import { getStytchBearerForTensrApi } from '@/utils/auth';
import { formatApiErrorMessage } from '@/lib/api-error';
import { datasetRequest } from '@/lib/dataset-data-ops';
import { resolveWorkspaceDatasetId, WORKSPACE_DATASET_REQUIRED } from '@/lib/workspace-dataset';
import { useTabsStore } from '@/stores/tabs-store';
import { useProjectStore } from '@/stores/project-store';

type SetKind = 'grid' | 'multiple_response' | 'brand_list' | 'group';

type VariableSet = {
  id?: string;
  name: string;
  kind: SetKind;
  label?: string;
  columns: string[];
};

const KINDS: Array<{ value: SetKind; label: string }> = [
  { value: 'grid', label: 'Grid' },
  { value: 'multiple_response', label: 'Multiple response' },
  { value: 'brand_list', label: 'Brand list' },
  { value: 'group', label: 'Group of variables' },
];

export function VariableSetsDialog({ children }: { children: ReactNode }) {
  const token = getStytchBearerForTensrApi();
  const { tabs, activeTabId } = useTabsStore();
  const fileSystem = useProjectStore(s => s.fileSystem);
  const currentProject = useProjectStore(s => s.currentProject);
  const activeTab = useMemo(() => tabs.find(tab => tab.id === activeTabId), [tabs, activeTabId]);
  const datasetId = resolveWorkspaceDatasetId({
    tab: activeTab,
    projectId: currentProject?.id,
    fileSystem,
  });
  const columnNames = useMemo(() => {
    const row = activeTab?.data?.initialData?.[0];
    if (!row) return [];
    return Object.keys(row).filter(key => key !== 'id');
  }, [activeTab?.data?.initialData]);

  const [sets, setSets] = useState<VariableSet[]>([]);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<SetKind>('brand_list');
  const [columns, setColumns] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!datasetId) return;
    try {
      const result = await datasetRequest<{ sets: VariableSet[] }>(
        `/datasets/${datasetId}/variable-sets`,
        token
      );
      setSets(result.sets || []);
    } catch (err) {
      setError(formatApiErrorMessage(err));
    }
  };

  const save = async (next: VariableSet[]) => {
    if (!datasetId) {
      setError(WORKSPACE_DATASET_REQUIRED);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await datasetRequest<{ sets: VariableSet[] }>(
        `/datasets/${datasetId}/variable-sets`,
        token,
        {
          method: 'PUT',
          body: {
            sets: next.map(item => ({
              name: item.name,
              kind: item.kind,
              columns: item.columns,
              label: item.label || item.name,
            })),
          },
        }
      );
      setSets(result.sets || []);
      setName('');
      setColumns([]);
    } catch (err) {
      setError(formatApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      onOpenChange={open => {
        if (open) void load();
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Variable sets</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Name a grid, multiple-response set, brand list, or any group. Use that name as one stub or
          one banner column. Sets stay on derived files and in .sav notes.
        </p>
        <ul className="max-h-32 space-y-1 overflow-y-auto text-xs">
          {sets.length ? (
            sets.map(item => (
              <li key={item.name} className="flex items-center justify-between gap-2">
                <span>
                  {item.name} · {item.kind} · {item.columns.join(', ')}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-6 text-[10px]"
                  onClick={() => void save(sets.filter(set => set.name !== item.name))}
                >
                  Remove
                </Button>
              </li>
            ))
          ) : (
            <li className="text-muted-foreground">No sets on this dataset yet.</li>
          )}
        </ul>
        <div className="space-y-2">
          <Label>Name</Label>
          <input
            className="w-full rounded-md border px-2 py-1 text-sm"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Brands"
          />
          <Label>Kind</Label>
          <Select value={kind} onValueChange={value => setKind(value as SetKind)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KINDS.map(item => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Label>Columns</Label>
          <div className="grid max-h-36 gap-2 overflow-y-auto rounded-md border p-2">
            {columnNames.map(column => (
              <label key={column} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={columns.includes(column)}
                  onCheckedChange={() =>
                    setColumns(prev =>
                      prev.includes(column)
                        ? prev.filter(item => item !== column)
                        : [...prev, column]
                    )
                  }
                />
                {column}
              </label>
            ))}
          </div>
        </div>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button
            type="button"
            disabled={busy || !name.trim() || columns.length < 2}
            onClick={() =>
              void save([
                ...sets.filter(item => item.name !== name.trim()),
                { name: name.trim(), kind, columns, label: name.trim() },
              ])
            }
          >
            Save set
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
