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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/select';
import { getAccessToken } from '@/utils/auth';
import { LINEAGE_HIDDEN_COLUMNS } from '@/lib/adopt-derived-dataset';
import {
  getDatasetIdFromTab,
  resolveSpreadsheetContextTab,
  WORKSPACE_DATASET_REQUIRED,
} from '@/lib/workspace-dataset';
import { useTabsStore } from '@/stores/tabs-store';
import {
  downloadTableExport,
  getSavedTable,
  listDatasetVersions,
  listSavedTables,
  previewCustomTable,
  runCustomTable,
} from '@/lib/custom-tables/api';
import { netPreset, NET_HELPER_COPY, type NetPresetId } from '@/lib/custom-tables/nets';
import {
  netUnionReconciles,
  resolveCompleteCell,
  type CellClickResult,
} from '@/lib/custom-tables/click-through';
import { exportAuditCopy, exportTraceFromBook } from '@/lib/custom-tables/export';
import { displayBannerTable, type BannerBook, type DisplayCell } from '@/lib/custom-tables/render';
import {
  addBannerQuestion,
  addStubQuestion,
  applyNetToStub,
  bannerColumnProduct,
  buildTableRequest,
  canvasFromStoredSpec,
  defaultCanvas,
  resetBuilderSurface,
  moveCategory,
  nestUnderBanner,
  savedSpecLabel,
  type CustomTableCanvas,
  type SavedTableSpecRow,
  type StoredTableSpec,
} from '@/lib/custom-tables/spec';
import {
  pickRunDatasetId,
  WEIGHT_CROSSTAB_COPY,
  weightPickerOptions,
  type WeightOption,
} from '@/lib/custom-tables/weight';

export function CustomTablesDialog({ children }: { children: ReactNode }) {
  const token = getAccessToken();
  const { tabs, activeTabId } = useTabsStore();
  const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId), [tabs, activeTabId]);
  const sheetTab = useMemo(
    () => resolveSpreadsheetContextTab(tabs, activeTab) ?? activeTab,
    [tabs, activeTab]
  );
  const datasetId = getDatasetIdFromTab(sheetTab) ?? getDatasetIdFromTab(activeTab);
  const [open, setOpen] = useState(false);
  const [canvas, setCanvas] = useState<CustomTableCanvas>(defaultCanvas);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [book, setBook] = useState<BannerBook | null>(null);
  const [weightOptions, setWeightOptions] = useState<WeightOption[]>([]);
  const [weightChoice, setWeightChoice] = useState<string>('');
  const [previewWarning, setPreviewWarning] = useState<string | null>(null);
  const [savedSpecs, setSavedSpecs] = useState<SavedTableSpecRow[]>([]);
  const [activeSpecId, setActiveSpecId] = useState<string | null>(null);
  const [cellClick, setCellClick] = useState<string | null>(null);

  const columns = useMemo(() => {
    if (!sheetTab?.data?.initialColumns) return [];
    return sheetTab.data.initialColumns
      .map(c => ({ id: c.id, label: c.header || c.id }))
      .filter(c => !LINEAGE_HIDDEN_COLUMNS.has(c.id));
  }, [sheetTab?.data?.initialColumns]);

  const rows = useMemo(() => sheetTab?.data?.initialData || [], [sheetTab?.data?.initialData]);

  const runDatasetId = useMemo(() => {
    const selected = weightOptions.find(o => o.datasetId === weightChoice);
    return selected ? pickRunDatasetId(selected) : weightChoice || datasetId || '';
  }, [weightOptions, weightChoice, datasetId]);

  const refreshSavedSpecs = async (targetId: string) => {
    if (!targetId) {
      setSavedSpecs([]);
      return;
    }
    try {
      const listed = await listSavedTables(targetId, token);
      setSavedSpecs(listed.specs || []);
    } catch {
      setSavedSpecs([]);
    }
  };

  useEffect(() => {
    if (!open || !datasetId) return;
    let cancelled = false;
    void listDatasetVersions(datasetId, token)
      .then(res => {
        if (cancelled) return;
        const opts = weightPickerOptions(res.versions || [], datasetId);
        setWeightOptions(opts);
        const current = opts.find(o => o.datasetId === datasetId) || opts[0];
        setWeightChoice(current?.datasetId || datasetId);
      })
      .catch(() => {
        if (cancelled) return;
        setWeightOptions([]);
        setWeightChoice(datasetId);
      });
    return () => {
      cancelled = true;
    };
  }, [open, datasetId, token]);

  useEffect(() => {
    if (!open || !runDatasetId) return;
    void refreshSavedSpecs(runDatasetId);
  }, [open, runDatasetId, token]);

  const product = bannerColumnProduct(canvas.banners, canvas.nestBanners);
  const largeBanner = product > 16;

  const dropColumn = (zone: 'stub' | 'banner' | `nest:${number}`, column: string) => {
    if (zone === 'stub') setCanvas(c => addStubQuestion(c, column, rows));
    else if (zone === 'banner') setCanvas(c => addBannerQuestion(c, column, rows));
    else {
      const idx = Number(zone.split(':')[1]);
      setCanvas(c => nestUnderBanner(c, idx, column, rows));
    }
  };

  const addNet = (stubIndex: number, kind: NetPresetId) => {
    const stub = canvas.stubs[stubIndex];
    if (!stub) return;
    const net = netPreset(kind, stub.values);
    if (!net) {
      setError(`No ${kind === 'top2' ? 'top-2-box' : kind} categories on ${stub.column}.`);
      return;
    }
    setError(null);
    setCanvas(c => applyNetToStub(c, stubIndex, net));
  };

  const run = async () => {
    if (!datasetId) {
      setError(WORKSPACE_DATASET_REQUIRED);
      return;
    }
    if (!canvas.stubs.length || !canvas.banners.length) {
      setError('Drop at least one Stub (rows) question and one Banner (columns) question.');
      return;
    }
    setBusy(true);
    setError(null);
    setPreviewWarning(null);
    const body = buildTableRequest(canvas);
    const runId = runDatasetId;
    try {
      const preview = await previewCustomTable(runId, body, token);
      const warn = (preview.warnings || [])
        .map(w => w.message)
        .filter(Boolean)
        .join(' ');
      if (warn) setPreviewWarning(warn);
      const result = (await runCustomTable(runId, body, token)) as BannerBook & {
        spec?: StoredTableSpec;
      };
      setBook(result);
      setActiveSpecId(String(result.spec?.id || '') || null);
      setCellClick(null);
      await refreshSavedSpecs(runId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Table failed');
    } finally {
      setBusy(false);
    }
  };

  const reopen = async (row: SavedTableSpecRow) => {
    const specId = row.spec_id || row.id;
    const targetId = row.dataset_id || runDatasetId;
    if (!specId || !targetId) return;
    setBusy(true);
    setError(null);
    setPreviewWarning(null);
    try {
      const result = (await getSavedTable(targetId, specId, token)) as BannerBook & {
        spec?: StoredTableSpec;
      };
      setBook(result);
      setActiveSpecId(specId);
      setCellClick(null);
      if (result.spec) setCanvas(c => canvasFromStoredSpec(result.spec as StoredTableSpec, c));
    } catch (e) {
      setBook(null);
      setError(e instanceof Error ? e.message : 'Could not reopen table');
    } finally {
      setBusy(false);
    }
  };

  const table = book ? displayBannerTable(book) : null;
  const exportTrace = book ? exportTraceFromBook(book) : null;
  const originOrder = book?.row_uid_order || [];

  const clickCell = (cell: DisplayCell, stubLabel: string) => {
    const resolved: CellClickResult = resolveCompleteCell(
      { kind: cell.kind, unweighted_n: cell.unweighted_n, provenance: cell.provenance },
      originOrder
    );
    if (resolved.kind !== 'complete') {
      setCellClick(
        `Click-through is complete-only. This cell is ${resolved.kind}: ${resolved.reason}.`
      );
      return;
    }
    const netNote =
      cell.kind === 'net'
        ? netUnionReconciles(
            { kind: cell.kind, unweighted_n: cell.unweighted_n, provenance: cell.provenance },
            originOrder
          )
          ? ` Net union n=${resolved.n} reconciles with the cell count.`
          : ` Net union n=${resolved.n} does not reconcile with the cell count.`
        : '';
    setCellClick(`${stubLabel}: ${resolved.n} origin respondents.${netNote}`);
  };

  const exportBook = async (kind: 'xlsx' | 'pptx') => {
    if (!activeSpecId || !runDatasetId) {
      setError('Run and save a table before exporting.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await downloadTableExport(runDatasetId, activeSpecId, kind, token);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        setOpen(next);
        if (!next) {
          setBook(null);
          setError(null);
          setCanvas(defaultCanvas());
        }
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>Custom Tables</DialogTitle>
        </DialogHeader>
        <div className="flex min-h-[280px] flex-col gap-3">
          <div className="flex min-h-0 flex-1 gap-3">
            <aside className="w-[28%] shrink-0 overflow-hidden rounded-md border border-border bg-muted/20">
              <p className="border-b border-border px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Variables
              </p>
              <ul className="max-h-[360px] overflow-y-auto p-1 text-xs">
                {columns.map(col => (
                  <li
                    key={col.id}
                    draggable
                    onDragStart={e => e.dataTransfer.setData('text/plain', col.id)}
                    className="cursor-grab rounded px-2 py-1 hover:bg-muted/60"
                  >
                    <span className="font-medium">{col.label}</span>
                    {col.label !== col.id ? (
                      <span className="ml-1 text-[10px] text-muted-foreground">({col.id})</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </aside>
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <DropZone label="Stub (rows)" onDropColumn={column => dropColumn('stub', column)}>
                {canvas.stubs.map((stub, i) => (
                  <QuestionCard
                    key={stub.column}
                    title={stub.column}
                    values={stub.values}
                    nets={stub.nets.map(n => n.label)}
                    onMove={(from, to) => setCanvas(c => moveCategory(c, 'stub', i, from, to))}
                    onNet={kind => addNet(i, kind)}
                  />
                ))}
              </DropZone>
              <DropZone
                label="Banner (columns)"
                onDropColumn={column => dropColumn('banner', column)}
              >
                {canvas.banners.map((banner, i) => (
                  <div key={banner.column} className="space-y-1">
                    <QuestionCard
                      title={banner.column}
                      values={banner.values}
                      onMove={(from, to) => setCanvas(c => moveCategory(c, 'banner', i, from, to))}
                    />
                    {canvas.nestBanners ? (
                      <DropZone
                        label="Nest under this span"
                        compact
                        onDropColumn={column => dropColumn(`nest:${i}`, column)}
                      >
                        {banner.nested.map(nested => (
                          <p key={nested.column} className="text-[11px]">
                            └ {nested.column}
                          </p>
                        ))}
                      </DropZone>
                    ) : null}
                  </div>
                ))}
              </DropZone>
            </div>
          </div>
          <div className="grid gap-3 border-t border-border pt-3 text-xs sm:grid-cols-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={canvas.columnPercent}
                onChange={e => setCanvas(c => ({ ...c, columnPercent: e.target.checked }))}
              />
              Column %
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={canvas.rowPercent}
                onChange={e => setCanvas(c => ({ ...c, rowPercent: e.target.checked }))}
              />
              Row %
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={canvas.nestBanners}
                onChange={e => setCanvas(c => ({ ...c, nestBanners: e.target.checked }))}
              />
              Nest banners (uncheck for side by side / overlapping)
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={canvas.significanceDisplay === 'column_letters'}
                onChange={e =>
                  setCanvas(c => ({
                    ...c,
                    significanceDisplay: e.target.checked ? 'column_letters' : 'cell_comparisons',
                  }))
                }
              />
              Column letters
            </label>
            <div className="sm:col-span-2">
              <Label className="text-[10px] uppercase text-muted-foreground">Weight</Label>
              <Select value={weightChoice} onValueChange={setWeightChoice}>
                <SelectTrigger className="mt-1 h-8 text-xs">
                  <SelectValue placeholder="Unweighted (original file)" />
                </SelectTrigger>
                <SelectContent>
                  {weightOptions.map(opt => (
                    <SelectItem key={`${opt.kind}-${opt.datasetId}`} value={opt.datasetId}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-[11px] text-muted-foreground">{WEIGHT_CROSSTAB_COPY}</p>
            </div>
          </div>
          {largeBanner ? (
            <Alert>
              <AlertDescription>
                Nested banners produce {product} columns. Letters recycle every 26; more than 16
                columns only test adjacent pairs.
              </AlertDescription>
            </Alert>
          ) : null}
          {previewWarning ? (
            <Alert>
              <AlertDescription>{previewWarning}</AlertDescription>
            </Alert>
          ) : null}
          {error ? (
            <Alert variant="destructive">
              <AlertDescription className="whitespace-pre-wrap">{error}</AlertDescription>
            </Alert>
          ) : null}
          <div className="rounded-md border border-border p-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Saved tables
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Run stores the spec. Reopen regenerates cells from the parquet.
            </p>
            {savedSpecs.length ? (
              <ul className="mt-2 space-y-1">
                {savedSpecs.map(row => {
                  const id = row.spec_id || row.id || '';
                  return (
                    <li key={id} className="flex items-center justify-between gap-2 text-xs">
                      <span className={id === activeSpecId ? 'font-medium' : ''}>
                        {savedSpecLabel(row)}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-6 text-[10px]"
                        disabled={busy}
                        onClick={() => void reopen(row)}
                      >
                        Reopen
                      </Button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-2 text-[11px] text-muted-foreground">
                No saved specs on this file yet.
              </p>
            )}
          </div>
          {table ? (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-2 py-1">Stub</th>
                    {table.headers.map(h => (
                      <th key={h.id} className="px-2 py-1">
                        {h.label}
                        {h.letterSlot ? (
                          <span className="ml-1 text-[10px] text-muted-foreground">
                            {h.letterSlot}
                          </span>
                        ) : null}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map(row => (
                    <tr key={row.label} className="border-b align-top">
                      <td className="px-2 py-1 font-medium">{row.label}</td>
                      {row.cells.map((cell, i) => (
                        <td key={`${row.label}-${i}`} className="px-2 py-1">
                          <button
                            type="button"
                            className="w-full text-left"
                            onClick={() => clickCell(cell, row.label)}
                          >
                            <div>
                              {canvas.columnPercent ? cell.columnPercent : null}
                              {canvas.rowPercent ? (
                                <span className="ml-1 text-muted-foreground">
                                  {cell.rowPercent} row
                                </span>
                              ) : null}
                              {cell.letters ? (
                                <sup className="ml-0.5 font-medium">{cell.letters}</sup>
                              ) : null}
                            </div>
                            <div className="text-[10px] text-muted-foreground">{cell.bases}</div>
                          </button>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {cellClick ? (
            <Alert>
              <AlertDescription>{cellClick}</AlertDescription>
            </Alert>
          ) : null}
          {exportTrace && activeSpecId ? (
            <div className="space-y-1 text-[11px] text-muted-foreground">
              <p>
                Weight identity {exportTrace.identity} · trace {exportTrace.kind}
              </p>
              <p>{exportAuditCopy.xlsx}</p>
              <p>{exportAuditCopy.pptx}</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px]"
                  disabled={busy}
                  onClick={() => void exportBook('xlsx')}
                >
                  Excel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px]"
                  disabled={busy}
                  onClick={() => void exportBook('pptx')}
                >
                  PowerPoint
                </Button>
              </div>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const next = resetBuilderSurface();
              setCanvas(next.canvas);
              setError(next.error);
              setBook(next.book);
              setPreviewWarning(next.previewWarning);
              setActiveSpecId(next.activeSpecId);
              setCellClick(next.cellClick);
            }}
          >
            Reset
          </Button>
          <Button type="button" onClick={() => void run()} disabled={busy}>
            {busy ? 'Running…' : 'Run and save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DropZone({
  label,
  onDropColumn,
  children,
  compact,
}: {
  label: string;
  onDropColumn: (column: string) => void;
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-md border border-dashed border-border p-3 ${compact ? 'ml-4 bg-muted/10 p-2' : ''}`}
      onDragOver={e => e.preventDefault()}
      onDrop={e => {
        e.preventDefault();
        const column = e.dataTransfer.getData('text/plain');
        if (column) onDropColumn(column);
      }}
    >
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

function QuestionCard({
  title,
  values,
  nets,
  onMove,
  onNet,
}: {
  title: string;
  values: string[];
  nets?: string[];
  onMove: (from: number, to: number) => void;
  onNet?: (kind: NetPresetId) => void;
}) {
  return (
    <div className="rounded border border-border bg-background p-2">
      <p className="text-xs font-medium">{title}</p>
      <ol className="mt-1 space-y-0.5">
        {values.map((value, i) => (
          <li key={value} className="flex items-center gap-1 text-[11px]">
            <span className="flex-1">{value}</span>
            <button
              type="button"
              className="text-muted-foreground"
              onClick={() => onMove(i, i - 1)}
            >
              ↑
            </button>
            <button
              type="button"
              className="text-muted-foreground"
              onClick={() => onMove(i, i + 1)}
            >
              ↓
            </button>
          </li>
        ))}
      </ol>
      {nets?.length ? (
        <p className="mt-1 text-[10px] text-muted-foreground">{nets.join(' · ')}</p>
      ) : null}
      {onNet ? (
        <div className="mt-2 flex flex-wrap gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-6 text-[10px]"
            onClick={() => onNet('agree')}
          >
            NET Agree
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-6 text-[10px]"
            onClick={() => onNet('yes')}
          >
            NET Yes
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-6 text-[10px]"
            onClick={() => onNet('top2')}
          >
            Top-2-box
          </Button>
        </div>
      ) : null}
      {onNet ? <p className="mt-1 text-[10px] text-muted-foreground">{NET_HELPER_COPY}</p> : null}
    </div>
  );
}
