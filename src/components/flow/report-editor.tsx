'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChoiceSelect } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/rest';
import { flowJson } from '@/lib/flow-api';
import { usePageTableBook, useReportDocument } from '@/hooks/api/use-project-data';
import { invalidateReportDocument, projectQueryKeys } from '@/lib/project-query-cache';
import {
  addPage,
  applyDefaultLabels,
  applyPageTemplate,
  copyStyles,
  cssFontStack,
  deletePage,
  documentFromPins,
  duplicatePage,
  fitDocumentTextFrames,
  fitPageTextFrames,
  hideTableRow,
  insertDynamicText,
  insertPageNumber,
  insertSampleSizeDescription,
  insertTable,
  insertTextBox,
  liveValueFromLabel,
  liveValueShowsLabel,
  mergeTableRowsIntoNet,
  normalizeReportDocument,
  pageHref,
  renameTableRow,
  reorderTableRows,
  reportDocumentForApi,
  resolveTextHref,
  savePageAsTemplate,
  setDefaultLabels,
  setDocumentTheme,
  setObjectBinding,
  setObjectText,
  setObjectTextStyle,
  setPageHidden,
  setPageLayout,
  setTableRules,
  setTableStyle,
  tablePreviewFootnote,
  tablePreviewTitle,
  type DefaultLabels,
  type ListStyle,
  type PinLike,
  type ReportDocument,
  type ReportObject,
  type TextAlign,
  type TextBinding,
  type TextBindingKind,
  type TextBoxStyle,
  type VerticalAlign,
} from '@/lib/report-document';
import {
  HOUSE_STYLE_OPTIONS,
  TABLE_RULE_CATALOG,
  tableRuleLabel,
  tableStylePresetLabel,
  type TableRule,
  type TableStylePreset,
} from '@/lib/table-presentation';
import { ReportLayoutPicker } from '@/components/flow/report-layout-picker';
import { ReportThemePanel } from '@/components/flow/report-theme-panel';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/rest';
import { Segmented } from '@/components/ui/segmented';
import { getPageLayout } from '@/lib/report-theme';

const STYLE_PRESETS: { id: string; label: string; style: Partial<TextBoxStyle> }[] = [
  { id: 'headline', label: 'Headline', style: { fontFamily: 'Inter', fontSizePt: 22, bold: true } },
  { id: 'body', label: 'Body', style: { fontFamily: 'Inter', fontSizePt: 14, bold: false } },
  {
    id: 'caption',
    label: 'Caption',
    style: { fontFamily: 'Inter', fontSizePt: 11, bold: false, color: '#6A6B66' },
  },
  { id: 'title', label: 'Title', style: { fontFamily: 'Inter', fontSizePt: 28, bold: true } },
];

const COLOURS = [
  { label: 'Ink', value: '#1B1C1A' },
  { label: 'Muted', value: '#6A6B66' },
  { label: 'Accent', value: '#1E6B58' },
  { label: 'Warn', value: '#A15C12' },
];

const FONT_FAMILIES = ['Inter', 'System Sans-Serif', 'Times New Roman'];

function emptyDocument(): ReportDocument {
  return addPage(normalizeReportDocument({}), { title: 'Page 1', layoutId: 'title_and_content' });
}

/** No saved pages and no pins — keep the Slides chrome, do not invent a blank page. */
function emptyShell(): ReportDocument {
  return normalizeReportDocument({});
}

function ensurePages(document: ReportDocument): ReportDocument {
  return document.pages.length ? document : emptyDocument();
}

function materializeForFirstPaint(document: ReportDocument): ReportDocument {
  const firstId = document.pages[0]?.id;
  if (!firstId) return document;
  return fitPageTextFrames(document, firstId);
}

function objectPlainText(obj: ReportObject): string {
  if (obj.runs.length) return obj.runs.map(run => run.text).join('');
  return obj.text;
}

function withObjectHref(
  document: ReportDocument,
  pageId: string,
  objectId: string,
  href: string | null
): ReportDocument {
  const page = document.pages.find(item => item.id === pageId);
  const obj = page?.objects.find(item => item.id === objectId);
  if (!obj) return document;
  const text = objectPlainText(obj) || 'Link';
  const style = obj.textStyle;
  return setObjectText(document, pageId, objectId, {
    text,
    runs: [
      {
        text,
        bold: style.bold,
        italic: style.italic,
        underline: style.underline,
        strikethrough: style.strikethrough,
        color: style.color,
        fontFamily: style.fontFamily,
        fontSizePt: style.fontSizePt,
        href: href || null,
        binding: null,
      },
    ],
  });
}

function objectHref(obj: ReportObject): string {
  const fromRun = obj.runs.find(run => run.href)?.href;
  return fromRun || '';
}

function kindLabel(kind: ReportObject['kind']): string {
  if (kind === 'text') return 'Text';
  if (kind === 'table') return 'Table';
  if (kind === 'chart') return 'Chart';
  if (kind === 'image') return 'Image';
  return 'Shape';
}

function objectBinding(obj: ReportObject | null | undefined): TextBinding | null {
  if (!obj) return null;
  if (obj.binding) return obj.binding;
  return obj.runs.find(run => run.binding)?.binding || null;
}

function tableSourceLabel(table: ReportObject, index: number, pageTitle: string): string {
  const title = pageTitle.trim();
  if (title) return `T${index + 1} · ${title}`;
  return `Table ${index + 1}`;
}

function defaultCellKeys(table: ReportObject | null, defaults: DefaultLabels) {
  const edits = table?.tableEdits;
  const renamed = edits ? Object.values(edits.renames).find(label => String(label).trim()) : '';
  const ordered = edits?.rowOrder.find(id => String(id).trim());
  const rowKey = String(renamed || ordered || 'Category').trim() || 'Category';
  const colKey = String(defaults.total || 'Total').trim() || 'Total';
  return { rowKey, colKey };
}

/** Compact percent grid from a saved banner book. Never invents placeholder rows. */
export function previewGridFromBannerBook(
  book: Record<string, unknown> | null | undefined
): string[][] {
  if (!book || typeof book !== 'object') return [];
  const banners = (Array.isArray(book.banner_columns) ? book.banner_columns : []).filter(
    col => col && typeof col === 'object'
  ) as Array<{ id?: string; label?: string }>;
  const header = ['', ...banners.map(col => String(col.label || col.id || '').trim() || 'Column')];
  const rowsOut: string[][] = [header];

  const formatPct = (value: unknown): string => {
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    return `${Math.round(n * 10) / 10}%`;
  };

  const bookRows = Array.isArray(book.rows) ? book.rows : [];
  if (bookRows.length) {
    for (const raw of bookRows.slice(0, 12)) {
      if (!raw || typeof raw !== 'object') continue;
      const row = raw as {
        label?: string;
        id?: string;
        kind?: string;
        cells?: Array<{ banner_id?: string; percent?: number | null }>;
      };
      if (String(row.kind || '') === 'header') continue;
      const cells = Array.isArray(row.cells) ? row.cells : [];
      const byBanner = new Map(
        cells.map(cell => [String(cell.banner_id || ''), formatPct(cell.percent)] as const)
      );
      rowsOut.push([
        String(row.label || row.id || '').trim() || 'Row',
        ...banners.map(col => byBanner.get(String(col.id || '')) || '—'),
      ]);
    }
    return rowsOut.length > 1 ? rowsOut : [];
  }

  const cells = (Array.isArray(book.cells) ? book.cells : []).filter(
    cell => cell && typeof cell === 'object'
  ) as Array<{
    stub_row_id?: string;
    stub_label?: string;
    banner_id?: string;
    percent?: number | null;
  }>;
  if (!cells.length || !banners.length) return [];
  const stubOrder: string[] = [];
  const stubLabels = new Map<string, string>();
  for (const cell of cells) {
    const stubId = String(cell.stub_row_id || cell.stub_label || '').trim();
    if (!stubId) continue;
    if (!stubLabels.has(stubId)) {
      stubOrder.push(stubId);
      stubLabels.set(stubId, String(cell.stub_label || stubId).trim() || stubId);
    }
  }
  for (const stubId of stubOrder.slice(0, 12)) {
    rowsOut.push([
      stubLabels.get(stubId) || stubId,
      ...banners.map(col => {
        const hit = cells.find(
          cell =>
            String(cell.stub_row_id || cell.stub_label || '') === stubId &&
            String(cell.banner_id || '') === String(col.id || '')
        );
        return hit ? formatPct(hit.percent) : '—';
      }),
    ]);
  }
  return rowsOut.length > 1 ? rowsOut : [];
}

function RunTableGrid({
  rows,
  style,
  banded,
  minimal,
}: {
  rows: string[][];
  style: ReportObject['tableStyle'];
  banded: boolean;
  minimal: boolean;
}) {
  return (
    <table
      style={{
        fontFamily: cssFontStack(style.fontFamily),
        fontSize: `${Math.max(8, style.fontSizePt - 1)}pt`,
        color: style.bodyColor,
        borderColor: style.borderColor,
        borderWidth: minimal ? 0 : style.borderWidthPt,
      }}
    >
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {row.map((cell, colIndex) => {
              const isHeader = rowIndex === 0;
              const shade = banded && !isHeader && rowIndex % 2 === 0;
              return (
                <td
                  key={colIndex}
                  style={{
                    background: isHeader ? style.headerFill : shade ? '#F6F6F3' : style.bodyFill,
                    color: isHeader ? style.headerColor : style.bodyColor,
                    borderColor: style.borderColor,
                    fontWeight: isHeader ? 600 : 400,
                  }}
                >
                  {cell}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AnalysisRunTablePreview({
  runId,
  style,
  banded,
  minimal,
}: {
  runId: string;
  style: ReportObject['tableStyle'];
  banded: boolean;
  minimal: boolean;
}) {
  const [rows, setRows] = useState<string[][] | null>(null);
  const [title, setTitle] = useState('');
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => {
    let live = true;
    void import('@/lib/analysis-runs').then(({ fetchAnalysisRun }) =>
      fetchAnalysisRun(runId).then(run => {
        if (!live) return;
        if (!run) {
          setPhase('error');
          return;
        }
        void import('@/components/flow/run-document').then(({ runDocument }) => {
          if (!live) return;
          const document = runDocument({
            op: run.op,
            title: run.report?.meta?.title,
            report: run.report,
            result: run.result,
            created_at: run.created_at,
          });
          const table = document.tables[0];
          if (!table) {
            setPhase('error');
            return;
          }
          setTitle(table.title || document.title || '');
          setRows([table.columns, ...table.rows.map(row => [...row])]);
          setPhase('ready');
        });
      })
    );
    return () => {
      live = false;
    };
  }, [runId]);
  if (phase === 'loading') {
    return (
      <div className="report-editor-table-skeleton" aria-busy="true" aria-label="Loading table">
        <div className="report-editor-table-skeleton-bar" />
        <div className="report-editor-table-skeleton-bar" />
        <div className="report-editor-table-skeleton-bar" />
      </div>
    );
  }
  if (phase === 'error' || !rows?.length) {
    return <p className="report-editor-table-empty">Could not load this table.</p>;
  }
  return (
    <div className="report-editor-table-preview" data-preset={style.preset} data-phase="ready">
      {title ? <p className="report-editor-table-title">{title}</p> : null}
      <RunTableGrid rows={rows} style={style} banded={banded} minimal={minimal} />
    </div>
  );
}

function ChartObjectPreview({ obj, pins }: { obj: ReportObject; pins: PinLike[] }) {
  const pin =
    pins.find(
      item =>
        (obj.pinId && String(item.id || '') === obj.pinId) ||
        (obj.runId && String(item.runId || item.run_id || '') === obj.runId)
    ) || null;
  const bars = (pin?.bars || []).filter(bar => String(bar?.label || '').trim());
  if (!bars.length) {
    return <span className="report-editor-object-label">{kindLabel(obj.kind)}</span>;
  }
  return (
    <div className="report-editor-chart-preview" aria-label="Chart">
      {bars.map((bar, index) => {
        const percent = Number(bar.percent) || 0;
        return (
          <div key={`${bar.label}-${index}`} className="report-editor-chart-row">
            <div className="report-editor-chart-label">
              <span>{bar.label}</span>
              <span>{percent.toFixed(1)}%</span>
            </div>
            <div className="report-editor-chart-track">
              <div
                className="report-editor-chart-bar"
                style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TableObjectPreview({
  obj,
  datasetId,
  pageId,
}: {
  obj: ReportObject;
  datasetId: string | null;
  pageId: string;
}) {
  const style = obj.tableStyle;
  const banded = style.preset === 'banded';
  const minimal = style.preset === 'compact';
  const specId = String(obj.tableSpecId || '').trim();
  const runId = String(obj.runId || '').trim();
  const tableQuery = usePageTableBook(datasetId, pageId, specId);
  const rows = useMemo(() => {
    if (!tableQuery.data) return [] as string[][];
    return previewGridFromBannerBook(tableQuery.data);
  }, [tableQuery.data]);
  const questionTitle = useMemo(
    () => (tableQuery.data ? tablePreviewTitle(tableQuery.data) : ''),
    [tableQuery.data]
  );
  const footnote = useMemo(
    () => (tableQuery.data ? tablePreviewFootnote(tableQuery.data) : ''),
    [tableQuery.data]
  );
  // Analysis-run tables (Add to report) have a run id but no saved table spec.
  if (!specId && runId) {
    return (
      <AnalysisRunTablePreview runId={runId} style={style} banded={banded} minimal={minimal} />
    );
  }
  const phase: 'idle' | 'loading' | 'ready' | 'error' =
    !specId || !datasetId
      ? 'idle'
      : tableQuery.isPending && !tableQuery.data
        ? 'loading'
        : tableQuery.isError
          ? 'error'
          : rows.length
            ? 'ready'
            : 'error';

  const showGrid = phase === 'ready' && rows.length > 0;

  return (
    <div className="report-editor-table-preview" data-preset={style.preset} data-phase={phase}>
      {questionTitle && (showGrid || phase === 'error') ? (
        <p className="report-editor-table-title">{questionTitle}</p>
      ) : null}
      {showGrid ? (
        <RunTableGrid rows={rows} style={style} banded={banded} minimal={minimal} />
      ) : phase === 'loading' ? (
        <div className="report-editor-table-skeleton" aria-busy="true" aria-label="Loading table">
          <div className="report-editor-table-skeleton-bar" />
          <div className="report-editor-table-skeleton-bar" />
          <div className="report-editor-table-skeleton-bar" />
          <div className="report-editor-table-skeleton-bar" />
        </div>
      ) : (
        <p className="report-editor-table-empty">
          {phase === 'error'
            ? 'Could not load this table.'
            : 'Link a saved table to preview numbers.'}
        </p>
      )}
      {footnote ? <span className="report-editor-table-meta">{footnote}</span> : null}
    </div>
  );
}

function CanvasObjectView({
  obj,
  selected,
  paintArmed,
  datasetId,
  pageId,
  pins,
  onSelect,
}: {
  obj: ReportObject;
  selected: boolean;
  paintArmed: boolean;
  datasetId: string | null;
  pageId: string;
  pins: PinLike[];
  onSelect: () => void;
}) {
  const style = obj.textStyle;
  const text = objectPlainText(obj) || 'Text';
  const binding = objectBinding(obj);
  const listPrefix =
    style.listStyle === 'bullet' ? '• ' : style.listStyle === 'number' ? '1. ' : '';
  const indent = Math.max(0, style.listIndent) * 16;
  const deco = [style.underline ? 'underline' : '', style.strikethrough ? 'line-through' : '']
    .filter(Boolean)
    .join(' ');
  const isText = obj.kind === 'text';
  const hasRunBindings = obj.runs.some(run => run.binding);
  return (
    <Button
      type="button"
      className="report-editor-object"
      data-kind={obj.kind}
      data-selected={selected}
      data-paint={paintArmed}
      data-live={binding ? binding.kind : undefined}
      data-stale={binding?.stale ? 'true' : undefined}
      style={{
        left: `${obj.frame.x * 100}%`,
        top: `${obj.frame.y * 100}%`,
        width: `${obj.frame.w * 100}%`,
        height: `${obj.frame.h * 100}%`,
        zIndex: obj.zIndex,
        fontFamily: isText ? cssFontStack(style.fontFamily) : undefined,
        fontSize: isText ? `${style.fontSizePt}pt` : undefined,
        color: isText && !binding ? style.color : undefined,
        fontWeight: isText ? (style.bold ? 700 : 400) : undefined,
        fontStyle: isText ? (style.italic ? 'italic' : 'normal') : undefined,
        textDecoration: isText ? deco || 'none' : undefined,
        textAlign: isText ? style.align : undefined,
        lineHeight: isText ? String(style.lineSpacing) : undefined,
        justifyContent: isText
          ? style.verticalAlign === 'middle'
            ? 'center'
            : style.verticalAlign === 'bottom'
              ? 'flex-end'
              : 'flex-start'
          : 'flex-start',
        paddingLeft: isText ? indent : undefined,
      }}
      onClick={event => {
        event.stopPropagation();
        onSelect();
      }}
    >
      {obj.kind === 'text' ? (
        <span>
          {listPrefix}
          {hasRunBindings ? (
            obj.runs.map((run, index) =>
              run.binding ? (
                <span
                  key={`${obj.id}-run-${index}`}
                  className="report-editor-live-value"
                  data-stale={run.binding.stale ? 'true' : undefined}
                >
                  {run.text || '—'}
                </span>
              ) : (
                <span key={`${obj.id}-run-${index}`}>{run.text}</span>
              )
            )
          ) : binding ? (
            <span
              className="report-editor-live-value"
              data-stale={binding.stale ? 'true' : undefined}
            >
              {text}
            </span>
          ) : (
            text
          )}
        </span>
      ) : obj.kind === 'table' ? (
        <TableObjectPreview obj={obj} datasetId={datasetId} pageId={pageId} />
      ) : obj.kind === 'chart' ? (
        <ChartObjectPreview obj={obj} pins={pins} />
      ) : (
        <span className="report-editor-object-label">{kindLabel(obj.kind)}</span>
      )}
    </Button>
  );
}

export function ReportEditor({
  datasetId,
  pins = [],
  labelsRevision = 0,
  focusRunId = '',
}: {
  datasetId: string | null;
  pins?: PinLike[];
  /** Bumped after find/replace so the editor reloads the saved document. */
  labelsRevision?: number;
  /** Deep link from Add / Open in report — select the page for this run. */
  focusRunId?: string;
}) {
  const queryClient = useQueryClient();
  const storedDocument = useReportDocument(datasetId);
  const [document, setDocument] = useState<ReportDocument>(() => emptyDocument());
  const [pageId, setPageId] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [paintSourceId, setPaintSourceId] = useState<string | null>(null);
  const [linkDraft, setLinkDraft] = useState('');
  const [linkPageId, setLinkPageId] = useState('');
  const [editCells, setEditCells] = useState(false);
  const [addingRule, setAddingRule] = useState(false);
  const [rowDraft, setRowDraft] = useState('');
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [phase, setPhase] = useState<'loading' | 'ready'>(() =>
    storedDocument.data || !datasetId ? 'ready' : 'loading'
  );
  const [saveNote, setSaveNote] = useState('');
  const [inspectorTab, setInspectorTab] = useState<'page' | 'theme'>('page');
  const [addPageOpen, setAddPageOpen] = useState(false);
  const [layoutPickerMode, setLayoutPickerMode] = useState<'add' | 'change'>('add');
  const [pageMenu, setPageMenu] = useState<{ pageId: string; x: number; y: number } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fitRestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipSave = useRef(true);
  const bootedFor = useRef('');

  const page = useMemo(
    () => document.pages.find(item => item.id === pageId) || document.pages[0] || null,
    [document, pageId]
  );
  const selected = useMemo(
    () => page?.objects.find(obj => obj.id === selectedId) || null,
    [page, selectedId]
  );

  const persist = useCallback(
    (next: ReportDocument) => {
      if (!datasetId) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        const payload = { document: reportDocumentForApi(next), has_document: true };
        void flowJson(`/datasets/${datasetId}/report/document`, {
          method: 'PUT',
          body: JSON.stringify({ document: payload.document }),
        })
          .then(() => {
            queryClient.setQueryData(projectQueryKeys.reportDocument(datasetId), payload);
            setSaveNote('Saved');
          })
          .catch(() => setSaveNote('Could not save'));
      }, 400);
    },
    [datasetId, queryClient]
  );

  const commit = useCallback(
    (next: ReportDocument) => {
      const ensured = ensurePages(normalizeReportDocument(next));
      setDocument(ensured);
      if (!ensured.pages.some(item => item.id === pageId)) {
        setPageId(ensured.pages[0]?.id || '');
        setSelectedId(null);
      }
      if (!skipSave.current) persist(ensured);
    },
    [pageId, persist]
  );

  useEffect(() => {
    if (labelsRevision > 0 && datasetId) {
      void invalidateReportDocument(queryClient, datasetId);
    }
  }, [labelsRevision, datasetId, queryClient]);

  const pinKey = pins.map(pin => pin.id || pin.runId || '').join(',');
  useEffect(() => {
    skipSave.current = true;
    const bootKey = `${datasetId || ''}:${labelsRevision}:${pinKey}:${focusRunId || ''}`;
    const stored = storedDocument.data;
    const waiting = Boolean(datasetId) && storedDocument.isPending && !stored;
    const settledEmpty =
      Boolean(datasetId) &&
      !waiting &&
      (storedDocument.isError ||
        (storedDocument.isFetched && !(stored?.has_document && stored.document)));

    if (waiting) {
      // Warm cache: keep showing the last document. Cold start: stay on the skeleton.
      if (bootedFor.current) {
        setPhase('ready');
      } else {
        setPhase('loading');
      }
      return () => {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        if (fitRestTimer.current) clearTimeout(fitRestTimer.current);
      };
    }

    let next: ReportDocument;
    if (stored?.has_document && stored.document) {
      next = materializeForFirstPaint(normalizeReportDocument(stored.document));
    } else if (pins.length) {
      next = materializeForFirstPaint(documentFromPins(pins));
    } else if (settledEmpty || !datasetId) {
      next = emptyShell();
    } else {
      next = materializeForFirstPaint(emptyDocument());
    }

    setDocument(next);
    const focus = String(focusRunId || '').trim();
    const focusedPage = focus
      ? next.pages.find(page => page.objects.some(obj => obj.runId === focus))
      : null;
    setPageId(current => {
      if (focusedPage) return focusedPage.id;
      return next.pages.some(item => item.id === current) ? current : next.pages[0]?.id || '';
    });
    if (bootedFor.current !== bootKey) {
      setSelectedId(null);
      setPaintSourceId(null);
      bootedFor.current = bootKey;
    }
    setPhase('ready');
    // An empty shell must not PUT — the API requires pages or pins.
    skipSave.current = next.pages.length === 0;

    // Fit the remaining pages off the first paint so a 90-slide deck opens on page 1.
    if (fitRestTimer.current) clearTimeout(fitRestTimer.current);
    if (next.pages.length > 1) {
      fitRestTimer.current = setTimeout(() => {
        setDocument(current => {
          if (bootedFor.current !== bootKey) return current;
          return fitDocumentTextFrames(current);
        });
      }, 0);
    }

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (fitRestTimer.current) clearTimeout(fitRestTimer.current);
    };
    // pins content is covered by pinKey; avoid re-booting on a new [] each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    datasetId,
    pinKey,
    labelsRevision,
    focusRunId,
    storedDocument.data,
    storedDocument.isPending,
    storedDocument.isError,
    storedDocument.isFetched,
  ]);

  useEffect(() => {
    if (!selected) {
      setLinkDraft('');
      setLinkPageId('');
      return;
    }
    const href = objectHref(selected);
    const resolved = resolveTextHref(href);
    if (resolved?.kind === 'page') {
      setLinkPageId(resolved.pageId);
      setLinkDraft('');
    } else {
      setLinkPageId('');
      setLinkDraft(resolved?.kind === 'url' ? resolved.url : '');
    }
  }, [selected]);

  const patchStyle = (patch: Partial<TextBoxStyle>) => {
    if (!page || !selected) return;
    commit(setObjectTextStyle(document, page.id, selected.id, patch));
  };

  const selectedTable = selected?.kind === 'table' ? selected : null;
  const selectedLive = selected?.kind === 'text' ? objectBinding(selected) : null;
  const pageTables = useMemo(
    () => (page?.objects || []).filter(obj => obj.kind === 'table'),
    [page]
  );

  const activePreset =
    STYLE_PRESETS.find(preset => {
      if (!selected || selected.kind !== 'text') return false;
      const style = selected.textStyle;
      return (
        style.fontSizePt === preset.style.fontSizePt &&
        Boolean(style.bold) === Boolean(preset.style.bold ?? style.bold) &&
        (preset.style.color ? style.color === preset.style.color : true)
      );
    })?.label || 'Headline';

  const houseStyleLabel = selectedTable
    ? tableStylePresetLabel(selectedTable.tableStyle.preset)
    : 'House style';

  const selectObject = (objectId: string) => {
    if (paintSourceId && page && paintSourceId !== objectId) {
      commit(copyStyles(document, page.id, paintSourceId, [objectId]));
      setPaintSourceId(null);
      setSelectedId(objectId);
      setSelectedRowIds([]);
      return;
    }
    setSelectedId(objectId);
    setSelectedRowIds([]);
    setAddingRule(false);
    setInspectorTab('page');
  };

  const createPageWithLayout = (layoutId: string, title?: string) => {
    const next = addPage(document, {
      title: title || `Page ${document.pages.length + 1}`,
      layoutId,
      afterPageId: page?.id,
    });
    const created = next.pages.find(
      item => !document.pages.some(existing => existing.id === item.id)
    );
    commit(next);
    if (created) setPageId(created.id);
    setSelectedId(null);
    setAddPageOpen(false);
    setLayoutPickerMode('add');
  };

  const applySavedTemplate = (templateId: string) => {
    const template = document.pageTemplates.find(item => item.id === templateId);
    if (!template) return;
    const next = applyPageTemplate(document, template, {
      title: template.name,
      afterPageId: page?.id,
    });
    const created = next.pages.find(
      item => !document.pages.some(existing => existing.id === item.id)
    );
    commit(next);
    if (created) setPageId(created.id);
    setSelectedId(null);
    setAddPageOpen(false);
  };

  useEffect(() => {
    if (!pageMenu) return;
    const close = () => setPageMenu(null);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('click', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [pageMenu]);

  const addText = () => {
    if (!page) return;
    const before = new Set(page.objects.map(obj => obj.id));
    const next = insertTextBox(document, page.id, {
      text: 'New text',
      frame: { x: 0.18, y: 0.18, w: 0.55, h: 0.16 },
      textStyle: STYLE_PRESETS[0]?.style,
    });
    const created = next.pages
      .find(item => item.id === page.id)
      ?.objects.find(obj => !before.has(obj.id));
    commit(next);
    if (created) setSelectedId(created.id);
  };

  const addTable = () => {
    if (!page) return;
    const before = new Set(page.objects.map(obj => obj.id));
    const next = insertTable(document, page.id, {
      frame: { x: 0.08, y: 0.28, w: 0.84, h: 0.52 },
      tableStyle: { preset: 'default' },
    });
    const created = next.pages
      .find(item => item.id === page.id)
      ?.objects.find(obj => !before.has(obj.id));
    commit(next);
    if (created) {
      setSelectedId(created.id);
      setEditCells(false);
      setSelectedRowIds([]);
    }
  };

  const preferredTable = (): ReportObject | null => {
    if (selectedTable) return selectedTable;
    if (selectedLive?.sourceObjectId) {
      return pageTables.find(obj => obj.id === selectedLive.sourceObjectId) || null;
    }
    return pageTables[0] || null;
  };

  const selectCreatedOnPage = (next: ReportDocument, before: Set<string>) => {
    if (!page) return;
    const created = next.pages
      .find(item => item.id === page.id)
      ?.objects.find(obj => !before.has(obj.id));
    commit(next);
    if (created) setSelectedId(created.id);
  };

  const addLiveValue = (kind: TextBindingKind) => {
    if (!page) return;
    const before = new Set(page.objects.map(obj => obj.id));
    const table = preferredTable();
    if (kind === 'page_number') {
      selectCreatedOnPage(
        insertPageNumber(document, page.id, {
          frame: { x: 0.78, y: 0.9, w: 0.16, h: 0.06 },
          textStyle: { fontSizePt: 12, color: '#1E6B58', bold: true },
        }),
        before
      );
      return;
    }
    if (kind === 'sample_size') {
      selectCreatedOnPage(
        insertSampleSizeDescription(document, page.id, {
          sourceObjectId: table?.id || null,
          runId: table?.runId || null,
          pinId: table?.pinId || null,
          tableSpecId: table?.tableSpecId || null,
          frame: { x: 0.12, y: 0.72, w: 0.7, h: 0.08 },
          textStyle: { fontSizePt: 13, color: '#1E6B58', bold: true },
        }),
        before
      );
      return;
    }
    const keys = defaultCellKeys(table, document.defaultLabels);
    selectCreatedOnPage(
      insertDynamicText(document, page.id, {
        rowKey: keys.rowKey,
        colKey: keys.colKey,
        sourceObjectId: table?.id || null,
        runId: table?.runId || null,
        pinId: table?.pinId || null,
        tableSpecId: table?.tableSpecId || null,
        frame: { x: 0.18, y: 0.22, w: 0.28, h: 0.1 },
        textStyle: { fontSizePt: 14, color: '#1E6B58', bold: true },
      }),
      before
    );
  };

  const rebindLiveValue = (kind: TextBindingKind, sourceTableId?: string | null) => {
    if (!page || !selected || selected.kind !== 'text') return;
    const current = objectBinding(selected);
    const table =
      (sourceTableId ? pageTables.find(obj => obj.id === sourceTableId) : null) ||
      (current?.sourceObjectId
        ? pageTables.find(obj => obj.id === current.sourceObjectId)
        : null) ||
      preferredTable();
    const keys = defaultCellKeys(table, document.defaultLabels);
    const pageIndex = Math.max(
      0,
      document.pages.findIndex(item => item.id === page.id)
    );
    if (kind === 'page_number') {
      commit(
        setObjectBinding(
          document,
          page.id,
          selected.id,
          {
            kind: 'page_number',
            template: current?.template || '{n}',
          },
          { pageIndex, pageCount: document.pages.length }
        )
      );
      return;
    }
    if (kind === 'sample_size') {
      commit(
        setObjectBinding(document, page.id, selected.id, {
          kind: 'sample_size',
          sourceObjectId: table?.id || null,
          runId: table?.runId || null,
          pinId: table?.pinId || null,
          tableSpecId: table?.tableSpecId || null,
          fingerprint: current?.fingerprint || null,
          stale: Boolean(current?.stale),
        })
      );
      return;
    }
    commit(
      setObjectBinding(document, page.id, selected.id, {
        kind: 'cell',
        rowKey: current?.kind === 'cell' && current.rowKey ? current.rowKey : keys.rowKey,
        colKey: current?.kind === 'cell' && current.colKey ? current.colKey : keys.colKey,
        stat: current?.stat || 'percent',
        sourceObjectId: table?.id || null,
        runId: table?.runId || null,
        pinId: table?.pinId || null,
        tableSpecId: table?.tableSpecId || null,
        prefix: current?.prefix || '',
        suffix: current?.suffix || '',
        fingerprint: current?.fingerprint || null,
        stale: Boolean(current?.stale),
      })
    );
  };

  const applyHouseStyle = (preset: TableStylePreset) => {
    if (!page || !selectedTable) return;
    commit(setTableStyle(document, page.id, selectedTable.id, { preset }));
  };

  const addRuleFromCatalog = (catalogId: string) => {
    if (!page || !selectedTable) return;
    const entry = TABLE_RULE_CATALOG.find(item => item.id === catalogId);
    if (!entry) return;
    const nextRules: TableRule[] = [
      ...selectedTable.tableRules,
      { ...entry.rule, id: `rule-${Math.random().toString(16).slice(2, 10)}`, enabled: true },
    ];
    commit(setTableRules(document, page.id, selectedTable.id, nextRules));
    setAddingRule(false);
  };

  const removeRule = (ruleId: string) => {
    if (!page || !selectedTable) return;
    commit(
      setTableRules(
        document,
        page.id,
        selectedTable.id,
        selectedTable.tableRules.filter(rule => rule.id !== ruleId)
      )
    );
  };

  const toggleRule = (ruleId: string) => {
    if (!page || !selectedTable) return;
    commit(
      setTableRules(
        document,
        page.id,
        selectedTable.id,
        selectedTable.tableRules.map(rule =>
          rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule
        )
      )
    );
  };

  const editableRowIds = useMemo(() => {
    if (!selectedTable) return [] as string[];
    const edits = selectedTable.tableEdits;
    const ids = new Set<string>([
      ...edits.rowOrder,
      ...Object.keys(edits.renames),
      ...edits.hiddenRowIds,
      ...edits.merges.flatMap(merge => merge.rowIds),
    ]);
    return [...ids];
  }, [selectedTable]);

  const rowDisplayLabel = (rowId: string) => selectedTable?.tableEdits.renames[rowId] || rowId;

  const ensureRowId = (raw: string) => {
    const label = raw.trim();
    if (!label) return null;
    const existing = editableRowIds.find(
      id => id === label || selectedTable?.tableEdits.renames[id] === label
    );
    if (existing) return existing;
    return (
      label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || `row-${Math.random().toString(16).slice(2, 8)}`
    );
  };

  const applyLink = (href: string | null) => {
    if (!page || !selected || selected.kind !== 'text') return;
    commit(withObjectHref(document, page.id, selected.id, href));
  };

  if (phase === 'loading') {
    return (
      <div className="report-editor report-editor-loading" aria-busy="true">
        <p className="flow-muted">Loading pages…</p>
      </div>
    );
  }

  const isEmpty = document.pages.length === 0;

  return (
    <div className="report-editor">
      <div className="report-editor-toolbar" role="toolbar" aria-label="Report formatting">
        <Button type="button" className="report-editor-tool-label" onClick={addText}>
          Text
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" className="report-editor-chip" disabled={!selected}>
              {activePreset} ▾
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {STYLE_PRESETS.map(preset => (
              <DropdownMenuItem key={preset.id} onSelect={() => patchStyle(preset.style)}>
                {preset.label}
              </DropdownMenuItem>
            ))}
            {FONT_FAMILIES.map(font => (
              <DropdownMenuItem key={font} onSelect={() => patchStyle({ fontFamily: font })}>
                {font}
              </DropdownMenuItem>
            ))}
            {[11, 14, 18, 22, 28].map(size => (
              <DropdownMenuItem key={size} onSelect={() => patchStyle({ fontSizePt: size })}>
                {size} pt
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          type="button"
          className="report-editor-toggle"
          data-active={Boolean(selected?.textStyle.bold)}
          disabled={!selected}
          aria-pressed={Boolean(selected?.textStyle.bold)}
          onClick={() => patchStyle({ bold: !selected?.textStyle.bold })}
        >
          B
        </Button>
        <Button
          type="button"
          className="report-editor-toggle italic"
          data-active={Boolean(selected?.textStyle.italic)}
          disabled={!selected}
          aria-pressed={Boolean(selected?.textStyle.italic)}
          onClick={() => patchStyle({ italic: !selected?.textStyle.italic })}
        >
          I
        </Button>
        <Button
          type="button"
          className="report-editor-toggle underline"
          data-active={Boolean(selected?.textStyle.underline)}
          disabled={!selected}
          aria-pressed={Boolean(selected?.textStyle.underline)}
          onClick={() => patchStyle({ underline: !selected?.textStyle.underline })}
        >
          U
        </Button>
        <Button
          type="button"
          className="report-editor-toggle strike"
          data-active={Boolean(selected?.textStyle.strikethrough)}
          disabled={!selected}
          aria-pressed={Boolean(selected?.textStyle.strikethrough)}
          onClick={() => patchStyle({ strikethrough: !selected?.textStyle.strikethrough })}
        >
          S
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" className="report-editor-chip quiet" disabled={!selected}>
              • List
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {(
              [
                { value: 'none', label: 'None' },
                { value: 'bullet', label: 'Bullets' },
                { value: 'number', label: 'Numbering' },
              ] as { value: ListStyle; label: string }[]
            ).map(option => (
              <DropdownMenuItem
                key={option.value}
                onSelect={() => patchStyle({ listStyle: option.value })}
              >
                {option.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem
              onSelect={() =>
                patchStyle({ listIndent: Math.min(8, (selected?.textStyle.listIndent || 0) + 1) })
              }
            >
              Increase indent
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() =>
                patchStyle({ listIndent: Math.max(0, (selected?.textStyle.listIndent || 0) - 1) })
              }
            >
              Decrease indent
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" className="report-editor-chip quiet" disabled={!selected}>
              Colour ▾
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {COLOURS.map(colour => (
              <DropdownMenuItem
                key={colour.value}
                onSelect={() => patchStyle({ color: colour.value })}
              >
                {colour.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          type="button"
          className="report-editor-chip quiet"
          data-active={Boolean(paintSourceId)}
          disabled={!selected && !paintSourceId}
          onClick={() => {
            if (paintSourceId) {
              setPaintSourceId(null);
              return;
            }
            if (selected) setPaintSourceId(selected.id);
          }}
        >
          Format painter
        </Button>
        <span className="report-editor-toolbar-divider" aria-hidden="true" />
        <Button
          type="button"
          className="report-editor-chip live"
          onClick={() => addLiveValue('cell')}
        >
          + Live value
        </Button>
        <span className="report-editor-toolbar-divider" aria-hidden="true" />
        <Button type="button" className="report-editor-tool-label" onClick={addTable}>
          Table
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" className="report-editor-chip" disabled={!selectedTable}>
              {houseStyleLabel} ▾
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {HOUSE_STYLE_OPTIONS.map(option => (
              <DropdownMenuItem key={option.id} onSelect={() => applyHouseStyle(option.id)}>
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" className="report-editor-chip quiet" disabled={!selectedTable}>
              Rules ▾
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {TABLE_RULE_CATALOG.map(entry => (
              <DropdownMenuItem key={entry.id} onSelect={() => addRuleFromCatalog(entry.id)}>
                {entry.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          type="button"
          className="report-editor-chip quiet"
          data-active={editCells}
          disabled={!selectedTable && !editCells}
          aria-pressed={editCells}
          onClick={() => setEditCells(current => !current)}
        >
          Edit cells
        </Button>
        {saveNote ? <span className="report-editor-save">{saveNote}</span> : null}
      </div>

      <div className="report-editor-body">
        <aside className="report-editor-pages" aria-label="Pages">
          {document.pages.map((item, index) => (
            <Button
              key={item.id}
              type="button"
              className="report-editor-thumb"
              data-active={item.id === page?.id}
              data-hidden={item.hideFromExport}
              title={item.title || `Page ${index + 1}`}
              onClick={() => {
                setPageId(item.id);
                setSelectedId(null);
                setPaintSourceId(null);
                setInspectorTab('page');
              }}
              onContextMenu={event => {
                event.preventDefault();
                setPageId(item.id);
                setSelectedId(null);
                setPageMenu({ pageId: item.id, x: event.clientX, y: event.clientY });
              }}
              aria-label={`Page ${index + 1}${item.hideFromExport ? ', hidden from export' : ''}${
                item.title ? `: ${item.title}` : ''
              }`}
            >
              <span className="report-editor-thumb-num">{index + 1}</span>
              {item.title ? <span className="report-editor-thumb-title">{item.title}</span> : null}
            </Button>
          ))}
          {document.pages.some(item => item.hideFromExport) ? (
            <p className="report-editor-pages-note">
              Page {document.pages.findIndex(item => item.hideFromExport) + 1 || ''} hidden from
              export
            </p>
          ) : null}
          <Popover
            open={addPageOpen}
            onOpenChange={open => {
              setAddPageOpen(open);
              if (open) setLayoutPickerMode('add');
            }}
          >
            <PopoverTrigger asChild>
              <Button type="button" className="flow-btn report-editor-add-page">
                Add page
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" side="right" className="report-layout-popover">
              <ReportLayoutPicker
                title={layoutPickerMode === 'change' ? 'Change layout' : 'Add a page'}
                afterLabel={
                  page
                    ? layoutPickerMode === 'change'
                      ? page.title || 'This page'
                      : `After slide ${Math.max(1, document.pages.findIndex(item => item.id === page.id) + 1)}`
                    : undefined
                }
                selectedLayoutId={layoutPickerMode === 'change' ? page?.layoutId : null}
                templates={document.pageTemplates}
                onPickLayout={layout => {
                  if (layoutPickerMode === 'change' && page) {
                    commit(setPageLayout(document, page.id, layout.id));
                    setAddPageOpen(false);
                    setLayoutPickerMode('add');
                    return;
                  }
                  createPageWithLayout(layout.id);
                }}
                onPickTemplate={template => applySavedTemplate(template.id)}
              />
            </PopoverContent>
          </Popover>
        </aside>

        <div
          className="report-editor-stage"
          onClick={() => {
            setSelectedId(null);
            if (paintSourceId) setPaintSourceId(null);
          }}
        >
          {isEmpty ? (
            <div className="report-editor-empty" data-testid="report-editor-empty">
              <p className="report-editor-empty-title">No pages yet</p>
              <p className="flow-muted">
                Add a page to start the slide deck, or ask the agent to build one from your tables.
              </p>
              <Button
                type="button"
                className="flow-btn primary"
                onClick={event => {
                  event.stopPropagation();
                  setLayoutPickerMode('add');
                  setAddPageOpen(true);
                }}
              >
                Add page
              </Button>
            </div>
          ) : (
            <div
              className="report-editor-page"
              aria-label={page?.title || 'Page'}
              style={{
                fontFamily: cssFontStack(document.theme.fontFamily),
                color: document.theme.secondaryColour,
              }}
            >
              {document.theme.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="report-editor-page-logo" src={document.theme.logoUrl} alt="" />
              ) : null}
              {(page?.objects || [])
                .filter(obj => !obj.hidden)
                .slice()
                .sort((a, b) => a.zIndex - b.zIndex || a.id.localeCompare(b.id))
                .map(obj => (
                  <CanvasObjectView
                    key={obj.id}
                    obj={obj}
                    selected={obj.id === selectedId}
                    paintArmed={Boolean(paintSourceId)}
                    datasetId={datasetId}
                    pageId={page?.id || ''}
                    pins={pins}
                    onSelect={() => selectObject(obj.id)}
                  />
                ))}
            </div>
          )}
        </div>

        <aside className="report-editor-inspector" aria-label="Object inspector">
          <Segmented
            className="report-inspector-tabs"
            aria-label="Inspector"
            value={inspectorTab}
            onValueChange={value => setInspectorTab(value)}
            options={[
              { value: 'page', label: 'Page' },
              { value: 'theme', label: 'Report theme' },
            ]}
          />
          {inspectorTab === 'theme' ? (
            <ReportThemePanel
              theme={document.theme}
              onChange={theme => commit(setDocumentTheme(document, theme))}
              onSaveTeamTheme={() => {
                const named = {
                  ...document.theme,
                  name: document.theme.name.startsWith('Team theme')
                    ? document.theme.name
                    : `Team theme · ${document.theme.name}`,
                };
                commit(setDocumentTheme(document, named));
                setSaveNote('Team theme saved on this report');
              }}
            />
          ) : selectedTable ? (
            <>
              <h3>Table style</h3>
              <div className="report-editor-style-grid">
                {HOUSE_STYLE_OPTIONS.map(option => (
                  <Button
                    key={option.id}
                    type="button"
                    className="report-editor-style-chip"
                    data-active={selectedTable.tableStyle.preset === option.id}
                    onClick={() => applyHouseStyle(option.id)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
              <h3>Rules</h3>
              <div className="report-editor-rules">
                {selectedTable.tableRules.length === 0 ? (
                  <p className="flow-muted">No rules yet. Add one to re-apply on every refresh.</p>
                ) : (
                  selectedTable.tableRules.map(rule => (
                    <div
                      key={rule.id}
                      className="report-editor-rule-row"
                      data-enabled={rule.enabled}
                    >
                      <Button
                        type="button"
                        className="report-editor-rule-label"
                        onClick={() => toggleRule(rule.id)}
                        title={rule.enabled ? 'Turn rule off' : 'Turn rule on'}
                      >
                        {tableRuleLabel(rule)}
                      </Button>
                      <Button
                        type="button"
                        className="report-editor-rule-remove"
                        onClick={() => removeRule(rule.id)}
                        aria-label={`Remove ${tableRuleLabel(rule)}`}
                      >
                        Remove
                      </Button>
                    </div>
                  ))
                )}
                {addingRule ? (
                  <div className="report-editor-rule-catalog" role="listbox" aria-label="Add rule">
                    {TABLE_RULE_CATALOG.map(entry => (
                      <Button
                        key={entry.id}
                        type="button"
                        role="option"
                        className="report-editor-rule-option"
                        onClick={() => addRuleFromCatalog(entry.id)}
                      >
                        {entry.label}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <Button
                    type="button"
                    className="report-editor-add-rule"
                    onClick={() => setAddingRule(true)}
                  >
                    + Add rule
                  </Button>
                )}
              </div>
              {editCells ? (
                <>
                  <div className="report-editor-divider" />
                  <h3>Edit cells</h3>
                  <p className="flow-muted">
                    Rename, hide, reorder or merge rows. Changes stay on the table and re-apply when
                    the data updates.
                  </p>
                  <label className="report-editor-field">
                    <span>Row label</span>
                    <Input
                      value={rowDraft}
                      placeholder="Category to edit"
                      onChange={event => setRowDraft(event.target.value)}
                      onKeyDown={event => {
                        if (event.key !== 'Enter' || !page || !selectedTable) return;
                        const rowId = ensureRowId(rowDraft);
                        if (!rowId) return;
                        commit(
                          renameTableRow(
                            document,
                            page.id,
                            selectedTable.id,
                            rowId,
                            rowDraft.trim()
                          )
                        );
                        setRowDraft('');
                        setSelectedRowIds(current =>
                          current.includes(rowId) ? current : [...current, rowId]
                        );
                      }}
                    />
                  </label>
                  <div className="report-editor-row">
                    <Button
                      type="button"
                      className="report-editor-pill"
                      disabled={!rowDraft.trim() || !page || !selectedTable}
                      onClick={() => {
                        if (!page || !selectedTable) return;
                        const rowId = ensureRowId(rowDraft);
                        if (!rowId) return;
                        commit(
                          renameTableRow(
                            document,
                            page.id,
                            selectedTable.id,
                            rowId,
                            rowDraft.trim()
                          )
                        );
                        setSelectedRowIds(current =>
                          current.includes(rowId) ? current : [...current, rowId]
                        );
                        setRowDraft('');
                      }}
                    >
                      Rename
                    </Button>
                    <Button
                      type="button"
                      className="report-editor-pill"
                      disabled={selectedRowIds.length === 0 || !page || !selectedTable}
                      onClick={() => {
                        if (!page || !selectedTable || !selectedRowIds[0]) return;
                        commit(
                          hideTableRow(document, page.id, selectedTable.id, selectedRowIds[0], true)
                        );
                      }}
                    >
                      Hide
                    </Button>
                    <Button
                      type="button"
                      className="report-editor-pill"
                      disabled={selectedRowIds.length < 2 || !page || !selectedTable}
                      onClick={() => {
                        if (!page || !selectedTable) return;
                        commit(
                          mergeTableRowsIntoNet(
                            document,
                            page.id,
                            selectedTable.id,
                            selectedRowIds,
                            'NET'
                          )
                        );
                        setSelectedRowIds([]);
                      }}
                    >
                      Merge into NET
                    </Button>
                  </div>
                  <div className="report-editor-row">
                    <Button
                      type="button"
                      className="report-editor-pill"
                      disabled={editableRowIds.length < 2 || !page || !selectedTable}
                      onClick={() => {
                        if (!page || !selectedTable || editableRowIds.length < 2) return;
                        const next = [...editableRowIds];
                        const focus = selectedRowIds[0] || next[0];
                        const index = next.indexOf(focus);
                        if (index <= 0) return;
                        [next[index - 1], next[index]] = [next[index], next[index - 1]];
                        commit(reorderTableRows(document, page.id, selectedTable.id, next));
                      }}
                    >
                      Move up
                    </Button>
                    <Button
                      type="button"
                      className="report-editor-pill"
                      disabled={editableRowIds.length < 2 || !page || !selectedTable}
                      onClick={() => {
                        if (!page || !selectedTable || editableRowIds.length < 2) return;
                        const next = [...editableRowIds];
                        const focus = selectedRowIds[0] || next[0];
                        const index = next.indexOf(focus);
                        if (index < 0 || index >= next.length - 1) return;
                        [next[index], next[index + 1]] = [next[index + 1], next[index]];
                        commit(reorderTableRows(document, page.id, selectedTable.id, next));
                      }}
                    >
                      Move down
                    </Button>
                  </div>
                  {editableRowIds.length ? (
                    <ul className="report-editor-row-list">
                      {editableRowIds.map(rowId => {
                        const hidden = selectedTable.tableEdits.hiddenRowIds.includes(rowId);
                        const active = selectedRowIds.includes(rowId);
                        return (
                          <li key={rowId}>
                            <Button
                              type="button"
                              className="report-editor-row-item"
                              data-active={active}
                              data-hidden={hidden}
                              onClick={() =>
                                setSelectedRowIds(current =>
                                  current.includes(rowId)
                                    ? current.filter(id => id !== rowId)
                                    : [...current, rowId]
                                )
                              }
                            >
                              {rowDisplayLabel(rowId)}
                              {hidden ? ' (hidden)' : ''}
                            </Button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="flow-muted">
                      Type a row label and press Rename to start editing.
                    </p>
                  )}
                </>
              ) : null}
            </>
          ) : selectedLive && selected?.kind === 'text' ? (
            <>
              <h3>Live value</h3>
              <label className="report-editor-field">
                <span>Shows</span>
                {selectedLive.kind === 'cell' ? (
                  <div className="report-editor-live-pair">
                    <Input
                      value={selectedLive.rowKey || ''}
                      aria-label="Row label"
                      placeholder="Category"
                      onChange={event => {
                        if (!page) return;
                        commit(
                          setObjectBinding(document, page.id, selected.id, {
                            ...selectedLive,
                            rowKey: event.target.value,
                          })
                        );
                      }}
                    />
                    <Input
                      value={selectedLive.colKey || ''}
                      aria-label="Column label"
                      placeholder="Total"
                      onChange={event => {
                        if (!page) return;
                        commit(
                          setObjectBinding(document, page.id, selected.id, {
                            ...selectedLive,
                            colKey: event.target.value,
                          })
                        );
                      }}
                    />
                  </div>
                ) : (
                  <div className="report-editor-readonly">{liveValueShowsLabel(selectedLive)}</div>
                )}
              </label>
              <label className="report-editor-field">
                <span>From</span>
                {selectedLive.kind === 'page_number' ? (
                  <div className="report-editor-readonly">
                    {liveValueFromLabel(selectedLive, pageTables, { pageTitle: page?.title })}
                  </div>
                ) : (
                  <ChoiceSelect
                    className="report-editor-select"
                    aria-label="Source table"
                    value={selectedLive.sourceObjectId || ''}
                    onValueChange={nextId => {
                      rebindLiveValue(selectedLive.kind, nextId || null);
                    }}
                    options={[
                      {
                        value: '',
                        label: pageTables.length ? 'Choose a table' : 'No table on this page',
                      },
                      ...pageTables.map((table, index) => ({
                        value: table.id,
                        label: tableSourceLabel(table, index, page?.title || ''),
                      })),
                    ]}
                  />
                )}
              </label>
              <div className="report-editor-row" role="group" aria-label="Live value type">
                {(
                  [
                    { value: 'cell', label: 'Cell value' },
                    { value: 'sample_size', label: 'Base' },
                    { value: 'page_number', label: 'Page no.' },
                  ] as { value: TextBindingKind; label: string }[]
                ).map(option => (
                  <Button
                    key={option.value}
                    type="button"
                    className="report-editor-pill"
                    data-active={selectedLive.kind === option.value}
                    onClick={() => rebindLiveValue(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
              <p className="report-editor-live-note">
                {selectedLive.stale
                  ? 'Source table missing or changed. Re-link From above, or the value stays amber until the next refresh.'
                  : 'Updates when the data or wave changes. If the source table is removed, the value turns amber and says why.'}
              </p>
              <div className="report-editor-divider" />
              <label className="report-editor-field">
                <span>Content</span>
                <Input value={objectPlainText(selected)} readOnly aria-readonly="true" />
              </label>
            </>
          ) : selected?.kind === 'text' ? (
            <>
              <h3>Text</h3>
              <label className="report-editor-field">
                <span>Content</span>
                <Input
                  value={objectPlainText(selected)}
                  onChange={event => {
                    if (!page) return;
                    commit(
                      setObjectText(document, page.id, selected.id, { text: event.target.value })
                    );
                  }}
                />
              </label>
              <div className="report-editor-row">
                {(
                  [
                    { value: 'left', label: 'Left' },
                    { value: 'center', label: 'Centre' },
                    { value: 'right', label: 'Right' },
                  ] as { value: TextAlign; label: string }[]
                ).map(option => (
                  <Button
                    key={option.value}
                    type="button"
                    className="report-editor-pill"
                    data-active={selected.textStyle.align === option.value}
                    onClick={() => patchStyle({ align: option.value })}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
              <div className="report-editor-row">
                {(
                  [
                    { value: 'top', label: 'Top' },
                    { value: 'middle', label: 'Middle' },
                    { value: 'bottom', label: 'Bottom' },
                  ] as { value: VerticalAlign; label: string }[]
                ).map(option => (
                  <Button
                    key={option.value}
                    type="button"
                    className="report-editor-pill"
                    data-active={selected.textStyle.verticalAlign === option.value}
                    onClick={() => patchStyle({ verticalAlign: option.value })}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
              <label className="report-editor-field">
                <span>Line spacing</span>
                <Input
                  type="number"
                  min={1}
                  step={0.05}
                  value={selected.textStyle.lineSpacing}
                  onChange={event => {
                    const value = Number(event.target.value);
                    if (!Number.isFinite(value) || value <= 0) return;
                    patchStyle({ lineSpacing: value });
                  }}
                />
              </label>
              <h3>Hyperlink</h3>
              <label className="report-editor-field">
                <span>Web address</span>
                <Input
                  value={linkDraft}
                  placeholder="https://"
                  onChange={event => setLinkDraft(event.target.value)}
                  onBlur={() => {
                    const value = linkDraft.trim();
                    applyLink(value || null);
                    setLinkPageId('');
                  }}
                />
              </label>
              <label className="report-editor-field">
                <span>Page in this report</span>
                <ChoiceSelect
                  className="report-editor-select"
                  aria-label="Page in this report"
                  value={linkPageId}
                  onValueChange={nextId => {
                    setLinkPageId(nextId);
                    setLinkDraft('');
                    applyLink(nextId ? pageHref(nextId) : null);
                  }}
                  options={[
                    { value: '', label: 'None' },
                    ...document.pages.map((item, index) => ({
                      value: item.id,
                      label: `Page ${index + 1}${item.title ? ` · ${item.title}` : ''}`,
                    })),
                  ]}
                />
              </label>
              {objectHref(selected) ? (
                <Button
                  type="button"
                  className="flow-btn"
                  onClick={() => {
                    setLinkDraft('');
                    setLinkPageId('');
                    applyLink(null);
                  }}
                >
                  Remove link
                </Button>
              ) : null}
            </>
          ) : (
            <>
              <h3>Page</h3>
              <p className="flow-muted">Select a text box or table, or add one from the toolbar.</p>
              <div className="report-editor-row">
                <Button type="button" className="flow-btn" onClick={addText}>
                  Add text box
                </Button>
                <Button type="button" className="flow-btn" onClick={addTable}>
                  Add table
                </Button>
              </div>
              {page ? (
                <p className="flow-muted">
                  Layout: {getPageLayout(page.layoutId)?.label || 'Blank'} · Hidden from export:{' '}
                  {page.hideFromExport ? 'on' : 'off'}
                </p>
              ) : null}
            </>
          )}

          {inspectorTab === 'page' ? (
            <>
              <div className="report-editor-divider" />
              <h3>Default labels</h3>
              <p className="flow-muted">Rename NET and Total everywhere in this report.</p>
              <DefaultLabelsEditor
                labels={document.defaultLabels}
                onChange={labels => commit(setDefaultLabels(document, labels))}
              />
              <p className="report-editor-preview flow-muted">
                Preview: {applyDefaultLabels('NET', document.defaultLabels)} ·{' '}
                {applyDefaultLabels('Total', document.defaultLabels)}
              </p>
            </>
          ) : null}
        </aside>
      </div>

      {pageMenu ? (
        <div
          className="report-page-menu"
          style={{ left: pageMenu.x, top: pageMenu.y }}
          role="menu"
          aria-label="Page actions"
          onClick={event => event.stopPropagation()}
        >
          <Button
            type="button"
            role="menuitem"
            className="report-page-menu-item"
            onClick={() => {
              const next = duplicatePage(document, pageMenu.pageId);
              const created = next.pages.find(
                item => !document.pages.some(existing => existing.id === item.id)
              );
              commit(next);
              if (created) setPageId(created.id);
              setPageMenu(null);
            }}
          >
            Duplicate page
          </Button>
          <Button
            type="button"
            role="menuitem"
            className="report-page-menu-item"
            onClick={() => {
              setPageId(pageMenu.pageId);
              setLayoutPickerMode('change');
              setAddPageOpen(true);
              setPageMenu(null);
            }}
          >
            Change layout…
          </Button>
          <Button
            type="button"
            role="menuitem"
            className="report-page-menu-item"
            onClick={() => {
              commit(savePageAsTemplate(document, pageMenu.pageId));
              setSaveNote('Page saved as template');
              setPageMenu(null);
            }}
          >
            Save page as template
          </Button>
          <Button
            type="button"
            role="menuitem"
            className="report-page-menu-item"
            onClick={() => {
              const target = document.pages.find(item => item.id === pageMenu.pageId);
              if (!target) return;
              commit(
                setPageHidden(document, pageMenu.pageId, {
                  hideFromExport: !target.hideFromExport,
                })
              );
              setPageMenu(null);
            }}
          >
            Hide from export
          </Button>
          <Button
            type="button"
            role="menuitem"
            className="report-page-menu-item danger"
            disabled={document.pages.length <= 1}
            onClick={() => {
              if (document.pages.length <= 1) return;
              const next = deletePage(document, pageMenu.pageId);
              if (!next.pages.length) return;
              commit(next);
              setPageId(next.pages[0]?.id || '');
              setSelectedId(null);
              setPageMenu(null);
            }}
          >
            Remove page
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function DefaultLabelsEditor({
  labels,
  onChange,
}: {
  labels: DefaultLabels;
  onChange: (labels: DefaultLabels) => void;
}) {
  return (
    <div className="report-editor-labels">
      <label className="report-editor-field">
        <span>NET</span>
        <Input
          value={labels.net}
          onChange={event => onChange({ ...labels, net: event.target.value })}
        />
      </label>
      <label className="report-editor-field">
        <span>Total</span>
        <Input
          value={labels.total}
          onChange={event => onChange({ ...labels, total: event.target.value })}
        />
      </label>
    </div>
  );
}
