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
import { Input } from '@/components/atoms/input';
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
import { tensrApiUrl } from '@/lib/tensr-api-url';
import { formatApiErrorMessage } from '@/lib/api-error';
import { openAnalysisResultTab } from '@/lib/open-analysis-result-tab';
import { resolveWorkspaceDatasetId, WORKSPACE_DATASET_REQUIRED } from '@/lib/workspace-dataset';
import { useTabsStore } from '@/stores/tabs-store';
import { useProjectStore } from '@/stores/project-store';
import { useToast } from '@/hooks/ui/use-toast';

export type TechniqueField =
  | { kind: 'column'; key: string; label: string; optional?: boolean }
  | { kind: 'columns'; key: string; label: string; optional?: boolean }
  | { kind: 'number'; key: string; label: string; default?: number; optional?: boolean }
  | { kind: 'text'; key: string; label: string; optional?: boolean; placeholder?: string }
  | { kind: 'json'; key: string; label: string; optional?: boolean; placeholder?: string };

export type TechniqueConfig = {
  label: string;
  /** Path under /datasets/{id}/… or absolute /datasets/… when needsDataset is false */
  route: string;
  needsDataset?: boolean;
  fields: TechniqueField[];
  analysisOp: string;
};

export const TECHNIQUE_CONFIGS: Record<string, TechniqueConfig> = {
  TURF: {
    label: 'TURF',
    route: 'techniques/turf',
    analysisOp: 'turf',
    fields: [
      { kind: 'columns', key: 'items', label: 'Item columns' },
      { kind: 'number', key: 'k', label: 'Portfolio size (k)', default: 3 },
    ],
  },
  'Driver Analysis': {
    label: 'Driver Analysis',
    route: 'techniques/drivers',
    analysisOp: 'drivers',
    fields: [
      { kind: 'column', key: 'outcome', label: 'Outcome' },
      { kind: 'columns', key: 'drivers', label: 'Driver columns' },
    ],
  },
  NPS: {
    label: 'NPS',
    route: 'techniques/nps',
    analysisOp: 'nps',
    fields: [
      { kind: 'column', key: 'score_column', label: 'Score column' },
      { kind: 'column', key: 'group_column', label: 'Group column', optional: true },
    ],
  },
  'Correspondence Analysis': {
    label: 'Correspondence Analysis',
    route: 'techniques/correspondence',
    analysisOp: 'correspondence',
    fields: [
      { kind: 'column', key: 'row_column', label: 'Row column' },
      { kind: 'column', key: 'column_column', label: 'Column column' },
    ],
  },
  'Verbatim Coding': {
    label: 'Verbatim Coding',
    route: 'techniques/verbatim',
    analysisOp: 'verbatim',
    fields: [{ kind: 'column', key: 'text_column', label: 'Text column' }],
  },
  'Van Westendorp': {
    label: 'Van Westendorp',
    route: 'techniques/van-westendorp',
    analysisOp: 'van_westendorp',
    fields: [
      { kind: 'column', key: 'too_cheap', label: 'Too cheap' },
      { kind: 'column', key: 'cheap', label: 'Cheap' },
      { kind: 'column', key: 'expensive', label: 'Expensive' },
      { kind: 'column', key: 'too_expensive', label: 'Too expensive' },
    ],
  },
  'Gabor-Granger': {
    label: 'Gabor-Granger',
    route: 'techniques/gabor-granger',
    analysisOp: 'gabor_granger',
    fields: [
      { kind: 'column', key: 'price_column', label: 'Price column' },
      { kind: 'column', key: 'buy_column', label: 'Buy column' },
    ],
  },
  'Brand Funnel': {
    label: 'Brand Funnel',
    route: 'techniques/funnel',
    analysisOp: 'brand_funnel',
    fields: [{ kind: 'columns', key: 'stages', label: 'Stage columns' }],
  },
  'MaxDiff (Count)': {
    label: 'MaxDiff (Count)',
    route: 'techniques/maxdiff/count',
    analysisOp: 'maxdiff_count',
    fields: [
      { kind: 'column', key: 'best_column', label: 'Best column' },
      { kind: 'column', key: 'worst_column', label: 'Worst column' },
    ],
  },
  'MaxDiff (MNL)': {
    label: 'MaxDiff (MNL)',
    route: 'techniques/maxdiff/mnl',
    analysisOp: 'maxdiff_mnl',
    fields: [
      { kind: 'column', key: 'best_column', label: 'Best column' },
      { kind: 'column', key: 'worst_column', label: 'Worst column' },
      { kind: 'columns', key: 'set_columns', label: 'Set columns' },
      { kind: 'columns', key: 'items', label: 'Items' },
    ],
  },
  'MaxDiff (HB)': {
    label: 'MaxDiff (HB)',
    route: 'techniques/maxdiff/hb',
    analysisOp: 'maxdiff_hb',
    fields: [
      { kind: 'column', key: 'best_column', label: 'Best column' },
      { kind: 'column', key: 'worst_column', label: 'Worst column' },
      { kind: 'column', key: 'respondent_column', label: 'Respondent column', optional: true },
      { kind: 'columns', key: 'set_columns', label: 'Set columns', optional: true },
      { kind: 'columns', key: 'items', label: 'Items', optional: true },
    ],
  },
  'Conjoint (MNL)': {
    label: 'Conjoint (MNL)',
    route: 'techniques/conjoint/mnl',
    analysisOp: 'conjoint_mnl',
    fields: [
      { kind: 'column', key: 'chosen_column', label: 'Chosen column' },
      { kind: 'column', key: 'profile_id_column', label: 'Profile ID column' },
      { kind: 'columns', key: 'attribute_columns', label: 'Attribute columns' },
    ],
  },
  'Conjoint (HB)': {
    label: 'Conjoint (HB)',
    route: 'techniques/conjoint/hb',
    analysisOp: 'conjoint_hb',
    fields: [
      { kind: 'column', key: 'chosen_column', label: 'Chosen column' },
      { kind: 'column', key: 'alt_column', label: 'Alternative column' },
      { kind: 'column', key: 'task_column', label: 'Task column' },
      { kind: 'column', key: 'respondent_column', label: 'Respondent column', optional: true },
      { kind: 'columns', key: 'alternatives', label: 'Alternatives', optional: true },
    ],
  },
  'Choice Simulator': {
    label: 'Choice Simulator',
    route: '/datasets/techniques/choice-simulator',
    needsDataset: false,
    analysisOp: 'choice_simulator',
    fields: [
      {
        kind: 'json',
        key: 'utilities',
        label: 'Utilities (JSON object)',
        placeholder: '{"colour=red": 0.5, "colour=blue": 0.2}',
      },
      {
        kind: 'json',
        key: 'profiles',
        label: 'Profiles (JSON array)',
        placeholder: '[{"colour": "red"}, {"colour": "blue"}]',
      },
    ],
  },
};

function buildInitialValues(fields: TechniqueField[]): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.kind === 'columns') values[f.key] = [];
    else if (f.kind === 'number') values[f.key] = f.default ?? 0;
    else values[f.key] = '';
  }
  return values;
}

export function TechniqueDialog({
  children,
  config,
}: {
  children: ReactNode;
  config: TechniqueConfig;
}) {
  const token = getStytchBearerForTensrApi();
  const { toast } = useToast();
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

  const needsDataset = config.needsDataset !== false;
  const [values, setValues] = useState(() => buildInitialValues(config.fields));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const criticalError =
    needsDataset && !datasetId
      ? WORKSPACE_DATASET_REQUIRED
      : !activeTab && needsDataset
        ? 'Please open a dataset first'
        : null;

  const toggleMulti = (key: string, col: string) => {
    setValues(prev => {
      const cur = Array.isArray(prev[key]) ? (prev[key] as string[]) : [];
      return {
        ...prev,
        [key]: cur.includes(col) ? cur.filter(c => c !== col) : [...cur, col],
      };
    });
  };

  const buildBody = (): Record<string, unknown> | null => {
    const body: Record<string, unknown> = {};
    for (const field of config.fields) {
      const raw = values[field.key];
      if (field.kind === 'columns') {
        const cols = Array.isArray(raw) ? (raw as string[]) : [];
        if (!cols.length && !field.optional) {
          setError(`Select at least one column for ${field.label}`);
          return null;
        }
        if (cols.length) body[field.key] = cols;
      } else if (field.kind === 'column') {
        const col = String(raw || '');
        if (!col && !field.optional) {
          setError(`Select ${field.label}`);
          return null;
        }
        if (col) body[field.key] = col;
      } else if (field.kind === 'number') {
        const n = Number(raw);
        if (!Number.isFinite(n) && !field.optional) {
          setError(`Enter a number for ${field.label}`);
          return null;
        }
        if (Number.isFinite(n)) body[field.key] = n;
      } else if (field.kind === 'json') {
        const text = String(raw || '').trim();
        if (!text && !field.optional) {
          setError(`Provide ${field.label}`);
          return null;
        }
        if (text) {
          try {
            body[field.key] = JSON.parse(text);
          } catch {
            setError(`Invalid JSON for ${field.label}`);
            return null;
          }
        }
      } else {
        const text = String(raw || '').trim();
        if (!text && !field.optional) {
          setError(`Enter ${field.label}`);
          return null;
        }
        if (text) body[field.key] = text;
      }
    }
    return body;
  };

  const run = async () => {
    if (needsDataset && !datasetId) {
      setError(WORKSPACE_DATASET_REQUIRED);
      return;
    }
    const body = buildBody();
    if (!body) return;

    setBusy(true);
    setError(null);
    try {
      const path = needsDataset
        ? `/datasets/${datasetId}/${config.route}`
        : config.route.startsWith('/')
          ? config.route
          : `/datasets/${config.route}`;
      const res = await fetch(tensrApiUrl(path), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const result = (await res.json()) as Record<string, unknown>;
      console.info(`[${config.label}]`, result);
      toast({
        title: config.label,
        description:
          result.ok === false ? String(result.reason || 'Completed with errors') : 'Result ready',
      });
      if (datasetId) {
        openAnalysisResultTab({
          op: config.analysisOp,
          envelope: { result } as import('@/lib/analysis-report-types').AnalyzeResponse,
          parameters: body,
          sourceDatasetId: datasetId,
          sourceTabName: activeTab?.name,
        });
      }
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
          <DialogTitle>{config.label}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          {config.fields.map(field => {
            if (field.kind === 'columns') {
              const selected = Array.isArray(values[field.key])
                ? (values[field.key] as string[])
                : [];
              return (
                <div key={field.key} className="space-y-2">
                  <Label>
                    {field.label}
                    {field.optional ? ' (optional)' : ''}
                  </Label>
                  <div className="grid max-h-32 gap-2 overflow-y-auto rounded-sm border p-2">
                    {columnNames.map(col => (
                      <div key={col} className="flex items-center space-x-2">
                        <Checkbox
                          id={`${config.analysisOp}-${field.key}-${col}`}
                          checked={selected.includes(col)}
                          onCheckedChange={() => toggleMulti(field.key, col)}
                        />
                        <Label
                          htmlFor={`${config.analysisOp}-${field.key}-${col}`}
                          className="cursor-pointer"
                        >
                          {col}
                        </Label>
                      </div>
                    ))}
                    {!columnNames.length && (
                      <div className="text-sm text-muted-foreground">No columns available</div>
                    )}
                  </div>
                </div>
              );
            }
            if (field.kind === 'column') {
              return (
                <div key={field.key} className="space-y-2">
                  <Label>
                    {field.label}
                    {field.optional ? ' (optional)' : ''}
                  </Label>
                  <Select
                    value={String(values[field.key] || '') || undefined}
                    onValueChange={v => setValues(prev => ({ ...prev, [field.key]: v }))}
                    disabled={!!criticalError}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select column" />
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
              );
            }
            if (field.kind === 'number') {
              return (
                <div key={field.key} className="space-y-2">
                  <Label>{field.label}</Label>
                  <Input
                    type="number"
                    value={String(values[field.key] ?? '')}
                    onChange={e =>
                      setValues(prev => ({ ...prev, [field.key]: Number(e.target.value) }))
                    }
                  />
                </div>
              );
            }
            if (field.kind === 'json') {
              return (
                <div key={field.key} className="space-y-2">
                  <Label>{field.label}</Label>
                  <textarea
                    className="min-h-[80px] w-full rounded-sm border p-2 text-sm font-mono"
                    placeholder={field.placeholder}
                    value={String(values[field.key] ?? '')}
                    onChange={e => setValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                  />
                </div>
              );
            }
            return (
              <div key={field.key} className="space-y-2">
                <Label>{field.label}</Label>
                <Input
                  placeholder={field.placeholder}
                  value={String(values[field.key] ?? '')}
                  onChange={e => setValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                />
              </div>
            );
          })}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter>
          <Button onClick={() => void run()} disabled={busy || !!criticalError}>
            {busy ? <Loader className="h-4 w-4 animate-spin" /> : 'Run'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function createTechniqueDialog(label: string) {
  const config = TECHNIQUE_CONFIGS[label];
  if (!config) {
    return ({ children }: { children: ReactNode }) => <>{children}</>;
  }
  const Bound = ({ children }: { children: ReactNode }) => (
    <TechniqueDialog config={config}>{children}</TechniqueDialog>
  );
  Bound.displayName = `TechniqueDialog(${label})`;
  return Bound;
}
