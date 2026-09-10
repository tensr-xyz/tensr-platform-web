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
import { apiClient } from '@/lib/api-client';
import { getDatasetIdFromTab, WORKSPACE_DATASET_REQUIRED } from '@/lib/workspace-dataset';
import { LINEAGE_HIDDEN_COLUMNS } from '@/lib/adopt-derived-dataset';
import { useTabsStore } from '@/stores/tabs-store';

function useWorkspaceColumns() {
  const { tabs, activeTabId } = useTabsStore();
  const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId), [tabs, activeTabId]);
  const datasetId = getDatasetIdFromTab(activeTab);
  const columns = useMemo(() => {
    if (!activeTab?.data?.initialColumns) return [];
    return activeTab.data.initialColumns
      .map(c => c.id)
      .filter(id => !LINEAGE_HIDDEN_COLUMNS.has(id));
  }, [activeTab?.data?.initialColumns]);
  return { datasetId, columns };
}

function AgencyDialog({
  title,
  trigger,
  children: fields,
  onRun,
}: {
  title: string;
  trigger: ReactNode;
  children: ReactNode;
  onRun: () => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {fields}
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {result ? <pre className="max-h-48 overflow-auto text-xs">{result}</pre> : null}
        <DialogFooter>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                const out = await onRun();
                setResult(JSON.stringify(out, null, 2));
              } catch (err) {
                setError(err instanceof Error ? err.message : String(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? 'Running…' : 'Run'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CustomTablesDialog({ children }: { children: ReactNode }) {
  const { datasetId, columns } = useWorkspaceColumns();
  const [stub, setStub] = useState('');
  const [banner, setBanner] = useState('');
  const [nest, setNest] = useState('');
  const [specId, setSpecId] = useState<string | null>(null);
  const [stat, setStat] = useState('column_proportion');
  const [mr, setMr] = useState('respondents');
  const [grids, setGrids] = useState(true);
  return (
    <AgencyDialog
      title="Custom Tables"
      trigger={children}
      onRun={async () => {
        if (!datasetId) throw new Error(WORKSPACE_DATASET_REQUIRED);
        if (!stub || !banner) throw new Error('Choose a stub and a banner');
        const bannerSpec: Record<string, unknown> = { column: banner };
        if (nest) bannerSpec.nested = [{ column: nest }];
        const out = await apiClient.datasets.tables.create(datasetId, {
          stubs: [{ column: stub }],
          banner: [bannerSpec],
          statistics: [stat],
          mr_percent: mr,
          flatten_grids: grids,
          nest_banners: Boolean(nest),
        });
        setSpecId(out.spec?.id || out.spec_id || null);
        return out;
      }}
    >
      <div className="space-y-3">
        <Label>Stub</Label>
        <select
          className="w-full rounded border p-2 text-sm"
          value={stub}
          onChange={e => setStub(e.target.value)}
        >
          <option value="">Select</option>
          {columns.map(c => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <Label>Banner</Label>
        <select
          className="w-full rounded border p-2 text-sm"
          value={banner}
          onChange={e => setBanner(e.target.value)}
        >
          <option value="">Select</option>
          {columns.map(c => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <Label>Nest (optional)</Label>
        <select
          className="w-full rounded border p-2 text-sm"
          value={nest}
          onChange={e => setNest(e.target.value)}
        >
          <option value="">None</option>
          {columns.map(c => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <Label>Statistic</Label>
        <select
          className="w-full rounded border p-2 text-sm"
          value={stat}
          onChange={e => setStat(e.target.value)}
        >
          <option value="column_proportion">Column %</option>
          <option value="row_proportion">Row %</option>
        </select>
        <Label>Multiple response %</Label>
        <select
          className="w-full rounded border p-2 text-sm"
          value={mr}
          onChange={e => setMr(e.target.value)}
        >
          <option value="respondents">% respondents</option>
          <option value="responses">% responses</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={grids} onChange={e => setGrids(e.target.checked)} />
          Flatten grids
        </label>
        {specId && datasetId ? (
          <div className="flex flex-wrap gap-2 text-sm">
            <Button
              type="button"
              variant="outline"
              onClick={() => apiClient.datasets.tables.refresh(datasetId, specId)}
            >
              Refresh
            </Button>
            {(['xlsx', 'pptx', 'docx'] as const).map(kind => (
              <a key={kind} href={apiClient.datasets.tables.exportUrl(datasetId, specId, kind)}>
                {kind.toUpperCase()}
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </AgencyDialog>
  );
}

export function RakeWeightsDialog({ children }: { children: ReactNode }) {
  const { datasetId, columns } = useWorkspaceColumns();
  const [column, setColumn] = useState('');
  const [targets, setTargets] = useState('{"Male": 0.5, "Female": 0.5}');
  return (
    <AgencyDialog
      title="Rake Weights"
      trigger={children}
      onRun={async () => {
        if (!datasetId) throw new Error(WORKSPACE_DATASET_REQUIRED);
        return apiClient.datasets.weights.rake(datasetId, {
          categorical_targets: { [column]: JSON.parse(targets) },
        });
      }}
    >
      <div className="space-y-3">
        <Label>Category column</Label>
        <select
          className="w-full rounded border p-2 text-sm"
          value={column}
          onChange={e => setColumn(e.target.value)}
        >
          <option value="">Select</option>
          {columns.map(c => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <Label>Targets JSON</Label>
        <Input value={targets} onChange={e => setTargets(e.target.value)} />
      </div>
    </AgencyDialog>
  );
}

export function FuseWavesDialog({ children }: { children: ReactNode }) {
  const { datasetId } = useWorkspaceColumns();
  const [other, setOther] = useState('');
  return (
    <AgencyDialog
      title="Fuse Waves"
      trigger={children}
      onRun={async () => {
        if (!datasetId) throw new Error(WORKSPACE_DATASET_REQUIRED);
        if (!other) throw new Error('Second dataset id required');
        return apiClient.datasets.intake.fuseDatasets({
          dataset_ids: [datasetId, other],
          wave_names: ['wave_1', 'wave_2'],
        });
      }}
    >
      <div className="space-y-3">
        <Label>Other dataset id</Label>
        <Input value={other} onChange={e => setOther(e.target.value)} />
      </div>
    </AgencyDialog>
  );
}

export function BatchTablesDialog({ children }: { children: ReactNode }) {
  const { datasetId, columns } = useWorkspaceColumns();
  const [banner, setBanner] = useState('');
  return (
    <AgencyDialog
      title="Batch Tables"
      trigger={children}
      onRun={async () => {
        if (!datasetId) throw new Error(WORKSPACE_DATASET_REQUIRED);
        return apiClient.datasets.tables.batch(datasetId, {
          banner: [{ column: banner }],
          stub_columns: columns.filter(c => c !== banner),
          sort_by_significance: true,
        });
      }}
    >
      <div className="space-y-3">
        <Label>Banner</Label>
        <select
          className="w-full rounded border p-2 text-sm"
          value={banner}
          onChange={e => setBanner(e.target.value)}
        >
          <option value="">Select</option>
          {columns.map(c => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          One banner × every other question. Smart Tables is sort/cull by significance.
        </p>
      </div>
    </AgencyDialog>
  );
}

export function OpenTextCodingDialog({ children }: { children: ReactNode }) {
  const { datasetId, columns } = useWorkspaceColumns();
  const [text, setText] = useState('');
  const [lexicon, setLexicon] = useState(
    '{"price": ["expensive", "cost"], "quality": ["quality"]}'
  );
  return (
    <AgencyDialog
      title="Open-text coding"
      trigger={children}
      onRun={async () => {
        if (!datasetId) throw new Error(WORKSPACE_DATASET_REQUIRED);
        return apiClient.datasets.techniques.run(datasetId, 'code-open-text', {
          text_column: text,
          lexicon: JSON.parse(lexicon),
        });
      }}
    >
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">Keyword lexicon. This is not NLP.</p>
        <Label>Text column</Label>
        <select
          className="w-full rounded border p-2 text-sm"
          value={text}
          onChange={e => setText(e.target.value)}
        >
          <option value="">Select</option>
          {columns.map(c => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <Label>Lexicon JSON</Label>
        <Input value={lexicon} onChange={e => setLexicon(e.target.value)} />
      </div>
    </AgencyDialog>
  );
}

function TechniqueColumnDialog({
  title,
  path,
  fields,
  children,
}: {
  title: string;
  path: string;
  fields: { key: string; label: string; multi?: boolean }[];
  children: ReactNode;
}) {
  const { datasetId, columns } = useWorkspaceColumns();
  const [values, setValues] = useState<Record<string, string>>({});
  return (
    <AgencyDialog
      title={title}
      trigger={children}
      onRun={async () => {
        if (!datasetId) throw new Error(WORKSPACE_DATASET_REQUIRED);
        const body: Record<string, unknown> = {};
        for (const field of fields) {
          body[field.key] = field.multi
            ? (values[field.key] || '')
                .split(',')
                .map(s => s.trim())
                .filter(Boolean)
            : values[field.key];
        }
        return apiClient.datasets.techniques.run(datasetId, path, body);
      }}
    >
      <div className="space-y-3">
        {fields.map(field => (
          <div key={field.key}>
            <Label>{field.label}</Label>
            {field.multi ? (
              <Input
                placeholder="col_a, col_b"
                value={values[field.key] || ''}
                onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))}
              />
            ) : (
              <select
                className="w-full rounded border p-2 text-sm"
                value={values[field.key] || ''}
                onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))}
              >
                <option value="">Select</option>
                {columns.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}
          </div>
        ))}
      </div>
    </AgencyDialog>
  );
}

export const TurfDialog = ({ children }: { children: ReactNode }) => (
  <TechniqueColumnDialog
    title="TURF"
    path="turf"
    fields={[{ key: 'items', label: 'Items', multi: true }]}
  >
    {children}
  </TechniqueColumnDialog>
);
export const DriversDialog = ({ children }: { children: ReactNode }) => (
  <TechniqueColumnDialog
    title="Driver Analysis"
    path="drivers"
    fields={[
      { key: 'outcome', label: 'Outcome' },
      { key: 'drivers', label: 'Drivers', multi: true },
    ]}
  >
    {children}
  </TechniqueColumnDialog>
);
export const CorrespondenceDialog = ({ children }: { children: ReactNode }) => (
  <TechniqueColumnDialog
    title="Correspondence Analysis"
    path="correspondence"
    fields={[
      { key: 'row_column', label: 'Row' },
      { key: 'column_column', label: 'Column' },
    ]}
  >
    {children}
  </TechniqueColumnDialog>
);
export const VanWestendorpDialog = ({ children }: { children: ReactNode }) => (
  <TechniqueColumnDialog
    title="Van Westendorp"
    path="van-westendorp"
    fields={[
      { key: 'too_cheap', label: 'Too cheap' },
      { key: 'cheap', label: 'Cheap' },
      { key: 'expensive', label: 'Expensive' },
      { key: 'too_expensive', label: 'Too expensive' },
    ]}
  >
    {children}
  </TechniqueColumnDialog>
);
export const GaborGrangerDialog = ({ children }: { children: ReactNode }) => (
  <TechniqueColumnDialog
    title="Gabor-Granger"
    path="gabor-granger"
    fields={[
      { key: 'price_column', label: 'Price' },
      { key: 'buy_column', label: 'Buy' },
    ]}
  >
    {children}
  </TechniqueColumnDialog>
);
export const NpsDialog = ({ children }: { children: ReactNode }) => (
  <TechniqueColumnDialog title="NPS" path="nps" fields={[{ key: 'score_column', label: 'Score' }]}>
    {children}
  </TechniqueColumnDialog>
);
export const FunnelDialog = ({ children }: { children: ReactNode }) => (
  <TechniqueColumnDialog
    title="Brand Funnel"
    path="funnel"
    fields={[{ key: 'stages', label: 'Stage columns', multi: true }]}
  >
    {children}
  </TechniqueColumnDialog>
);

export function MaxDiffDialog({ children }: { children: ReactNode }) {
  const { datasetId, columns } = useWorkspaceColumns();
  const [best, setBest] = useState('');
  const [worst, setWorst] = useState('');
  const [items, setItems] = useState('');
  const [mode, setMode] = useState<'count' | 'mnl'>('count');
  return (
    <AgencyDialog
      title="MaxDiff (counting / MNL)"
      trigger={children}
      onRun={async () => {
        if (!datasetId) throw new Error(WORKSPACE_DATASET_REQUIRED);
        if (mode === 'count') {
          return apiClient.datasets.techniques.run(datasetId, 'maxdiff/count', {
            best_column: best,
            worst_column: worst,
          });
        }
        const itemList = items
          .split(',')
          .map(s => s.trim())
          .filter(Boolean);
        return apiClient.datasets.techniques.run(datasetId, 'maxdiff/mnl', {
          best_column: best,
          worst_column: worst,
          set_columns: columns.filter(c => c.startsWith('set_')),
          items: itemList,
        });
      }}
    >
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Hierarchical Bayes is not offered. Counting or MNL only.
        </p>
        <select
          className="w-full rounded border p-2 text-sm"
          value={mode}
          onChange={e => setMode(e.target.value as 'count' | 'mnl')}
        >
          <option value="count">Counting</option>
          <option value="mnl">MNL</option>
        </select>
        <Label>Best</Label>
        <select
          className="w-full rounded border p-2 text-sm"
          value={best}
          onChange={e => setBest(e.target.value)}
        >
          <option value="">Select</option>
          {columns.map(c => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <Label>Worst</Label>
        <select
          className="w-full rounded border p-2 text-sm"
          value={worst}
          onChange={e => setWorst(e.target.value)}
        >
          <option value="">Select</option>
          {columns.map(c => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {mode === 'mnl' ? (
          <>
            <Label>Items (comma-separated)</Label>
            <Input value={items} onChange={e => setItems(e.target.value)} />
          </>
        ) : null}
      </div>
    </AgencyDialog>
  );
}

export function ConjointDialog({ children }: { children: ReactNode }) {
  const { datasetId, columns } = useWorkspaceColumns();
  const [chosen, setChosen] = useState('');
  const [profile, setProfile] = useState('');
  const [attrs, setAttrs] = useState('');
  return (
    <AgencyDialog
      title="Conjoint (MNL)"
      trigger={children}
      onRun={async () => {
        if (!datasetId) throw new Error(WORKSPACE_DATASET_REQUIRED);
        return apiClient.datasets.techniques.run(datasetId, 'conjoint/mnl', {
          chosen_column: chosen,
          profile_id_column: profile,
          attribute_columns: attrs
            .split(',')
            .map(s => s.trim())
            .filter(Boolean),
        });
      }}
    >
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">MNL only. HB is not offered.</p>
        <Label>Chosen</Label>
        <select
          className="w-full rounded border p-2 text-sm"
          value={chosen}
          onChange={e => setChosen(e.target.value)}
        >
          <option value="">Select</option>
          {columns.map(c => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <Label>Profile id</Label>
        <select
          className="w-full rounded border p-2 text-sm"
          value={profile}
          onChange={e => setProfile(e.target.value)}
        >
          <option value="">Select</option>
          {columns.map(c => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <Label>Attributes (comma-separated)</Label>
        <Input value={attrs} onChange={e => setAttrs(e.target.value)} />
      </div>
    </AgencyDialog>
  );
}
