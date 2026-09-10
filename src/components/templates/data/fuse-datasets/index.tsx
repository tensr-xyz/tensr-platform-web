'use client';

import { ReactNode, useEffect, useMemo, useState } from 'react';
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
import { Loader2 as Loader } from 'lucide-react';
import { getStytchBearerForTensrApi } from '@/utils/auth';
import { apiClient } from '@/lib/api-client';
import { fuseWaveDatasets, fuseSurveyDatasets } from '@/lib/dataset-data-ops';
import { formatApiErrorMessage } from '@/lib/api-error';
import { resolveWorkspaceDatasetId, WORKSPACE_DATASET_REQUIRED } from '@/lib/workspace-dataset';
import { useTabsStore } from '@/stores/tabs-store';
import { useProjectStore } from '@/stores/project-store';
import { useToast } from '@/hooks/ui/use-toast';

type FuseMode = 'waves' | 'datasets';

function FuseDialog({
  children,
  mode,
  title,
}: {
  children: ReactNode;
  mode: FuseMode;
  title: string;
}) {
  const token = getStytchBearerForTensrApi();
  const { toast } = useToast();
  const { tabs, activeTabId } = useTabsStore();
  const fileSystem = useProjectStore(s => s.fileSystem);
  const currentProject = useProjectStore(s => s.currentProject);
  const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId), [tabs, activeTabId]);
  const primaryId = resolveWorkspaceDatasetId({
    tab: activeTab,
    projectId: currentProject?.id,
    fileSystem,
  });

  const columnNames = useMemo(() => {
    if (!activeTab?.data?.initialData?.[0]) return [];
    return Object.keys(activeTab.data.initialData[0]).filter(k => k !== 'id');
  }, [activeTab?.data?.initialData]);

  const [datasetOptions, setDatasetOptions] = useState<{ id: string; name: string }[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [keyColumn, setKeyColumn] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await apiClient.projects.list();
        if (cancelled) return;
        setDatasetOptions(
          rows.filter(r => r.id).map(r => ({ id: String(r.id), name: String(r.name || r.id) }))
        );
      } catch {
        if (!cancelled) setDatasetOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (primaryId && !selectedIds.includes(primaryId)) {
      setSelectedIds(prev => (prev.includes(primaryId) ? prev : [primaryId, ...prev]));
    }
  }, [primaryId]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleId = (id: string) => {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const run = async () => {
    if (selectedIds.length < 2) {
      setError('Select at least two datasets');
      return;
    }
    if (!primaryId && !selectedIds.length) {
      setError(WORKSPACE_DATASET_REQUIRED);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result =
        mode === 'waves'
          ? await fuseWaveDatasets(
              { dataset_ids: selectedIds, wave_column: keyColumn || undefined },
              token
            )
          : await fuseSurveyDatasets(
              {
                dataset_ids: selectedIds,
                key_columns: keyColumn ? [keyColumn] : undefined,
              },
              token
            );
      console.info(`[${title}]`, result);
      toast({
        title: title,
        description: `Fused ${selectedIds.length} datasets (${(result as { n_rows?: number }).n_rows ?? '?'} rows).`,
      });
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
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Datasets</Label>
            <div className="grid max-h-40 gap-2 overflow-y-auto rounded-sm border p-2">
              {datasetOptions.length ? (
                datasetOptions.map(opt => (
                  <div key={opt.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`fuse-${mode}-${opt.id}`}
                      checked={selectedIds.includes(opt.id)}
                      onCheckedChange={() => toggleId(opt.id)}
                    />
                    <Label htmlFor={`fuse-${mode}-${opt.id}`} className="cursor-pointer truncate">
                      {opt.name}
                    </Label>
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground">No datasets listed</div>
              )}
            </div>
          </div>
          {columnNames.length > 0 && (
            <div className="space-y-2">
              <Label>
                {mode === 'waves' ? 'Optional key / wave column' : 'Optional key column'}
              </Label>
              <Select
                value={keyColumn || '__none__'}
                onValueChange={v => setKeyColumn(v === '__none__' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {columnNames.map(col => (
                    <SelectItem key={col} value={col}>
                      {col}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter>
          <Button onClick={() => void run()} disabled={busy}>
            {busy ? <Loader className="h-4 w-4 animate-spin" /> : title}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function FuseWavesDialog({ children }: { children: ReactNode }) {
  return (
    <FuseDialog mode="waves" title="Fuse Waves">
      {children}
    </FuseDialog>
  );
}

export function FuseDatasetsDialog({ children }: { children: ReactNode }) {
  return (
    <FuseDialog mode="datasets" title="Fuse Datasets">
      {children}
    </FuseDialog>
  );
}
