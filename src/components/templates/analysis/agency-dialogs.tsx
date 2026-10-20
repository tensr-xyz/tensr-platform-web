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
import { Checkbox } from '@/components/atoms/checkbox';
import { Input } from '@/components/atoms/input';
import { Label } from '@/components/atoms/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/select';
import { Textarea } from '@/components/atoms/text-area';
import { ChoiceModellingDialog } from '@/components/templates/analysis/choice-modelling';
import { apiClient } from '@/lib/api-client';
import {
  isTechniqueRun,
  openSurveyTechniqueReport,
  techniqueRun,
} from '@/lib/survey-technique-report';
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

function ColumnSelect({
  value,
  onValueChange,
  columns,
  emptyLabel = 'Select',
}: {
  value: string;
  onValueChange: (value: string) => void;
  columns: string[];
  emptyLabel?: string;
}) {
  return (
    <Select
      value={value || '__none__'}
      onValueChange={next => onValueChange(next === '__none__' ? '' : next)}
    >
      <SelectTrigger className="w-full text-sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">{emptyLabel}</SelectItem>
        {columns.map(column => (
          <SelectItem key={column} value={column}>
            {column}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
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
  const { tabs, activeTabId } = useTabsStore();
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
                if (isTechniqueRun(out)) {
                  const datasetId = getDatasetIdFromTab(tabs.find(t => t.id === activeTabId));
                  if (!datasetId) throw new Error(WORKSPACE_DATASET_REQUIRED);
                  openSurveyTechniqueReport({
                    datasetId,
                    op: out.reportRequest.op,
                    parameters: out.reportRequest.parameters,
                    response: out.payload,
                    sourceTabName: tabs.find(t => t.id === activeTabId)?.name,
                  });
                  setResult(null);
                  setOpen(false);
                  return;
                }
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
        <ColumnSelect value={stub} onValueChange={setStub} columns={columns} />
        <Label>Banner</Label>
        <ColumnSelect value={banner} onValueChange={setBanner} columns={columns} />
        <Label>Nest (optional)</Label>
        <ColumnSelect value={nest} onValueChange={setNest} columns={columns} emptyLabel="None" />
        <Label>Statistic</Label>
        <Select value={stat} onValueChange={setStat}>
          <SelectTrigger className="w-full text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="column_proportion">Column %</SelectItem>
            <SelectItem value="row_proportion">Row %</SelectItem>
          </SelectContent>
        </Select>
        <Label>Multiple response %</Label>
        <Select value={mr} onValueChange={setMr}>
          <SelectTrigger className="w-full text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="respondents">% respondents</SelectItem>
            <SelectItem value="responses">% responses</SelectItem>
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={grids} onCheckedChange={checked => setGrids(checked === true)} />
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
        <ColumnSelect value={column} onValueChange={setColumn} columns={columns} />
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
        const parameters = {
          dataset_ids: [datasetId, other],
          wave_names: ['wave_1', 'wave_2'],
        };
        const payload = await apiClient.datasets.intake.fuseDatasets(parameters);
        return techniqueRun(payload, { op: 'fuse_waves', parameters });
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
        const parameters = {
          banner: [{ column: banner }],
          stub_columns: columns.filter(c => c !== banner),
          sort_by_significance: true,
        };
        const payload = await apiClient.datasets.tables.batch(datasetId, parameters);
        return techniqueRun(payload, { op: 'batch_tables', parameters });
      }}
    >
      <div className="space-y-3">
        <Label>Banner</Label>
        <ColumnSelect value={banner} onValueChange={setBanner} columns={columns} />
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
  const [codes, setCodes] = useState('[]');
  const [useModel, setUseModel] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [notice, setNotice] = useState(
    'Propose a codeframe, edit or merge codes, then apply. Verbatims stay here unless you opt in.'
  );
  return (
    <AgencyDialog
      title="Open-text coding"
      trigger={children}
      onRun={async () => {
        if (!datasetId) throw new Error(WORKSPACE_DATASET_REQUIRED);
        const parsed = JSON.parse(codes) as Array<Record<string, unknown>>;
        let jobId: string | undefined;
        let payload: Record<string, unknown> = {};
        do {
          payload = await apiClient.datasets.openEnd.apply(datasetId, {
            text_column: text,
            codes: parsed,
            job_id: jobId,
          });
          jobId = typeof payload.job_id === 'string' ? payload.job_id : undefined;
        } while (payload.done === false && jobId);
        return techniqueRun(payload, {
          op: 'open_end_coding',
          parameters: { text_column: text },
        });
      }}
    >
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">{notice}</p>
        <Label>Text column</Label>
        <ColumnSelect value={text} onValueChange={setText} columns={columns} />
        <label className="flex items-center gap-2 text-xs">
          <Checkbox checked={useModel} onCheckedChange={checked => setUseModel(checked === true)} />
          Suggest codes with the model
        </label>
        {useModel ? (
          <label className="flex items-center gap-2 text-xs">
            <Checkbox
              checked={confirmSend}
              onCheckedChange={checked => setConfirmSend(checked === true)}
            />
            Verbatims are sent to the model
          </label>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-auto px-2 py-1 text-xs"
          onClick={async () => {
            if (!datasetId || !text) return;
            const proposed = await apiClient.datasets.openEnd.propose(datasetId, {
              text_column: text,
              use_model: useModel,
              confirm_verbatims_sent: confirmSend,
            });
            setCodes(JSON.stringify(proposed.codes ?? [], null, 2));
            if (typeof proposed.notice === 'string') setNotice(proposed.notice);
          }}
        >
          Propose codeframe
        </Button>
        <Label>Codes (edit, merge, or split before apply)</Label>
        <Textarea
          className="min-h-28 w-full font-mono text-xs"
          value={codes}
          onChange={e => setCodes(e.target.value)}
        />
      </div>
    </AgencyDialog>
  );
}

function TechniqueColumnDialog({
  title,
  path,
  analysisOp,
  fields,
  children,
}: {
  title: string;
  path: string;
  analysisOp: string;
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
        const payload = await apiClient.datasets.techniques.run(datasetId, path, body);
        return techniqueRun(payload, { op: analysisOp, parameters: body });
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
              <ColumnSelect
                value={values[field.key] || ''}
                onValueChange={next => setValues(v => ({ ...v, [field.key]: next }))}
                columns={columns}
              />
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
    analysisOp="turf"
    fields={[{ key: 'items', label: 'Items', multi: true }]}
  >
    {children}
  </TechniqueColumnDialog>
);
export const DriversDialog = ({ children }: { children: ReactNode }) => (
  <TechniqueColumnDialog
    title="Driver Analysis"
    path="drivers"
    analysisOp="drivers"
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
    analysisOp="correspondence"
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
    analysisOp="van_westendorp"
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
    analysisOp="gabor_granger"
    fields={[
      { key: 'price_column', label: 'Price' },
      { key: 'buy_column', label: 'Buy' },
    ]}
  >
    {children}
  </TechniqueColumnDialog>
);
export const NpsDialog = ({ children }: { children: ReactNode }) => (
  <TechniqueColumnDialog
    title="NPS"
    path="nps"
    analysisOp="nps"
    fields={[{ key: 'score_column', label: 'Score' }]}
  >
    {children}
  </TechniqueColumnDialog>
);
export const FunnelDialog = ({ children }: { children: ReactNode }) => (
  <TechniqueColumnDialog
    title="Brand Funnel"
    path="funnel"
    analysisOp="funnel"
    fields={[{ key: 'stages', label: 'Stage columns', multi: true }]}
  >
    {children}
  </TechniqueColumnDialog>
);

export function MaxDiffDialog({ children }: { children: ReactNode }) {
  return <ChoiceModellingDialog mode="maxdiff">{children}</ChoiceModellingDialog>;
}

export function ConjointDialog({ children }: { children: ReactNode }) {
  return <ChoiceModellingDialog mode="cbc">{children}</ChoiceModellingDialog>;
}
