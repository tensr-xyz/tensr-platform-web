'use client';

import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/molecules/dialog';
import { Alert, AlertDescription } from '@/components/atoms/alert';
import { formatApiErrorMessage } from '@/lib/api-error';
import { Button } from '@/components/atoms/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/atoms/empty';
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
import { getAccessToken } from '@/utils/auth';
import { openAnalysisResultTab } from '@/lib/open-analysis-result-tab';
import { runDatasetAnalysis } from '@/lib/workspace-analysis';
import { captureProductEvent, captureProductException, errorClass } from '@/lib/product-analytics';
import { datasetRequest, replayOperations, setActiveWeight } from '@/lib/dataset-data-ops';
import { LINEAGE_HIDDEN_COLUMNS } from '@/lib/adopt-derived-dataset';
import {
  getDatasetIdFromTab,
  resolveSpreadsheetContextTab,
  WORKSPACE_DATASET_REQUIRED,
} from '@/lib/workspace-dataset';
import { useTabsStore } from '@/stores/tabs-store';
import {
  downloadTableExport,
  drillTableCell,
  getSavedTable,
  listDatasetVersions,
  listNamedBanners,
  listSavedTables,
  previewCustomTable,
  runCustomTable,
  saveNamedBanner,
} from '@/lib/custom-tables/api';
import {
  netPreset,
  NET_HELPER_COPY,
  offersTop2Box,
  type NetPresetId,
} from '@/lib/custom-tables/nets';
import {
  drillClickCopy,
  drillRequest,
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
  stricterLetterAlpha,
  moveCategory,
  namedBannerPayload,
  nestUnderBanner,
  savedSpecLabel,
  tableRequestKey,
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
import { WincrossImport } from './wincross-import';

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
  const [activeWeightColumn, setActiveWeightColumn] = useState<string>('none');
  const [weightWarnings, setWeightWarnings] = useState<string[]>([]);
  const [previewWarning, setPreviewWarning] = useState<string | null>(null);
  const [savedSpecs, setSavedSpecs] = useState<SavedTableSpecRow[]>([]);
  const [activeSpecId, setActiveSpecId] = useState<string | null>(null);
  const [savedRequestKey, setSavedRequestKey] = useState<string | null>(null);
  const [cellClick, setCellClick] = useState<string | null>(null);
  const [namedBanners, setNamedBanners] = useState<Array<{ id: string; label?: string }>>([]);
  const [bannerIdDraft, setBannerIdDraft] = useState('');
  const [bookName, setBookName] = useState('');
  const [variableSets, setVariableSets] = useState<Array<{ id: string; label: string }>>([]);
  const [targetZone, setTargetZone] = useState<'stub' | 'banner'>('stub');
  const [activeVariable, setActiveVariable] = useState(0);
  const [savedNotice, setSavedNotice] = useState(false);
  const runLock = useRef(false);

  const columns = useMemo(() => {
    if (!sheetTab?.data?.initialColumns) return variableSets;
    const fromSheet = sheetTab.data.initialColumns
      .map(c => ({ id: c.id, label: c.header || c.id }))
      .filter(c => !LINEAGE_HIDDEN_COLUMNS.has(c.id));
    const known = new Set(fromSheet.map(column => column.id));
    return [...fromSheet, ...variableSets.filter(set => !known.has(set.id))];
  }, [sheetTab?.data?.initialColumns, variableSets]);

  const rows = useMemo(() => sheetTab?.data?.initialData || [], [sheetTab?.data?.initialData]);

  const runDatasetId = useMemo(() => {
    const selected = weightOptions.find(o => o.optionId === weightChoice);
    return selected ? pickRunDatasetId(selected) : datasetId || '';
  }, [weightOptions, weightChoice, datasetId]);

  const refreshNamedBanners = async (targetId: string) => {
    if (!targetId) {
      setNamedBanners([]);
      return;
    }
    try {
      const listed = await listNamedBanners(targetId, token);
      setNamedBanners(listed.banners || []);
    } catch {
      setNamedBanners([]);
    }
  };

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
    void datasetRequest<{ sets?: Array<{ name?: string; kind?: string }> }>(
      `/datasets/${datasetId}/variable-sets`,
      token
    )
      .then(res => {
        if (cancelled) return;
        setVariableSets(
          (res.sets || [])
            .filter(set => set.name)
            .map(set => ({
              id: String(set.name),
              label: String(set.name),
            }))
        );
      })
      .catch(() => {
        if (!cancelled) setVariableSets([]);
      });
    void listDatasetVersions(datasetId, token)
      .then(res => {
        if (cancelled) return;
        const opts = weightPickerOptions(res.versions || [], datasetId);
        setWeightOptions(opts);
        const current =
          opts.find(o => o.kind === 'this_file') ||
          opts.find(o => o.kind === 'this_file_unweighted') ||
          opts[0];
        setWeightChoice(current?.optionId || '');
      })
      .catch(() => {
        if (cancelled) return;
        setWeightOptions([]);
        setWeightChoice('');
      });
    return () => {
      cancelled = true;
    };
  }, [open, datasetId, token]);

  useEffect(() => {
    if (!open || !runDatasetId) return;
    void refreshSavedSpecs(runDatasetId);
    void refreshNamedBanners(runDatasetId);
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

  const openSavedReport = async () => {
    if (!datasetId || !canvas.stubs[0] || !canvas.banners[0]) return;
    const request = buildTableRequest(canvas);
    const stub = canvas.stubs[0];
    const analyze: Record<string, unknown> = {
      stub_column: stub.column,
      banner_column: canvas.banners[0].column,
      stubs: request.stubs,
      banner: request.banner,
      statistics: request.statistics,
      significance_display: request.significance_display,
      significance_alpha: request.significance_alpha,
      letter_levels: request.letter_levels,
      letter_case: request.letter_case,
      letter_upper_alpha: request.letter_upper_alpha,
      multiple_comparison: 'fdr',
      nest_banners: request.nest_banners,
      column_percent: true,
      column_letters: request.significance_display !== 'cell_comparisons',
      decimals: request.decimals,
      low_base_threshold: request.low_base_threshold,
      suppress_low_base: request.suppress_low_base,
    };
    if (stub.nets.length) analyze.nets = stub.nets;
    if (request.banner_id) analyze.banner_id = request.banner_id;
    setBusy(true);
    setError(null);
    try {
      const envelope = await runDatasetAnalysis(datasetId, 'banner_table', analyze);
      openAnalysisResultTab({
        op: 'banner_table',
        envelope,
        parameters: analyze,
        sourceDatasetId: datasetId,
        sourceTabName: sheetTab?.name,
      });
    } catch (e) {
      setError(formatApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const run = async (persist: boolean) => {
    if (runLock.current) return;
    if (!datasetId) {
      setError(WORKSPACE_DATASET_REQUIRED);
      return;
    }
    if (!canvas.stubs.length || !canvas.banners.length) {
      setError('Add at least one Stub (rows) question and one Banner (columns) question.');
      return;
    }
    setBusy(true);
    setError(null);
    setPreviewWarning(null);
    setSavedNotice(false);
    captureProductEvent('analysis_started', {
      where: 'custom_tables',
      analysis_type: 'banner_table',
      dataset_id: datasetId,
    });
    const body = buildTableRequest(canvas);
    body.save = persist;
    const selectedWeight = weightOptions.find(o => o.optionId === weightChoice);
    if (selectedWeight?.weight === 'none') body.weight = 'none';
    const runId = runDatasetId;
    runLock.current = true;
    try {
      const preview = await previewCustomTable(runId, { ...body, save: false }, token);
      const warn = (preview.warnings || [])
        .map(w => w.message)
        .filter(Boolean)
        .join(' ');
      if (warn) setPreviewWarning(warn);
      const result = (await runCustomTable(runId, body, token)) as BannerBook & {
        spec?: StoredTableSpec;
        weight?: { column?: string | null; weight_aware?: boolean };
      };
      const askedUnweighted = selectedWeight?.weight === 'none';
      if (askedUnweighted && result.weight?.column && result.weight.weight_aware !== false) {
        setError(
          'Unweighted is not available on this server yet. The table was not updated, so these numbers stay weighted.'
        );
        captureProductEvent('analysis_failed', {
          where: 'custom_tables',
          analysis_type: 'banner_table',
          dataset_id: datasetId,
          error_class: 'unweighted_unavailable',
        });
        return;
      }
      setBook(result);
      setActiveSpecId(String(result.spec?.id || '') || null);
      setSavedRequestKey(tableRequestKey(canvas));
      setCellClick(null);
      if (result.spec?.banner_id) {
        setCanvas(c => ({ ...c, bannerId: String(result.spec?.banner_id) }));
      }
      if (persist) {
        await refreshSavedSpecs(runId);
        setSavedNotice(true);
      }
      captureProductEvent('analysis_completed', {
        where: 'custom_tables',
        analysis_type: 'banner_table',
        dataset_id: datasetId,
      });
    } catch (e) {
      setBook(null);
      captureProductEvent('analysis_failed', {
        where: 'custom_tables',
        analysis_type: 'banner_table',
        dataset_id: datasetId,
        error_class: errorClass(e),
      });
      captureProductException(e, { where: 'custom_tables' });
      setError(formatApiErrorMessage(e));
    } finally {
      runLock.current = false;
      setBusy(false);
    }
  };

  const saveBook = async () => {
    if (!datasetId) {
      setError(WORKSPACE_DATASET_REQUIRED);
      return;
    }
    if (!bookName.trim()) {
      setError('Name the banner book.');
      return;
    }
    if (!canvas.stubs.length || !canvas.banners.length) {
      setError('Drop a stub and a banner before saving the book.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const specs: Record<string, unknown>[] =
        tableRequestKey(canvas) === savedRequestKey
          ? []
          : [buildTableRequest(canvas) as unknown as Record<string, unknown>];
      for (const row of savedSpecs) {
        const id = row.spec_id || row.id;
        if (!id) continue;
        const stored = await getSavedTable(datasetId, id, token);
        const spec = (stored as { spec?: Record<string, unknown> }).spec || stored;
        if (spec && typeof spec === 'object') specs.push(spec as Record<string, unknown>);
      }
      await datasetRequest(`/datasets/${datasetId}/banner-books`, token, {
        method: 'POST',
        body: { name: bookName.trim(), specs },
      });
      setBookName('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the banner book');
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

  const saveBanner = async () => {
    const id = bannerIdDraft.trim() || canvas.bannerId || '';
    if (!runDatasetId) {
      setError(WORKSPACE_DATASET_REQUIRED);
      return;
    }
    if (!id || !canvas.banners.length) {
      setError('Name the banner and drop at least one Banner question before saving.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const saved = await saveNamedBanner(runDatasetId, namedBannerPayload(canvas, id, id), token);
      setCanvas(c => ({ ...c, bannerId: saved.banner.id }));
      setBannerIdDraft(saved.banner.id);
      await refreshNamedBanners(runDatasetId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save banner');
    } finally {
      setBusy(false);
    }
  };

  const clickCell = async (cell: DisplayCell, stubLabel: string) => {
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
    const originCopy = `${stubLabel}: ${resolved.n} origin respondents.${netNote}`;
    if (activeSpecId && runDatasetId && cell.stubRowId && cell.bannerId) {
      try {
        const drilled = await drillTableCell(
          runDatasetId,
          activeSpecId,
          drillRequest(cell.stubRowId, cell.bannerId),
          token
        );
        setCellClick(`${originCopy} ${drillClickCopy(drilled)}`);
        return;
      } catch (e) {
        setCellClick(
          `${originCopy} Drill failed: ${e instanceof Error ? e.message : 'unknown error'}.`
        );
        return;
      }
    }
    setCellClick(originCopy);
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
              <ul
                className="max-h-[360px] overflow-y-auto p-1 text-xs"
                role="listbox"
                aria-label="Variables"
                tabIndex={0}
                onKeyDown={event => {
                  if (!columns.length) return;
                  if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    setActiveVariable(index => Math.min(columns.length - 1, index + 1));
                  } else if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    setActiveVariable(index => Math.max(0, index - 1));
                  } else if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    const column = columns[activeVariable];
                    if (column) dropColumn(targetZone, column.id);
                  }
                }}
              >
                {columns.map((col, index) => (
                  <li
                    key={col.id}
                    draggable
                    role="option"
                    aria-selected={index === activeVariable}
                    tabIndex={-1}
                    onDragStart={e => e.dataTransfer.setData('text/plain', col.id)}
                    onClick={() => {
                      setActiveVariable(index);
                      dropColumn(targetZone, col.id);
                    }}
                    className={`cursor-pointer rounded px-2 py-1 hover:bg-muted/60 ${
                      index === activeVariable ? 'bg-muted/80' : ''
                    }`}
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
              <DropZone
                label="Stub (rows)"
                active={targetZone === 'stub'}
                empty={canvas.stubs.length === 0}
                onActivate={() => setTargetZone('stub')}
                onDropColumn={column => {
                  setTargetZone('stub');
                  dropColumn('stub', column);
                }}
              >
                {canvas.stubs.map((stub, i) => (
                  <QuestionCard
                    key={stub.column}
                    title={stub.column}
                    values={stub.values}
                    columnType={
                      sheetTab?.data?.initialColumns?.find(column => column.id === stub.column)
                        ?.type
                    }
                    nets={stub.nets.map(n => n.label)}
                    onMove={(from, to) => setCanvas(c => moveCategory(c, 'stub', i, from, to))}
                    onNet={kind => addNet(i, kind)}
                  />
                ))}
              </DropZone>
              <DropZone
                label="Banner (columns)"
                active={targetZone === 'banner'}
                empty={canvas.banners.length === 0}
                onActivate={() => setTargetZone('banner')}
                onDropColumn={column => {
                  setTargetZone('banner');
                  dropColumn('banner', column);
                }}
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
              <Checkbox
                checked={canvas.showCount}
                onCheckedChange={checked => setCanvas(c => ({ ...c, showCount: checked === true }))}
              />
              Counts
            </label>
            <label className="flex items-center gap-2">
              <Checkbox
                checked={canvas.columnPercent}
                onCheckedChange={checked =>
                  setCanvas(c => ({ ...c, columnPercent: checked === true }))
                }
              />
              Column %
            </label>
            <label className="flex items-center gap-2">
              <Checkbox
                checked={canvas.rowPercent}
                onCheckedChange={checked =>
                  setCanvas(c => ({ ...c, rowPercent: checked === true }))
                }
              />
              Row %
            </label>
            <label className="flex items-center gap-2">
              <Checkbox
                checked={canvas.totalPercent}
                onCheckedChange={checked =>
                  setCanvas(c => ({ ...c, totalPercent: checked === true }))
                }
              />
              Total %
            </label>
            <label className="flex items-center gap-2">
              Count decimals
              <Input
                type="number"
                min={0}
                max={6}
                inputSize="sm"
                className="h-7 w-14"
                value={canvas.decimals.count}
                onChange={e =>
                  setCanvas(c => ({
                    ...c,
                    decimals: {
                      ...c.decimals,
                      count: Math.max(0, Math.min(6, Number(e.target.value) || 0)),
                    },
                  }))
                }
              />
            </label>
            <label className="flex items-center gap-2">
              Percent decimals
              <Input
                type="number"
                min={0}
                max={6}
                inputSize="sm"
                className="h-7 w-14"
                value={canvas.decimals.column_proportion}
                onChange={e => {
                  const places = Math.max(0, Math.min(6, Number(e.target.value) || 0));
                  setCanvas(c => ({
                    ...c,
                    decimals: {
                      ...c.decimals,
                      column_proportion: places,
                      row_proportion: places,
                      total_proportion: places,
                    },
                  }));
                }}
              />
            </label>
            <label className="flex items-center gap-2">
              Significance
              <Select
                value={String(canvas.significanceAlpha)}
                onValueChange={value => {
                  const alpha = Number(value) as 0.1 | 0.05 | 0.01;
                  setCanvas(c => ({
                    ...c,
                    significanceAlpha: alpha,
                    letterUpperAlpha:
                      c.letterLevels === 2 ? stricterLetterAlpha(alpha) : c.letterUpperAlpha,
                  }));
                }}
              >
                <SelectTrigger className="h-7 w-[5.5rem] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.1">90%</SelectItem>
                  <SelectItem value="0.05">95%</SelectItem>
                  <SelectItem value="0.01">99%</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="flex items-center gap-2">
              Letter levels
              <Select
                value={String(canvas.letterLevels)}
                onValueChange={value =>
                  setCanvas(c => {
                    const letterLevels = value === '1' ? 1 : 2;
                    return {
                      ...c,
                      letterLevels,
                      letterUpperAlpha:
                        letterLevels === 2
                          ? stricterLetterAlpha(c.significanceAlpha)
                          : c.letterUpperAlpha,
                    };
                  })
                }
              >
                <SelectTrigger className="h-7 w-[11rem] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">Two (upper and lower)</SelectItem>
                  <SelectItem value="1">One</SelectItem>
                </SelectContent>
              </Select>
            </label>
            {canvas.letterLevels === 1 ? (
              <label className="flex items-center gap-2">
                Letter case
                <Select
                  value={canvas.letterCase}
                  onValueChange={value =>
                    setCanvas(c => ({
                      ...c,
                      letterCase: value === 'upper' ? 'upper' : 'lower',
                    }))
                  }
                >
                  <SelectTrigger className="h-7 w-[8rem] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lower">Lower case</SelectItem>
                    <SelectItem value="upper">Upper case</SelectItem>
                  </SelectContent>
                </Select>
              </label>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Upper case marks the stricter level (
                {canvas.significanceAlpha === 0.1
                  ? '95%'
                  : canvas.significanceAlpha === 0.01
                    ? '99.9%'
                    : '99%'}
                ). Lower case marks the selected level.
              </p>
            )}
            <label className="flex items-center gap-2">
              <Checkbox
                checked={canvas.nestBanners}
                onCheckedChange={checked =>
                  setCanvas(c => ({ ...c, nestBanners: checked === true }))
                }
              />
              Nest banners (uncheck for side by side / overlapping)
            </label>
            <label className="flex items-center gap-2">
              <Checkbox
                checked={canvas.significanceDisplay === 'column_letters'}
                onCheckedChange={checked =>
                  setCanvas(c => ({
                    ...c,
                    significanceDisplay: checked === true ? 'column_letters' : 'cell_comparisons',
                  }))
                }
              />
              Column letters
            </label>
            <label className="flex items-center gap-2">
              Low base below
              <Input
                type="number"
                min={1}
                max={500}
                inputSize="sm"
                className="h-7 w-16"
                value={canvas.lowBaseThreshold}
                onChange={e =>
                  setCanvas(c => ({
                    ...c,
                    lowBaseThreshold: Math.max(1, Number(e.target.value) || 30),
                  }))
                }
              />
            </label>
            <label className="flex items-center gap-2">
              <Checkbox
                checked={canvas.suppressLowBase}
                onCheckedChange={checked =>
                  setCanvas(c => ({ ...c, suppressLowBase: checked === true }))
                }
              />
              Suppress low bases (hide the number)
            </label>
            <p className="text-[10px] text-muted-foreground sm:col-span-2">
              A letter is shown when the corrected pairwise test passes (adjusted p &lt;{' '}
              {canvas.significanceAlpha}).{' '}
              {canvas.letterLevels === 2
                ? `Upper case is p ≤ ${canvas.letterUpperAlpha}. Lower case is between that cutoff and the selected level.`
                : `Every significant letter is ${canvas.letterCase} case.`}{' '}
              Letters in one cell are concatenated, so BD means that cell differs from columns B and
              D.
            </p>
            <div className="sm:col-span-2">
              <Label className="text-[10px] uppercase text-muted-foreground">Weight</Label>
              <Select value={weightChoice} onValueChange={setWeightChoice}>
                <SelectTrigger className="mt-1 h-8 text-xs">
                  <SelectValue placeholder="Unweighted (original file)" />
                </SelectTrigger>
                <SelectContent>
                  {weightOptions.map(opt => (
                    <SelectItem key={opt.optionId} value={opt.optionId}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-[11px] text-muted-foreground">{WEIGHT_CROSSTAB_COPY}</p>
              <Label className="mt-2 text-[10px] uppercase text-muted-foreground">
                Active weight column
              </Label>
              <div className="mt-1 flex gap-2">
                <Select value={activeWeightColumn} onValueChange={setActiveWeightColumn}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="No active weight" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No active weight</SelectItem>
                    {columns.map(col => (
                      <SelectItem key={col.id} value={col.id}>
                        {col.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  onClick={async () => {
                    if (!datasetId) return;
                    setError(null);
                    try {
                      const result = await setActiveWeight(
                        datasetId,
                        activeWeightColumn === 'none' ? null : activeWeightColumn,
                        token
                      );
                      setWeightWarnings(result.warnings || []);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Could not set the weight');
                    }
                  }}
                >
                  Set weight
                </Button>
              </div>
              {weightWarnings.length > 0 && (
                <p className="mt-1 text-[11px] text-muted-foreground">{weightWarnings.join(' ')}</p>
              )}
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
          <WincrossImport
            token={token}
            onLoadCanvas={(next, tableName) => {
              setCanvas(next);
              setBook(null);
              setError(null);
              setCellClick(
                `Loaded ${tableName} from the .job. Review nets and the weight, then run.`
              );
            }}
          />
          <div className="rounded-md border border-border p-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Named banner
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Save the Banner questions as a reusable banner_id. Later tables can reuse it.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Input
                inputSize="sm"
                className="h-7 min-w-[8rem] text-xs"
                placeholder="banner id"
                value={bannerIdDraft || canvas.bannerId || ''}
                onChange={e => {
                  setBannerIdDraft(e.target.value);
                  setCanvas(c => ({ ...c, bannerId: e.target.value.trim() || null }));
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-[10px]"
                disabled={busy}
                onClick={() => void saveBanner()}
              >
                Save banner
              </Button>
              {namedBanners.length ? (
                <Select
                  value={canvas.bannerId || ''}
                  onValueChange={value => {
                    setCanvas(c => ({ ...c, bannerId: value || null }));
                    setBannerIdDraft(value);
                  }}
                >
                  <SelectTrigger className="h-7 w-[10rem] text-xs">
                    <SelectValue placeholder="Reuse banner" />
                  </SelectTrigger>
                  <SelectContent>
                    {namedBanners.map(banner => (
                      <SelectItem key={banner.id} value={banner.id}>
                        {banner.label || banner.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
            </div>
          </div>
          <div className="rounded-md border border-border p-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Saved tables
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Run and save stores the spec. Reopen regenerates cells from the parquet. Save a book
              to run this set on another wave.
            </p>
            <div className="mt-2 flex gap-2">
              <Input
                inputSize="sm"
                className="h-7 flex-1 text-xs"
                placeholder="Book name"
                value={bookName}
                onChange={e => setBookName(e.target.value)}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-[10px]"
                disabled={busy}
                onClick={() => void saveBook()}
              >
                Save book
              </Button>
            </div>
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
              <Empty className="mt-2 min-h-0 border-0 p-4 md:p-4">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <FileText />
                  </EmptyMedia>
                  <EmptyTitle className="text-sm">No saved analyses</EmptyTitle>
                  <EmptyDescription className="text-[11px]">
                    No saved specs on this file yet.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </div>
          {table ? (
            <div className="overflow-x-auto rounded-md border border-border">
              {book?.base_label ? (
                <p className="border-b border-border px-2 py-1 text-left text-[11px] font-medium">
                  {book.base_label}
                </p>
              ) : null}
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
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-auto w-full justify-start px-1 text-left font-normal"
                            onClick={() => void clickCell(cell, row.label)}
                          >
                            <div>
                              {canvas.showCount ? (
                                <span className="mr-1">{cell.countText}</span>
                              ) : null}
                              {canvas.columnPercent ? cell.columnPercent : null}
                              {canvas.rowPercent ? (
                                <span className="ml-1 text-muted-foreground">
                                  {cell.rowPercent} row
                                </span>
                              ) : null}
                              {canvas.totalPercent ? (
                                <span className="ml-1 text-muted-foreground">
                                  {cell.totalPercent} total
                                </span>
                              ) : null}
                              {cell.letters ? (
                                <sup className="ml-0.5 font-medium">{cell.letters}</sup>
                              ) : null}
                            </div>
                            <div className="text-[10px] text-muted-foreground">{cell.bases}</div>
                          </Button>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {table.rows.some(row => row.cells.some(cell => cell.lowBase)) ? (
                <p className="px-2 py-1 text-[10px] text-muted-foreground">
                  * Base &lt; {canvas.lowBaseThreshold}, treat with caution.
                  {canvas.suppressLowBase ? ' Suppressed cells show * only.' : ''}
                </p>
              ) : null}
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
          <Button
            type="button"
            variant="outline"
            disabled={busy || !datasetId}
            onClick={() => {
              if (!datasetId) return;
              setBusy(true);
              setError(null);
              void replayOperations(
                datasetId,
                {
                  operation_list: {
                    schema_version: 1,
                    ops: [
                      { op: 'import', role: 'survey' },
                      {
                        op: 'table_spec',
                        input: 'survey',
                        spec: buildTableRequest(canvas),
                      },
                    ],
                  },
                },
                token
              )
                .then(result => {
                  const report = result.replay_report;
                  const table =
                    report && typeof report.table === 'object' && report.table
                      ? (report.table as BannerBook)
                      : null;
                  if (!table?.rows?.length) {
                    setBook(null);
                    setError('The table ran, but there is nothing to show.');
                    return;
                  }
                  setBook(table);
                  setActiveSpecId(table.spec?.id ? String(table.spec.id) : null);
                  setCellClick(null);
                  setError(null);
                })
                .catch(err =>
                  setError(err instanceof Error ? err.message : 'Could not run these tables')
                )
                .finally(() => setBusy(false));
            }}
          >
            Run these tables on this file
          </Button>
          {savedNotice ? (
            <div className="mr-auto flex items-center gap-2 text-xs">
              <span>Table saved.</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void openSavedReport()}
                disabled={busy}
              >
                Open report
              </Button>
            </div>
          ) : null}
          <Button type="button" variant="outline" onClick={() => void run(false)} disabled={busy}>
            {busy ? 'Running…' : 'Run'}
          </Button>
          <Button type="button" onClick={() => void run(true)} disabled={busy}>
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
  empty,
  active,
  onActivate,
}: {
  label: string;
  onDropColumn: (column: string) => void;
  children: ReactNode;
  compact?: boolean;
  empty?: boolean;
  active?: boolean;
  onActivate?: () => void;
}) {
  const showHint = empty === true;
  return (
    <div
      className={`rounded-md border border-dashed p-3 ${
        active ? 'border-foreground/40 bg-muted/30' : 'border-border'
      } ${compact ? 'ml-4 bg-muted/10 p-2' : ''}`}
      tabIndex={onActivate ? 0 : undefined}
      aria-label={
        onActivate ? `${label}. ${active ? 'Selected.' : ''} Drag or click a variable.` : undefined
      }
      onClick={onActivate}
      onFocus={onActivate}
      onKeyDown={event => {
        if (!onActivate) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onActivate();
        }
      }}
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
      {showHint ? <p className="text-xs text-muted-foreground">Drag or click a variable</p> : null}
      {children}
    </div>
  );
}

function QuestionCard({
  title,
  values,
  columnType,
  nets,
  onMove,
  onNet,
}: {
  title: string;
  values: string[];
  columnType?: string;
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
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="relative z-[80] h-6 px-1 text-muted-foreground"
              aria-label={`Move ${value} up`}
              onClick={event => {
                event.preventDefault();
                event.stopPropagation();
                onMove(i, i - 1);
              }}
            >
              ↑
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="relative z-[80] h-6 px-1 text-muted-foreground"
              aria-label={`Move ${value} down`}
              onClick={event => {
                event.preventDefault();
                event.stopPropagation();
                onMove(i, i + 1);
              }}
            >
              ↓
            </Button>
          </li>
        ))}
      </ol>
      {nets?.length ? (
        <p className="mt-1 text-[10px] text-muted-foreground">{nets.join(' · ')}</p>
      ) : null}
      {onNet ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {netPreset('agree', values) ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-6 text-[10px]"
              onClick={() => onNet('agree')}
            >
              NET Agree
            </Button>
          ) : null}
          {netPreset('yes', values) ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-6 text-[10px]"
              onClick={() => onNet('yes')}
            >
              NET Yes
            </Button>
          ) : null}
          {offersTop2Box(values, columnType) ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-6 text-[10px]"
              onClick={() => onNet('top2')}
            >
              Top-2-box
            </Button>
          ) : null}
        </div>
      ) : null}
      {onNet ? <p className="mt-1 text-[10px] text-muted-foreground">{NET_HELPER_COPY}</p> : null}
    </div>
  );
}
