'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem, Switch } from '@/components/ui/rest';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ChoiceSelect } from '@/components/ui/select';
import { downloadExport } from '@/components/flow/survey-screens';
import { exportDatasetSavAndSps } from '@/lib/dataset-data-export';
import { flowJson } from '@/lib/flow-api';
import {
  isIdColumn,
  isInternalColumn,
  questionnaireOutline,
  type FlowColumn,
} from '@/lib/flow-columns';
import { valueLabel, type ColumnValues } from '@/components/flow/filters-panel-logic';
import {
  estimateOfficeDeckSeconds,
  exportOfficeDeckAndDownload,
  groupReportExportPages,
  isAppendixExportPage,
  isSummaryExportPage,
  pagesFromReportDocument,
  type ReportExportPage,
} from '@/lib/office-deck-job';
import {
  documentApa,
  documentCsv,
  documentMarkdown,
  type RunDocument,
  type RunTable,
} from '@/components/flow/run-document';

export type ExportKind = 'chart' | 'table' | 'report';

/** Body for /reports/pipeline/export. project_id loads the study brief as a context page. */
export function pipelineExportPayload(args: {
  runIds: string[];
  style?: string;
  includeMethods?: boolean;
  liveLink?: string;
  projectId?: string;
}): string {
  return JSON.stringify({
    run_ids: args.runIds,
    style: args.style || 'apa',
    include_methods: args.includeMethods !== false,
    live_link: args.liveLink || '',
    project_id: args.projectId || '',
  });
}

function downloadText(filename: string, contents: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadSvg(svg: string, filename: string, scale: number) {
  const image = new Image();
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  image.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = image.width * scale || 640 * scale;
    canvas.height = image.height * scale || 360 * scale;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(file => {
      if (!file) return;
      const png = URL.createObjectURL(file);
      const anchor = document.createElement('a');
      anchor.href = png;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(png);
    });
    URL.revokeObjectURL(url);
  };
  image.src = url;
}

/** The open file as SPSS, plus the syntax that reads it. */
export async function savAndSyntax(datasetId: string, stem: string) {
  await exportDatasetSavAndSps(datasetId, stem);
}

/** Format cards on Report → Export (Paper 6i). */
export type ReportExportFormatId = 'docx' | 'pptx' | 'xlsx' | 'pdf' | 'md' | 'sav';

export function reportExportFormatMeta(): {
  id: ReportExportFormatId;
  ext: string;
  label: string;
  note: string;
}[] {
  return [
    {
      id: 'docx',
      ext: '.DOCX',
      label: 'Word',
      note: 'Manuscript or topline, tables stay editable',
    },
    {
      id: 'pptx',
      ext: '.PPTX',
      label: 'PowerPoint',
      note: 'One slide per finding, chart or table',
    },
    {
      id: 'xlsx',
      ext: '.XLSX',
      label: 'Excel banner book',
      note: 'Every table, sig letters, real numbers',
    },
    {
      id: 'pdf',
      ext: '.PDF',
      label: 'PDF',
      note: 'Fixed layout, ready to send',
    },
    {
      id: 'md',
      ext: '.MD',
      label: 'Markdown',
      note: 'Plain text, figures as files',
    },
    {
      id: 'sav',
      ext: '.SAV + .SPS',
      label: 'Data for SPSS',
      note: 'Dataset with an .sps weight file',
    },
  ];
}

/** Spec ids from Report pages (exec → insights → appendix), in page order. */
export function tableSpecIdsFromReportDocument(
  document: { pages?: unknown } | null | undefined
): string[] {
  const pages = Array.isArray(document?.pages) ? document.pages : [];
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const page of pages) {
    if (!page || typeof page !== 'object') continue;
    const objects = Array.isArray((page as { objects?: unknown }).objects)
      ? ((page as { objects: unknown[] }).objects as Record<string, unknown>[])
      : [];
    for (const obj of objects) {
      if (!obj || typeof obj !== 'object') continue;
      const specId = String(obj.table_spec_id || obj.tableSpecId || '').trim();
      if (!specId || seen.has(specId)) continue;
      seen.add(specId);
      ids.push(specId);
    }
  }
  return ids;
}

/**
 * PowerPoint from the Report: prefer tables linked on Report pages, else every
 * saved table. Always send the stored report document so page order is kept.
 * When the gateway queues a background job, poll until the file is ready.
 */
export async function deckFromTables(
  datasetId: string,
  stem: string,
  opts?: {
    pageIds?: string[];
    onProgress?: (message: string) => void;
  }
) {
  let reportDocument: Record<string, unknown> | null = null;
  try {
    const stored = await flowJson<{
      document?: Record<string, unknown> | null;
      has_document?: boolean;
    }>(`/datasets/${datasetId}/report/document`);
    if (stored.has_document && stored.document && Array.isArray(stored.document.pages)) {
      reportDocument = stored.document;
    }
  } catch {
    /* Fall back to saved tables when the document route fails. */
  }
  const pageIds = (opts?.pageIds || []).map(id => String(id || '').trim()).filter(Boolean);
  if (reportDocument && pageIds.length) {
    const pages = Array.isArray(reportDocument.pages) ? reportDocument.pages : [];
    const wanted = new Set(pageIds);
    reportDocument = {
      ...reportDocument,
      pages: pages.filter(
        page =>
          page &&
          typeof page === 'object' &&
          wanted.has(String((page as { id?: string }).id || '').trim())
      ),
    };
  }
  const fromReport = tableSpecIdsFromReportDocument(reportDocument);
  let ids = fromReport;
  if (!ids.length) {
    const page = await flowJson<{ specs?: { spec_id?: string; id?: string }[] }>(
      `/datasets/${datasetId}/tables`
    );
    ids = (page.specs || []).map(spec => spec.spec_id || spec.id || '').filter(Boolean);
  }
  if (!ids.length) {
    throw new Error(
      'Add Report pages with tables, or save a table in Tables, before building a deck.'
    );
  }
  await exportOfficeDeckAndDownload(
    datasetId,
    stem,
    {
      spec_ids: ids,
      ...(reportDocument ? { report_document: reportDocument } : {}),
      ...(pageIds.length ? { page_ids: pageIds } : {}),
    },
    { onProgress: opts?.onProgress }
  );
}

/** Body for /export/deck/batch — one PowerPoint per group value. */
export function deckBatchPayload(args: {
  specIds: string[];
  groupColumn: string;
  values: string[];
  name?: string;
}): string {
  return JSON.stringify({
    spec_ids: args.specIds,
    group_column: args.groupColumn,
    values: args.values,
    name: args.name || 'deck',
  });
}

/** One PowerPoint per selected group value (zip when there are several). */
export async function deckBatchFromTables(
  datasetId: string,
  stem: string,
  groupColumn: string,
  values: string[]
) {
  if (!groupColumn.trim()) throw new Error('Choose a column to make one copy per group.');
  if (!values.length) throw new Error('Choose at least one group value.');
  const page = await flowJson<{ specs?: { spec_id?: string; id?: string }[] }>(
    `/datasets/${datasetId}/tables`
  );
  const ids = (page.specs || []).map(spec => spec.spec_id || spec.id || '').filter(Boolean);
  if (!ids.length) {
    throw new Error('Save a table in Tables first. Each copy uses the same saved tables.');
  }
  const created = await flowJson<{ export_id?: string; filename?: string; n_copies?: number }>(
    `/datasets/${datasetId}/export/deck/batch`,
    {
      method: 'POST',
      body: deckBatchPayload({
        specIds: ids,
        groupColumn,
        values,
        name: stem,
      }),
    }
  );
  if (!created.export_id) throw new Error('The copies did not build. Try again.');
  await downloadExport(
    `/exports/${created.export_id}`,
    created.filename || (created.n_copies === 1 ? `${stem}.pptx` : `${stem}-by-group.zip`)
  );
}

/** Spec ids linked on Report pages, using the same page ids as the export picker. */
export function tableSpecIdsFromReportPages(
  document: { pages?: unknown } | null | undefined,
  pageIds?: string[]
): string[] {
  const pages = pagesFromReportDocument(document);
  const wanted = pageIds?.length
    ? new Set(pageIds.map(id => String(id || '').trim()).filter(Boolean))
    : null;
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const page of pages) {
    if (wanted && !wanted.has(page.id)) continue;
    const specId = String(page.tableSpecId || '').trim();
    if (!specId || seen.has(specId)) continue;
    seen.add(specId);
    ids.push(specId);
  }
  return ids;
}

/** Banner book Excel: prefer Report page tables (selected pages), else every saved table. */
export async function bannerBookFromTables(
  datasetId: string,
  stem: string,
  opts?: { pageIds?: string[]; specIds?: string[]; projectId?: string }
) {
  if (!datasetId) throw new Error('Open a file first.');
  let specIds = (opts?.specIds || []).map(id => String(id || '').trim()).filter(Boolean);
  const pageIds = (opts?.pageIds || []).map(id => String(id || '').trim()).filter(Boolean);
  if (!specIds.length) {
    let reportDocument: Record<string, unknown> | null = null;
    try {
      const stored = await flowJson<{
        document?: Record<string, unknown> | null;
        has_document?: boolean;
      }>(`/datasets/${datasetId}/report/document`);
      if (stored.has_document && stored.document && Array.isArray(stored.document.pages)) {
        reportDocument = stored.document;
      }
    } catch {
      /* Fall back to saved tables when the document route fails. */
    }
    // Use picker page ids (pagesFromReportDocument) so missing raw page.id
    // values still match the checkboxes in the Export dialog.
    specIds = tableSpecIdsFromReportPages(reportDocument, pageIds.length ? pageIds : undefined);
    if (!specIds.length) {
      specIds = tableSpecIdsFromReportDocument(reportDocument);
    }
  }
  if (!specIds.length) {
    const page = await flowJson<{ specs?: { spec_id?: string; id?: string }[] }>(
      `/datasets/${datasetId}/tables`
    );
    specIds = (page.specs || []).map(spec => spec.spec_id || spec.id || '').filter(Boolean);
  }
  if (!specIds.length && opts?.projectId) {
    const page = await flowJson<{ specs?: { spec_id?: string; id?: string }[] }>(
      `/projects/${opts.projectId}/tables`
    );
    specIds = (page.specs || []).map(spec => spec.spec_id || spec.id || '').filter(Boolean);
  }
  if (!specIds.length) {
    throw new Error(
      'Add Report pages with tables, or save a table in Tables, before building a banner book.'
    );
  }
  const saved = await flowJson<{ book?: { id?: string } }>(`/datasets/${datasetId}/banner-books`, {
    method: 'POST',
    body: JSON.stringify({ name: 'Banner book', spec_ids: specIds }),
  });
  const bookId = saved.book?.id;
  if (!bookId) throw new Error('The banner book did not build. Try again.');
  await downloadExport(
    `/datasets/${datasetId}/banner-books/${bookId}/export.xlsx`,
    `${stem}-banner-book.xlsx`,
    {
      method: 'POST',
      body: JSON.stringify({ target_dataset_id: datasetId, mapping: {} }),
    }
  );
}

/** One output's tables as an .xlsx (Paper 6g / 6h Excel download). */
export async function workbookFromRunDocument(
  document: RunDocument,
  stem: string,
  opts?: { datasetId?: string }
) {
  const { downloadReportXlsx } = await import('@/lib/report-export');
  const tables = document.tables.map((table, index) => ({
    id: `table_${index + 1}`,
    title: table.title || `Table ${index + 1}`,
    columns: table.columns,
    rows: table.rows,
  }));
  if (!tables.length) {
    throw new Error('This output has no table to put in Excel.');
  }
  await downloadReportXlsx(
    {
      meta: {
        title: stem || document.title || 'Table',
        subtitle: '',
        analysis_key: document.op || 'table',
        generated_at: new Date().toISOString(),
        rows_dataset: 0,
      },
      summary: document.summary || '',
      metrics: [],
      tables,
      trust: { notes: [], warnings: [] },
    },
    { datasetId: opts?.datasetId }
  );
}

export function ExportDialog({
  kind,
  title,
  document,
  svg,
  runIds,
  onClose,
  datasetId,
  projectId,
}: {
  kind: ExportKind;
  title: string;
  document: RunDocument;
  svg?: string;
  runIds: string[];
  onClose: () => void;
  datasetId?: string;
  projectId?: string;
}) {
  const [error, setError] = useState('');
  const [note, setNote] = useState(document.summary);
  const [caption, setCaption] = useState(title);
  const [busy, setBusy] = useState('');
  const [saved, setSaved] = useState('');
  const [choice, setChoice] = useState(kind === 'chart' && svg ? 'copy-image' : 'copy-table');
  const [style, setStyle] = useState<'apa' | 'client' | 'plain'>('apa');
  const [number, setNumber] = useState('1');
  const [italics, setItalics] = useState(true);
  const [withNote, setWithNote] = useState(kind === 'chart' || Boolean(document.summary));
  const [methodsOn, setMethodsOn] = useState(true);
  const [liveOn, setLiveOn] = useState(false);
  const [reportFormat, setReportFormat] = useState('docx');
  const [included, setIncluded] = useState<Record<number, boolean>>({});
  const [perGroup, setPerGroup] = useState(false);
  const [groupColumn, setGroupColumn] = useState('');
  const [groupOptions, setGroupOptions] = useState<{ value: string; label: string }[]>([]);
  const [groupValues, setGroupValues] = useState<ColumnValues | null>(null);
  const [pickedGroups, setPickedGroups] = useState<Record<string, boolean>>({});
  const [reportPages, setReportPages] = useState<ReportExportPage[]>([]);
  const [pickedPages, setPickedPages] = useState<Record<string, boolean>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [fileStats, setFileStats] = useState<{ rows: number; questions: number } | null>(null);
  const stem = caption.replace(/[^\w.-]+/g, '-').slice(0, 40) || 'analysis';
  const current = { ...document, title: caption, summary: note };
  const reportGroups = useMemo(() => groupReportExportPages(reportPages), [reportPages]);
  const selectedPageCount = reportPages.filter(page => pickedPages[page.id] !== false).length;
  const totalPageCount = reportPages.length;

  useEffect(() => {
    if (!datasetId || kind !== 'report') {
      setReportPages([]);
      setPickedPages({});
      setFileStats(null);
      return;
    }
    let live = true;
    void flowJson<{
      document?: { pages?: unknown[] } | null;
      has_document?: boolean;
    }>(`/datasets/${datasetId}/report/document`)
      .then(body => {
        if (!live) return;
        if (!body.has_document || !body.document?.pages?.length) {
          setReportPages([]);
          setPickedPages({});
          return;
        }
        const pages = pagesFromReportDocument(body.document);
        setReportPages(pages);
        setPickedPages(Object.fromEntries(pages.map(page => [page.id, true])));
        // Research report: exec summary on when the Report has a summary page.
        const hasSummary = pages.some(page => isSummaryExportPage(page));
        setWithNote(hasSummary);
        setMethodsOn(pages.some(page => isAppendixExportPage(page)));
        setExpandedGroups(
          Object.fromEntries(
            groupReportExportPages(pages).map(group => [group.key, group.defaultExpanded])
          )
        );
      })
      .catch(() => {
        if (live) {
          setReportPages([]);
          setPickedPages({});
        }
      });
    void Promise.all([
      flowJson<{ n_rows?: number; n_cols?: number }>(`/datasets/${datasetId}/schema`).catch(() => ({
        n_rows: 0,
        n_cols: 0,
      })),
      flowJson<{
        columns?: {
          name?: string;
          label?: string;
          measure?: string;
          role?: string;
          linked_set?: string;
        }[];
        variable_sets?: unknown[];
        multiple_response_sets?: unknown[];
        weight_variable?: string;
      }>(`/datasets/${datasetId}/metadata`).catch(
        (): {
          columns?: {
            name?: string;
            label?: string;
            measure?: string;
            role?: string;
            linked_set?: string;
          }[];
          variable_sets?: unknown[];
          multiple_response_sets?: unknown[];
          weight_variable?: string;
        } => ({})
      ),
    ]).then(([schema, meta]) => {
      if (!live) return;
      const rows = Number(schema.n_rows || 0);
      const sets = (
        Array.isArray(meta.variable_sets)
          ? meta.variable_sets
          : Array.isArray(meta.multiple_response_sets)
            ? meta.multiple_response_sets
            : []
      ) as {
        id?: string;
        name?: string;
        label?: string;
        kind?: string;
        structure?: string;
        columns?: string[];
        text_columns?: { column?: string }[];
      }[];
      const flowColumns: FlowColumn[] = (meta.columns || [])
        .map(column => {
          const name = String(column.name || '').trim();
          if (!name || isInternalColumn(name)) return null;
          return {
            name,
            label: String(column.label || name),
            measure: String(column.measure || ''),
            role: String(column.role || ''),
            linked_set: String(column.linked_set || ''),
          } as FlowColumn;
        })
        .filter((column): column is FlowColumn => Boolean(column));
      // Same outline the Details tab uses — not raw set+single column counts.
      const outline = questionnaireOutline(flowColumns, sets, {
        weightName: String(meta.weight_variable || ''),
      });
      setFileStats({ rows, questions: outline.length });
    });
    return () => {
      live = false;
    };
  }, [datasetId, kind]);

  useEffect(() => {
    if (!datasetId || kind !== 'report' || reportFormat !== 'pptx' || !perGroup) return;
    let live = true;
    void flowJson<{
      columns?: { name?: string; label?: string; measure?: string }[];
    }>(`/datasets/${datasetId}/metadata`)
      .then(body => {
        if (!live) return;
        const next = (body.columns || [])
          .filter(col => {
            const name = String(col.name || '');
            if (!name || isInternalColumn(name) || isIdColumn(name)) return false;
            const measure = String(col.measure || '').toLowerCase();
            return measure !== 'numeric' && measure !== 'text' && measure !== 'datetime';
          })
          .map(col => ({
            value: String(col.name || ''),
            label: String(col.label || col.name || '').trim() || String(col.name || ''),
          }));
        setGroupOptions(next);
        if (!groupColumn && next[0]) setGroupColumn(next[0].value);
      })
      .catch(() => {
        if (live) setGroupOptions([]);
      });
    return () => {
      live = false;
    };
  }, [datasetId, kind, reportFormat, perGroup, groupColumn]);

  useEffect(() => {
    if (!datasetId || !perGroup || !groupColumn) {
      setGroupValues(null);
      return;
    }
    let live = true;
    void flowJson<ColumnValues>(
      `/datasets/${datasetId}/columns/${encodeURIComponent(groupColumn)}/values`
    )
      .then(body => {
        if (!live) return;
        setGroupValues(body);
        setPickedGroups(Object.fromEntries((body.values || []).map(value => [value, true])));
      })
      .catch(() => {
        if (live) setGroupValues(null);
      });
    return () => {
      live = false;
    };
  }, [datasetId, perGroup, groupColumn]);

  const save = (name: string, action: () => Promise<void> | void) => {
    setBusy(name);
    setError('');
    void Promise.resolve(action())
      .then(() =>
        setSaved(
          name.startsWith('Copy') ? 'Copied. Paste it where you need it.' : `${name} downloaded.`
        )
      )
      .catch(err => setError(err instanceof Error ? err.message : 'Could not export'))
      .finally(() => setBusy(''));
  };

  const exportBody = (ids: string[]) => {
    const path = typeof window === 'undefined' ? '' : window.location.pathname;
    const project = path.match(/\/flow\/p\/[^/]+/);
    const link =
      liveOn && project && typeof window !== 'undefined'
        ? `${window.location.origin}${project[0]}/report`
        : '';
    return pipelineExportPayload({
      runIds: ids,
      style,
      includeMethods: methodsOn,
      liveLink: link,
      projectId,
    });
  };

  const serverFor = (format: 'pdf' | 'docx' | 'html', filename: string, ids: string[]) => {
    if (!ids.length) throw new Error('Pin a saved analysis before exporting this format.');
    return downloadExport(`/datasets/reports/pipeline/export?format=${format}`, filename, {
      method: 'POST',
      body: exportBody(ids),
    });
  };

  const server = (format: 'pdf' | 'docx' | 'html', filename: string) => {
    if (!runIds.length) throw new Error('Save the analysis before exporting this format.');
    return downloadExport(`/datasets/reports/pipeline/export?format=${format}`, filename, {
      method: 'POST',
      body: exportBody(runIds),
    });
  };

  if (kind === 'report') {
    const chosen = current.tables.filter((_, index) => included[index] !== false);
    const reportDoc = { ...current, tables: chosen };
    const chosenRuns = runIds.filter((_, index) => included[index] !== false);
    const selectedPageIds = reportPages
      .filter(page => pickedPages[page.id] !== false)
      .map(page => page.id);
    const allPagesSelected =
      totalPageCount > 0 && selectedPageCount === totalPageCount && selectedPageCount > 0;
    const formats: {
      id: ReportExportFormatId;
      ext: string;
      label: string;
      note: string;
      soon?: boolean;
      run?: () => Promise<void> | void;
    }[] = reportExportFormatMeta().map(meta => {
      if (meta.id === 'docx') {
        return {
          ...meta,
          run: () => serverFor('docx', `${stem}.docx`, chosenRuns),
        };
      }
      if (meta.id === 'pptx') {
        return {
          ...meta,
          note: datasetId
            ? perGroup
              ? 'One PowerPoint per group value'
              : meta.note
            : 'Open a file to build a deck',
          soon: !datasetId,
          run: () => {
            if (perGroup) {
              const values = Object.entries(pickedGroups)
                .filter(([, on]) => on)
                .map(([value]) => value);
              return deckBatchFromTables(datasetId || '', stem, groupColumn, values);
            }
            return deckFromTables(datasetId || '', stem, {
              pageIds: selectedPageIds,
              onProgress: message => setBusy(message),
            });
          },
        };
      }
      if (meta.id === 'xlsx') {
        return {
          ...meta,
          note: datasetId ? meta.note : 'Open a file to build a banner book',
          soon: !datasetId,
          run: () =>
            bannerBookFromTables(datasetId || '', stem, {
              pageIds: selectedPageIds,
              projectId,
            }),
        };
      }
      if (meta.id === 'pdf') {
        return {
          ...meta,
          soon: !chosenRuns.length,
          note: chosenRuns.length ? meta.note : 'Pin a saved analysis to export PDF',
          run: () => serverFor('pdf', `${stem}.pdf`, chosenRuns),
        };
      }
      if (meta.id === 'md') {
        return {
          ...meta,
          soon: !chosen.length,
          note: chosen.length ? meta.note : 'Include at least one table or finding',
          run: () => downloadText(`${stem}.md`, documentMarkdown(reportDoc), 'text/markdown'),
        };
      }
      return {
        ...meta,
        soon: !datasetId,
        note: datasetId ? meta.note : 'Open a file to export the dataset',
        run: () => savAndSyntax(datasetId || '', stem),
      };
    });
    const format = formats.find(item => item.id === reportFormat) || formats[0];
    const headerBits = [
      title,
      fileStats?.rows
        ? `${fileStats.rows.toLocaleString('en-GB')} respondent${fileStats.rows === 1 ? '' : 's'}`
        : '',
      fileStats?.questions
        ? `${fileStats.questions.toLocaleString('en-GB')} question${
            fileStats.questions === 1 ? '' : 's'
          }`
        : totalPageCount
          ? `${totalPageCount} page${totalPageCount === 1 ? '' : 's'}`
          : '',
    ].filter(Boolean);
    const estimatedSeconds =
      format.id === 'pptx' ? estimateOfficeDeckSeconds(selectedPageCount || totalPageCount) : 0;
    const setGroupChecked = (pageIds: string[], on: boolean) => {
      setPickedPages(currentMap => {
        const next = { ...currentMap };
        for (const id of pageIds) next[id] = on;
        return next;
      });
    };
    const setSummaryToggle = (on: boolean) => {
      setWithNote(on);
      const ids = reportPages.filter(page => isSummaryExportPage(page)).map(page => page.id);
      if (ids.length) setGroupChecked(ids, on);
    };
    const setAppendixToggle = (on: boolean) => {
      setMethodsOn(on);
      const ids = reportPages.filter(page => isAppendixExportPage(page)).map(page => page.id);
      if (ids.length) setGroupChecked(ids, on);
    };
    return (
      <Dialog open onOpenChange={open => !open && onClose()}>
        <DialogContent className="export-dialog xr flow-modal">
          <DialogHeader className="xp-head flow-modal-head">
            <p className="xp-eyebrow">{headerBits.join(' · ')}</p>
            <DialogTitle>Export report</DialogTitle>
            <DialogDescription className="sr-only">
              Choose a format and what to include.
            </DialogDescription>
          </DialogHeader>
          <div className="xr-body">
            <div className="xr-left">
              <span className="xp-label">Format</span>
              <div className="xr-formats">
                {formats.map(item => (
                  <Button
                    key={item.id}
                    className="xr-format"
                    type="button"
                    data-active={item.id === format.id || undefined}
                    disabled={item.soon}
                    onClick={() => setReportFormat(item.id)}
                  >
                    <span className="xr-format-top">
                      <span className="xp-ext">{item.ext}</span>
                      <i />
                    </span>
                    <strong>{item.label}</strong>
                    <span>{item.note}</span>
                  </Button>
                ))}
              </div>
              <span className="xp-label">Template</span>
              <div className="xp-segment">
                {(['apa', 'client', 'plain'] as const).map(item => (
                  <Button
                    key={item}
                    type="button"
                    data-active={style === item}
                    onClick={() => setStyle(item)}
                  >
                    {item === 'apa' ? 'Research report' : item === 'client' ? 'Client' : 'Plain'}
                  </Button>
                ))}
              </div>
              <div className="xr-toggles">
                {reportFormat === 'pptx' ? (
                  <>
                    <label className="xp-toggle">
                      <span>
                        <strong>Executive summary slide</strong>
                      </span>
                      <Switch
                        checked={withNote}
                        onCheckedChange={setSummaryToggle}
                        aria-label="Executive summary slide"
                      />
                    </label>
                    <label className="xp-toggle">
                      <span>
                        <strong>Question appendix, one slide per question</strong>
                      </span>
                      <Switch
                        checked={methodsOn}
                        onCheckedChange={setAppendixToggle}
                        aria-label="Question appendix"
                      />
                    </label>
                    <label className="xp-toggle">
                      <span>
                        <strong>Show unweighted base on every slide</strong>
                      </span>
                      <Switch
                        checked={liveOn}
                        onCheckedChange={setLiveOn}
                        aria-label="Show unweighted base"
                      />
                    </label>
                    {datasetId ? (
                      <label className="xp-toggle">
                        <span>
                          <strong>One copy per group</strong>
                          <span className="flow-muted">
                            {' '}
                            Separate PowerPoint for each value (country, region, …)
                          </span>
                        </span>
                        <Switch
                          checked={perGroup}
                          onCheckedChange={setPerGroup}
                          aria-label="One copy per group"
                        />
                      </label>
                    ) : null}
                  </>
                ) : (
                  <>
                    <label className="xp-toggle">
                      <span>
                        <strong>Results paragraphs in APA style</strong>
                      </span>
                      <Switch
                        checked={withNote}
                        onCheckedChange={setWithNote}
                        aria-label="Results paragraphs"
                      />
                    </label>
                    <label className="xp-toggle">
                      <span>
                        <strong>Include methods appendix</strong>
                      </span>
                      <Switch
                        checked={methodsOn}
                        onCheckedChange={setMethodsOn}
                        aria-label="Methods appendix"
                      />
                    </label>
                    <label className="xp-toggle">
                      <span>
                        <strong>Keep live link back to Tensr in captions</strong>
                      </span>
                      <Switch checked={liveOn} onCheckedChange={setLiveOn} aria-label="Live link" />
                    </label>
                  </>
                )}
              </div>
              {datasetId && reportFormat === 'pptx' && perGroup ? (
                <div className="xr-per-group" data-testid="export-per-group">
                  <span className="xp-label">Group by</span>
                  <ChoiceSelect
                    aria-label="Group by"
                    className="flow-input"
                    value={groupColumn}
                    onValueChange={setGroupColumn}
                    options={groupOptions}
                    placeholder="Choose a column"
                  />
                  <span className="xp-label">Values</span>
                  <div className="xr-include xr-include-scroll">
                    {(groupValues?.values || []).length === 0 ? (
                      <p className="flow-muted">
                        {groupColumn ? 'Loading values…' : 'Choose a column first.'}
                      </p>
                    ) : (
                      (groupValues?.values || []).map(value => (
                        <label key={value} className="xr-item">
                          <Checkbox
                            checked={pickedGroups[value] !== false}
                            onCheckedChange={on =>
                              setPickedGroups(currentMap => ({
                                ...currentMap,
                                [value]: on === true,
                              }))
                            }
                          />
                          <span>
                            {valueLabel(value, groupValues?.value_labels)}
                            {typeof groupValues?.counts?.[value] === 'number'
                              ? ` · ${groupValues.counts[value]}`
                              : ''}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="xr-right">
              <div className="xr-pages-head">
                <span className="xp-label">Pages to include</span>
                {reportPages.length > 0 ? (
                  <Button
                    type="button"
                    className="xr-select-all"
                    onClick={() =>
                      setPickedPages(
                        Object.fromEntries(reportPages.map(page => [page.id, !allPagesSelected]))
                      )
                    }
                  >
                    {allPagesSelected ? 'Deselect all' : 'Select all'}
                  </Button>
                ) : null}
              </div>
              <div className="xr-page-groups" data-testid="export-page-groups">
                {reportGroups.length > 0 ? (
                  reportGroups.map(group => {
                    const selected = group.pages.filter(
                      page => pickedPages[page.id] !== false
                    ).length;
                    const open =
                      group.key in expandedGroups
                        ? expandedGroups[group.key] === true
                        : group.defaultExpanded;
                    const preview = open
                      ? group.pages
                      : group.pages.slice(0, group.key === 'appendix' ? 2 : 3);
                    const hidden = Math.max(0, group.pages.length - preview.length);
                    return (
                      <div key={group.key} className="xr-page-group">
                        <label className="xr-group-row">
                          <Checkbox
                            checked={selected === group.pages.length && group.pages.length > 0}
                            onCheckedChange={value =>
                              setGroupChecked(
                                group.pages.map(page => page.id),
                                value === true
                              )
                            }
                            aria-label={`Include ${group.label}`}
                          />
                          <Button
                            type="button"
                            className="xr-group-toggle"
                            onClick={() =>
                              setExpandedGroups(currentMap => ({
                                ...currentMap,
                                [group.key]: !open,
                              }))
                            }
                          >
                            <strong>{group.label}</strong>
                            <span>
                              {selected} of {group.pages.length}
                            </span>
                          </Button>
                        </label>
                        {open || preview.length > 0 ? (
                          <div className="xr-group-pages">
                            {preview.map(page => {
                              const index = group.pages.findIndex(row => row.id === page.id);
                              const number = index >= 0 ? index + 1 : 1;
                              return (
                                <label key={page.id} className="xr-item">
                                  <Checkbox
                                    checked={pickedPages[page.id] !== false}
                                    onCheckedChange={value =>
                                      setPickedPages(currentMap => ({
                                        ...currentMap,
                                        [page.id]: value === true,
                                      }))
                                    }
                                    aria-label={`Include ${page.title}`}
                                  />
                                  <span>
                                    {group.key === 'appendix'
                                      ? `Q${number} · ${page.title}`
                                      : `${String(number).padStart(2, '0')} · ${page.title}`}
                                  </span>
                                </label>
                              );
                            })}
                            {!open && hidden > 0 ? (
                              <Button
                                type="button"
                                className="xr-more"
                                onClick={() =>
                                  setExpandedGroups(currentMap => ({
                                    ...currentMap,
                                    [group.key]: true,
                                  }))
                                }
                              >
                                {group.key === 'appendix'
                                  ? 'Collapsed by default, expand to pick questions'
                                  : `+ ${hidden} more`}
                              </Button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                ) : current.tables.length === 0 ? (
                  <p className="flow-muted">
                    Open Report after a deck build, or pin a finding with Add to report.
                  </p>
                ) : (
                  current.tables.map((table, index) => (
                    <label key={`${table.title}-${index}`} className="xr-item">
                      <Checkbox
                        checked={included[index] !== false}
                        onCheckedChange={value =>
                          setIncluded(currentMap => ({ ...currentMap, [index]: value === true }))
                        }
                      />
                      <span>
                        T{index + 1} · {table.title}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>
          <div className="xp-foot flow-modal-foot">
            <div className="xp-help">
              {error ? (
                <span className="flow-error">{error}</span>
              ) : saved ? (
                <span>{saved}</span>
              ) : format.id === 'pptx' ? (
                <span>
                  Figures export as editable charts.
                  {estimatedSeconds ? ` Estimated time about ${estimatedSeconds} seconds.` : ''}
                </span>
              ) : format.id === 'pdf' ? (
                <span>Figures export at 300 dpi. Layout is fixed.</span>
              ) : format.id === 'md' ? (
                <span>Plain text, figures as files.</span>
              ) : format.id === 'sav' ? (
                <span>Downloads the open file as .sav with an .sps weight file.</span>
              ) : format.id === 'xlsx' ? (
                <span>Every table as a sheet, with real numbers and significance letters.</span>
              ) : (
                <span>Figures export at 300 dpi. Tables stay editable in Word.</span>
              )}
            </div>
            <Button className="flow-btn" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button
              className="flow-btn primary"
              type="button"
              disabled={
                busy !== '' ||
                !format.run ||
                Boolean(format.soon) ||
                (format.id === 'pptx' &&
                  perGroup &&
                  (!groupColumn || !Object.values(pickedGroups).some(Boolean))) ||
                (format.id === 'pptx' &&
                  !perGroup &&
                  totalPageCount > 0 &&
                  selectedPageCount === 0) ||
                (format.id !== 'pptx' &&
                  format.id !== 'xlsx' &&
                  format.id !== 'sav' &&
                  !chosen.length &&
                  totalPageCount === 0)
              }
              onClick={() => format.run && save(format.label, format.run)}
            >
              {busy
                ? busy === format.label
                  ? 'Working…'
                  : busy
                : format.id === 'pptx' && perGroup
                  ? 'Export copies'
                  : format.id === 'pptx'
                    ? `Export .pptx · ${selectedPageCount || totalPageCount} of ${
                        totalPageCount || selectedPageCount || 0
                      } pages`
                    : format.id === 'sav'
                      ? 'Export SPSS data'
                      : `Export ${format.ext.toLowerCase().split(' ')[0]}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  type Choice = {
    id: string;
    label: string;
    ext: string;
    note?: string;
    soon?: boolean;
    run?: () => Promise<void> | void;
  };
  const table = current.tables[0];
  const tableHtml = table
    ? `<table><caption>${caption}</caption><tr>${table.columns
        .map(column => `<th>${column}</th>`)
        .join('')}</tr>${table.rows
        .map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`)
        .join('')}</table>`
    : '';
  const copies: Choice[] = [
    ...(svg ? [{ id: 'copy-image', label: 'Copy as image', ext: '' }] : []),
    {
      id: 'copy-table',
      label: kind === 'chart' ? 'Copy data as table' : 'Copy as table (editable)',
      ext: '',
      note: 'Pastes into Word, PowerPoint, Excel, Google Docs or Slides',
      run: async () => {
        const plain = documentMarkdown(current);
        if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
          await navigator.clipboard.write([
            new ClipboardItem({
              'text/html': new Blob([tableHtml], { type: 'text/html' }),
              'text/plain': new Blob([plain], { type: 'text/plain' }),
            }),
          ]);
        } else {
          await copyText(plain);
        }
      },
    },
  ];
  const downloads: Choice[] = [
    { id: 'docx', label: 'Word', ext: '.docx', run: () => server('docx', `${stem}.docx`) },
    {
      id: 'pptx',
      label: 'PowerPoint',
      ext: '.pptx',
      note: runIds.length ? 'One slide · editable chart' : 'Save the analysis first',
      soon: !runIds.length,
      run: () =>
        downloadExport(`/datasets/reports/pipeline/export?format=pptx`, `${stem}.pptx`, {
          method: 'POST',
          body: JSON.stringify({
            ...JSON.parse(exportBody(runIds)),
            single_slide: true,
          }),
        }),
    },
    {
      id: 'xlsx',
      label: 'Excel',
      ext: '.xlsx',
      note: current.tables.length ? 'Editable numbers' : 'No table on this output',
      soon: !current.tables.length,
      run: () => workbookFromRunDocument(current, stem, { datasetId }),
    },
    { id: 'pdf', label: 'PDF', ext: '.pdf', run: () => server('pdf', `${stem}.pdf`) },
    { id: 'html', label: 'HTML', ext: '.html', run: () => server('html', `${stem}.html`) },
    ...(svg
      ? [
          {
            id: 'png',
            label: 'PNG',
            ext: '.png',
            note: '3x',
            run: () => downloadSvg(svg, `${stem}.png`, 3),
          },
          {
            id: 'svg',
            label: 'SVG',
            ext: '.svg',
            run: () => downloadText(`${stem}.svg`, svg, 'image/svg+xml'),
          },
        ]
      : []),
    {
      id: 'csv',
      label: 'CSV',
      ext: '.csv',
      run: () => downloadText(`${stem}.csv`, documentCsv(current), 'text/csv'),
    },
    {
      id: 'md',
      label: 'Markdown',
      ext: '.md',
      run: () => downloadText(`${stem}.md`, documentMarkdown(current), 'text/markdown'),
    },
    {
      id: 'apa',
      label: 'APA text',
      ext: '.txt',
      run: () => downloadText(`${stem}-apa.txt`, documentApa(current), 'text/plain'),
    },
  ];
  const all = [...copies, ...downloads];
  const picked = all.find(item => item.id === choice) || copies[copies.length - 1];
  if (picked.id === 'copy-image' && svg && !picked.run) {
    picked.run = async () => {
      if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
        throw new Error('This browser cannot copy images. Download the PNG instead.');
      }
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/svg+xml': new Blob([svg], { type: 'image/svg+xml' }) }),
      ]);
    };
  }
  const choiceRow = (item: Choice) => (
    <label
      key={item.id}
      className="xp-choice"
      data-active={item.id === picked.id || undefined}
      data-soon={item.soon || undefined}
    >
      <RadioGroupItem value={item.id} disabled={item.soon} />
      <span className="xp-choice-copy">
        <span>{item.label}</span>
        {item.note ? <span>{item.note}</span> : null}
      </span>
      {item.ext ? <span className="xp-ext">{item.ext}</span> : null}
    </label>
  );
  const heading =
    kind === 'chart' ? 'Export chart' : kind === 'table' ? 'Export table' : 'Export report';

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="export-dialog xp">
        <DialogHeader className="xp-head">
          <p className="xp-eyebrow">{title}</p>
          <DialogTitle>{heading}</DialogTitle>
          <DialogDescription className="sr-only">Choose a format and style.</DialogDescription>
          <span className="xp-live">Live preview of what you will get</span>
        </DialogHeader>
        <div className="xp-body">
          <RadioGroup className="xp-col xp-formats" value={picked.id} onValueChange={setChoice}>
            <span className="xp-label">Copy</span>
            {copies.map(choiceRow)}
            <span className="xp-label">Download</span>
            {downloads.map(choiceRow)}
          </RadioGroup>
          <div className="xp-col xp-style">
            <span className="xp-label">Style</span>
            <div className="xp-segment">
              {(['apa', 'client', 'plain'] as const).map(item => (
                <Button
                  key={item}
                  type="button"
                  data-active={style === item}
                  onClick={() => setStyle(item)}
                >
                  {item === 'apa' ? 'APA 7' : item === 'client' ? 'Client template' : 'Plain'}
                </Button>
              ))}
            </div>
            <label className="xp-field">
              <span>{kind === 'chart' ? 'Figure' : 'Table'} number</span>
              <Input value={number} onChange={event => setNumber(event.target.value)} />
            </label>
            <label className="xp-field">
              <span>Title · italic, title case</span>
              <Textarea
                aria-label="Export title"
                rows={2}
                value={caption}
                onChange={event => setCaption(event.target.value)}
              />
            </label>
            {kind === 'chart' ? (
              <>
                <label className="xp-field">
                  <span>Note</span>
                  <Textarea
                    aria-label="Export note"
                    rows={3}
                    className="xp-note-field"
                    value={note}
                    onChange={event => setNote(event.target.value)}
                  />
                </label>
                <label className="xp-toggle">
                  <span>
                    <strong>Include caption as editable text</strong>
                    <span>
                      Figure number, title and note paste as text, not as part of the image
                    </span>
                  </span>
                  <Switch
                    checked={withNote}
                    onCheckedChange={setWithNote}
                    aria-label="Caption as text"
                  />
                </label>
              </>
            ) : null}
            <label className="xp-toggle" hidden={kind === 'chart'}>
              <span>
                <strong>Italicise statistics</strong>
                <span>n, M, SD, F, p</span>
              </span>
              <Switch
                checked={italics}
                onCheckedChange={setItalics}
                aria-label="Italicise statistics"
              />
            </label>
            <div className="xp-sentence" hidden={kind === 'chart'}>
              <label className="xp-toggle">
                <span>
                  <strong>Results sentence</strong>
                  <span>APA write-up for your results section</span>
                </span>
                <Switch
                  checked={withNote}
                  onCheckedChange={setWithNote}
                  aria-label="Results sentence"
                />
              </label>
              {withNote ? (
                <Textarea
                  aria-label="Export note"
                  rows={5}
                  value={note}
                  onChange={event => setNote(event.target.value)}
                />
              ) : null}
            </div>
          </div>
          <div className="xp-col xp-preview">
            <div className="xp-preview-head">
              <span>
                Preview · {style === 'plain' ? 'plain' : style === 'client' ? 'client' : 'APA 7'}
              </span>
              <span>100%</span>
            </div>
            <div className="xp-page" data-style={style} data-italics={italics || undefined}>
              <p className="xp-number">
                {kind === 'chart' ? 'Figure' : 'Table'} {number}
              </p>
              <p className="xp-title">{caption}</p>
              {svg && kind === 'chart' ? (
                <div className="xp-figure" dangerouslySetInnerHTML={{ __html: svg }} />
              ) : null}
              {table && kind !== 'chart' ? (
                <table>
                  <thead>
                    <tr>
                      {table.columns.map(column => (
                        <th key={column}>{column}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {table.rows.slice(0, 12).map(row => (
                      <tr key={row.join('|')}>
                        {row.map((cell, index) => (
                          <td key={`${cell}-${index}`}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
              {withNote && note ? (
                <p className="xp-note">
                  <em>Note.</em> {note}
                </p>
              ) : null}
            </div>
          </div>
        </div>
        <div className="xp-foot">
          <div className="xp-help">
            {error ? (
              <span className="flow-error">{error}</span>
            ) : saved ? (
              <span>{saved}</span>
            ) : (
              <>
                <strong>Paste with ⌘V in Word, PowerPoint, Excel, Google Docs or Slides</strong>
                <span>Captions and notes stay editable text.</span>
              </>
            )}
          </div>
          <Button className="flow-btn" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="flow-btn primary"
            type="button"
            disabled={busy !== '' || !picked.run}
            onClick={() => picked.run && save(picked.label, picked.run)}
          >
            {busy
              ? 'Working…'
              : picked.id.startsWith('copy')
                ? picked.id === 'copy-image'
                  ? 'Copy image'
                  : 'Copy table'
                : `Download ${picked.label}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ExportPreview({ table }: { table: RunTable }) {
  return (
    <div className="export-preview">
      <p className="flow-muted">{table.title}</p>
      <div className="outputs-row">
        {table.columns.map(column => (
          <span key={column}>{column}</span>
        ))}
      </div>
      {table.rows.slice(0, 6).map(row => (
        <div key={row.join('|')} className="outputs-row">
          {row.map((cell, index) => (
            <span key={`${cell}-${index}`}>{cell}</span>
          ))}
        </div>
      ))}
    </div>
  );
}

export function copyText(value: string): Promise<void> {
  return navigator.clipboard.writeText(value);
}

export function figureSvg(table: RunTable | undefined): string {
  if (!table) return '';
  const valueIndex = table.columns.findIndex(column => /mean|percent|%/i.test(column));
  const labelIndex = 0;
  if (valueIndex < 0) return '';
  const points = table.rows
    .map(row => ({ label: row[labelIndex] || '', value: Number(row[valueIndex]) }))
    .filter(point => point.label && Number.isFinite(point.value));
  if (!points.length) return '';
  const min = Math.min(...points.map(point => point.value));
  const max = Math.max(...points.map(point => point.value));
  const span = max === min ? 1 : max - min;
  const rows = points
    .map((point, index) => {
      const y = 28 + index * 28;
      const x = 120 + ((point.value - min) / span) * 280;
      return `<text x="8" y="${y + 4}" font-size="12" fill="#1B1C1A">${point.label}</text><circle cx="${x}" cy="${y}" r="4" fill="#1E6B58" />`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="${Math.max(points.length * 28 + 24, 80)}" viewBox="0 0 440 ${Math.max(points.length * 28 + 24, 80)}">${rows}</svg>`;
}

export function CaptionFields({
  title,
  note,
  onTitle,
  onNote,
}: {
  title: string;
  note: string;
  onTitle: (value: string) => void;
  onNote: (value: string) => void;
}) {
  return (
    <>
      <Input
        aria-label="Export title"
        value={title}
        onChange={event => onTitle(event.target.value)}
      />
      <Textarea
        aria-label="Export note"
        value={note}
        onChange={event => onNote(event.target.value)}
      />
    </>
  );
}
