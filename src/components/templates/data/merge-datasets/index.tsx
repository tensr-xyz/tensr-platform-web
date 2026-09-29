import { ReactNode, useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/molecules/dialog';
import { Alert, AlertDescription } from '@/components/atoms/alert';
import { Button } from '@/components/atoms/button';
import { Label } from '@/components/atoms/label';
import { RadioGroup, RadioGroupItem } from '@/components/atoms/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/select';
import { useRouter } from 'next/navigation';
import { getAccessToken, getTensrApiHeaders } from '@/utils/auth';
import { apiClient } from '@/lib/api-client';
import {
  mergeDatasets,
  type DerivedDatasetResult,
  type MergePreviewResult,
  type MergeReport,
} from '@/lib/dataset-data-ops';
import { columnNamesFromSchemaResponse } from '@/lib/dataset-schema';
import { tensrApiUrl } from '@/lib/tensr-api-url';
import { getDatasetIdFromTab, WORKSPACE_DATASET_REQUIRED } from '@/lib/workspace-dataset';
import { mergeUnmatchedReportLines } from '@/lib/merge-unmatched-report';
import { pickObviousIdColumn } from '@/lib/obvious-id-column';
import { useTabsStore } from '@/stores/tabs-store';

type JoinHow = 'inner' | 'left' | 'right' | 'outer';
type MergeMode = 'stack' | 'add_variables' | JoinHow;

interface MergeDatasetProps {
  children: ReactNode;
}

const SYSTEM_COLUMNS = new Set(['_row_uid', '_source_row_uids', '_weight']);

function isPreview(value: DerivedDatasetResult | MergePreviewResult): value is MergePreviewResult {
  return (value as MergePreviewResult).preview === true;
}

export const MergeDatasetDialog = ({ children }: MergeDatasetProps) => {
  const router = useRouter();
  const token = getAccessToken();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<MergeMode>('inner');
  const [secondaryDataset, setSecondaryDataset] = useState<string>('');
  const [datasetOptions, setDatasetOptions] = useState<{ id: string; name: string }[]>([]);
  const [keyOptions, setKeyOptions] = useState<string[]>([]);
  const [keys, setKeys] = useState<string[]>([]);
  const [report, setReport] = useState<MergeReport | null>(null);
  const [previewStamp, setPreviewStamp] = useState<string>('');
  const { tabs, activeTabId } = useTabsStore();
  const activeTab = tabs.find(t => t.id === activeTabId);
  const primaryDatasetId = getDatasetIdFromTab(activeTab);
  const keyed = mode !== 'stack' && mode !== 'add_variables';
  const addVariables = mode === 'add_variables';
  const radioKind = mode === 'stack' ? 'stack' : addVariables ? 'add_variables' : 'join';
  const stamp = useMemo(
    () => JSON.stringify({ secondaryDataset, mode, keys }),
    [secondaryDataset, mode, keys]
  );
  const previewReady = report !== null && previewStamp === stamp;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await apiClient.projects.list();
        if (cancelled) return;
        setDatasetOptions(
          rows
            .filter(r => r.id && r.id !== primaryDatasetId)
            .map(r => ({ id: String(r.id), name: String(r.name || r.id) }))
        );
      } catch {
        if (!cancelled) setDatasetOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [primaryDatasetId]);

  useEffect(() => {
    if (!primaryDatasetId || !secondaryDataset) {
      setKeyOptions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const headers = {
          ...getTensrApiHeaders(),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };
        const [leftRes, rightRes] = await Promise.all([
          fetch(tensrApiUrl(`/datasets/${primaryDatasetId}/schema`), { headers }),
          fetch(tensrApiUrl(`/datasets/${secondaryDataset}/schema`), { headers }),
        ]);
        if (!leftRes.ok || !rightRes.ok) throw new Error('Could not load columns');
        const [leftJson, rightJson] = await Promise.all([leftRes.json(), rightRes.json()]);
        const rightNames = new Set(columnNamesFromSchemaResponse(rightJson));
        const shared = columnNamesFromSchemaResponse(leftJson).filter(
          name => rightNames.has(name) && !SYSTEM_COLUMNS.has(name)
        );
        if (!cancelled) {
          setKeyOptions(shared);
          const obvious = pickObviousIdColumn(shared);
          if (obvious) {
            setMode(prev => (prev === 'add_variables' ? 'inner' : prev));
            setKeys(prev => {
              const kept = prev.filter(key => shared.includes(key));
              return kept.length ? kept : [obvious];
            });
          } else {
            setKeys(prev => prev.filter(key => shared.includes(key)));
          }
        }
      } catch {
        if (!cancelled) setKeyOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [primaryDatasetId, secondaryDataset, token]);

  const payload = () => ({
    secondary_dataset_id: secondaryDataset,
    merge_type: mode,
    keys: keyed ? keys : [],
  });

  const handlePreview = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setReport(null);
      if (!primaryDatasetId) throw new Error(WORKSPACE_DATASET_REQUIRED);
      if (!secondaryDataset) throw new Error('Select a second dataset to merge');
      if (keyed && keys.length === 0) throw new Error('Select at least one key');
      const response = await mergeDatasets(
        primaryDatasetId,
        { ...payload(), preview: true },
        token
      );
      if (!isPreview(response)) throw new Error('Preview did not return a match report');
      setReport(response.merge_report);
      setPreviewStamp(stamp);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to preview merge');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMerge = async () => {
    try {
      setIsLoading(true);
      setError(null);
      if (!primaryDatasetId) throw new Error(WORKSPACE_DATASET_REQUIRED);
      if (!previewReady) throw new Error('Preview the unmatched rows before merging');
      const response = await mergeDatasets(primaryDatasetId, payload(), token);
      if (isPreview(response) || !('dataset_id' in response)) {
        throw new Error('Merge did not save a dataset');
      }
      router.push(
        `/workspace/dataset/${response.dataset_id}?name=${encodeURIComponent(response.original_filename)}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to merge datasets');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleKey = (name: string) => {
    setKeys(prev => (prev.includes(name) ? prev.filter(key => key !== name) : [...prev, name]));
    setReport(null);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Merge Datasets</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Merge type</Label>
            <RadioGroup
              value={radioKind}
              onValueChange={value => {
                if (value === 'stack') setMode('stack');
                else if (value === 'add_variables') setMode('add_variables');
                else setMode(keyed ? (mode as JoinHow) : 'inner');
                setReport(null);
              }}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="join" id="join" />
                <Label htmlFor="join">Join on keys</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="add_variables" id="add_variables" />
                <Label htmlFor="add_variables">Add variables (side by side)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="stack" id="stack" />
                <Label htmlFor="stack">Stack rows (union columns)</Label>
              </div>
            </RadioGroup>
          </div>

          {addVariables && (
            <Alert>
              <AlertDescription>
                Rows are matched by position, not by a key. Both files must have the same number of
                rows.
              </AlertDescription>
            </Alert>
          )}

          {keyed && (
            <div className="space-y-2">
              <Label>Join type</Label>
              <Select
                value={mode}
                onValueChange={value => {
                  setMode(value as JoinHow);
                  setReport(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inner">Inner</SelectItem>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="right">Right</SelectItem>
                  <SelectItem value="outer">Outer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Second dataset</Label>
            <Select
              value={secondaryDataset}
              onValueChange={value => {
                setSecondaryDataset(value);
                setKeys([]);
                setReport(null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose dataset" />
              </SelectTrigger>
              <SelectContent>
                {datasetOptions.map(opt => (
                  <SelectItem key={opt.id} value={opt.id}>
                    {opt.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {keyed && (
            <div className="space-y-2">
              <Label>Keys</Label>
              <div className="max-h-36 space-y-1 overflow-auto rounded border p-2">
                {keyOptions.length === 0 && (
                  <p className="text-sm text-muted-foreground">No shared columns yet.</p>
                )}
                {keyOptions.map(name => (
                  <label key={name} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={keys.includes(name)}
                      onChange={() => toggleKey(name)}
                    />
                    {name}
                  </label>
                ))}
              </div>
            </div>
          )}

          {report && (
            <div className="space-y-1 rounded border p-2 text-sm">
              {mergeUnmatchedReportLines(report, keyed).map(line => (
                <p key={line}>{line}</p>
              ))}
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button onClick={handlePreview} disabled={isLoading || !primaryDatasetId}>
            {isLoading ? 'Working...' : 'Preview match'}
          </Button>
          <Button onClick={handleMerge} disabled={isLoading || !previewReady}>
            Merge datasets
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
