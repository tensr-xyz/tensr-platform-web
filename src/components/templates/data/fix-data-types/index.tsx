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
import { Label } from '@/components/atoms/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/select';
import { useRouter } from 'next/navigation';
import { Loader2 as Loader, Plus, Trash2 } from 'lucide-react';
import { getStytchBearerForTensrApi } from '@/utils/auth';
import { fixDatasetDataTypes } from '@/lib/dataset-data-ops';
import { formatApiErrorMessage } from '@/lib/api-error';
import { resolveWorkspaceDatasetId, WORKSPACE_DATASET_REQUIRED } from '@/lib/workspace-dataset';
import { useTabsStore } from '@/stores/tabs-store';
import { useProjectStore } from '@/stores/project-store';

const TARGET_TYPES = [
  'numeric',
  'integer',
  'float',
  'string',
  'text',
  'boolean',
  'datetime',
  'date',
  'likert',
  'ordinal',
  'id',
] as const;

type CastRow = { name: string; target_type: string };

export function FixDataTypesDialog({ children }: { children: ReactNode }) {
  const router = useRouter();
  const token = getStytchBearerForTensrApi();
  const { tabs, activeTabId } = useTabsStore();
  const fileSystem = useProjectStore(s => s.fileSystem);
  const currentProject = useProjectStore(s => s.currentProject);
  const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId), [tabs, activeTabId]);
  const datasetId = resolveWorkspaceDatasetId({
    tab: activeTab,
    projectId: currentProject?.id,
    fileSystem,
  });

  const columnNames = useMemo(() => {
    if (!activeTab?.data?.initialData?.[0]) return [];
    return Object.keys(activeTab.data.initialData[0]).filter(k => k !== 'id');
  }, [activeTab?.data?.initialData]);

  const [casts, setCasts] = useState<CastRow[]>([{ name: '', target_type: 'numeric' }]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const criticalError = !activeTab
    ? 'Please open a dataset first'
    : !datasetId
      ? WORKSPACE_DATASET_REQUIRED
      : null;

  const run = async () => {
    if (!datasetId) {
      setError(WORKSPACE_DATASET_REQUIRED);
      return;
    }
    const valid = casts.filter(c => c.name && c.target_type);
    if (!valid.length) {
      setError('Add at least one column cast');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fixDatasetDataTypes(datasetId, { casts: valid }, token);
      router.push(
        `/workspace/dataset/${response.dataset_id}?name=${encodeURIComponent(response.original_filename)}`
      );
    } catch (err) {
      setError(formatApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Fix Data Types</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {casts.map((cast, idx) => (
            <div key={idx} className="flex items-end gap-2">
              <div className="flex-1 space-y-1">
                <Label>Column</Label>
                <Select
                  value={cast.name || undefined}
                  onValueChange={v =>
                    setCasts(prev => prev.map((c, i) => (i === idx ? { ...c, name: v } : c)))
                  }
                  disabled={!!criticalError}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Column" />
                  </SelectTrigger>
                  <SelectContent>
                    {columnNames.map(col => (
                      <SelectItem key={col} value={col}>
                        {col}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 space-y-1">
                <Label>Target type</Label>
                <Select
                  value={cast.target_type}
                  onValueChange={v =>
                    setCasts(prev => prev.map((c, i) => (i === idx ? { ...c, target_type: v } : c)))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TARGET_TYPES.map(t => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={casts.length <= 1}
                onClick={() => setCasts(prev => prev.filter((_, i) => i !== idx))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCasts(prev => [...prev, { name: '', target_type: 'numeric' }])}
          >
            <Plus className="mr-1 h-4 w-4" />
            Add cast
          </Button>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter>
          <Button onClick={() => void run()} disabled={busy || !!criticalError}>
            {busy ? <Loader className="h-4 w-4 animate-spin" /> : 'Fix Data Types'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
