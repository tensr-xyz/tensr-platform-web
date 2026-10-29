'use client';

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getStytchBearerForTensrApi, getTensrApiHeaders } from '@/utils/auth';
import { ApiRequestError, formatApiErrorMessage } from '@/lib/api-error';
import { tensrApiUrl } from '@/lib/tensr-api-url';
import { streamAgentLoop } from '@/lib/stream-agent-loop';
import { Button } from '@/components/atoms/button';
import {
  categoricalColumns,
  codedStub,
  datasetSwitcherLabel,
  efficiencyPercent,
  isCrosstabBook,
  isInternalColumn,
  bannerHeading,
  lettersFor,
  looksLikeCrosstab,
  newestDatasetId,
  numericColumns,
  visibleColumns,
  type BannerCell,
  type BannerColumn,
  type BannerRow,
  type ColumnInfo,
  type ColumnSample,
  type SigLetter,
} from './shell-helpers';

export type StudyProject = {
  id: string;
  name: string;
  status?: string;
  folder?: string | null;
  active_dataset_id?: string | null;
};

export type StudyDataset = {
  id: string;
  original_filename?: string;
  n_rows?: number;
  lineage_label?: string | null;
  updated_at?: string | null;
};

export type SelectedCell = {
  bitset: string;
  textColumn: string;
  claim: string;
  base: string;
  weight: string;
};

type TabId = 'chat' | 'sources' | 'responses' | 'tables' | 'report';

const TABS: { id: TabId; label: string; live: boolean }[] = [
  { id: 'chat', label: 'Chat', live: false },
  { id: 'sources', label: 'Sources', live: false },
  { id: 'responses', label: 'Responses', live: true },
  { id: 'tables', label: 'Tables', live: true },
  { id: 'report', label: 'Report', live: false },
];

async function downloadFile(path: string, filename: string, method = 'GET') {
  const token = getStytchBearerForTensrApi();
  const response = await fetch(tensrApiUrl(path), {
    method,
    headers: {
      ...getTensrApiHeaders(),
      Authorization: token ? `Bearer ${token}` : '',
    },
  });
  if (!response.ok) throw new Error(await response.text());
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function api(path: string, init?: RequestInit): Promise<any> {
  const token = getStytchBearerForTensrApi();
  const response = await fetch(tensrApiUrl(path), {
    ...init,
    headers: {
      ...getTensrApiHeaders(),
      Authorization: token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  const text = await response.text();
  let body: any = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = {};
  }
  if (!response.ok) {
    throw new Error(formatApiErrorMessage(new ApiRequestError(response.status, text)));
  }
  return body;
}

export function StudyShell({
  project,
  datasets,
  onBack,
  onAdopted,
}: {
  project: StudyProject;
  datasets: StudyDataset[];
  onBack: () => void;
  onAdopted?: (dataset: StudyDataset) => void;
}) {
  const [tab, setTab] = useState<TabId>('responses');
  const [datasetId, setDatasetId] = useState(() =>
    newestDatasetId(datasets, project.active_dataset_id)
  );
  const [cell, setCell] = useState<SelectedCell | null>(null);
  const [evidenceRequest, setEvidenceRequest] = useState(0);
  const active = TABS.find(item => item.id === tab);

  function adopt(dataset: StudyDataset) {
    onAdopted?.(dataset);
    setDatasetId(dataset.id);
  }

  function openEvidence(selected: SelectedCell) {
    setCell(selected);
    setTab('responses');
    setEvidenceRequest(value => value + 1);
  }

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
      <header className="border-b border-border px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <button type="button" className="text-xs text-muted-foreground" onClick={onBack}>
              Studies
            </button>
            <h1 className="text-xl font-medium tracking-tight">{project.name}</h1>
          </div>
          <label className="text-sm text-muted-foreground">
            Dataset{' '}
            <select
              className="ml-2 rounded-md border border-border bg-background px-2 py-1 text-foreground"
              value={datasetId}
              onChange={event => setDatasetId(event.target.value)}
            >
              {datasets.map(dataset => (
                <option key={dataset.id} value={dataset.id}>
                  {datasetSwitcherLabel(dataset)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <nav className="mt-4 flex gap-1" aria-label="Project">
          {TABS.map(item => (
            <button
              key={item.id}
              type="button"
              aria-current={tab === item.id ? 'page' : undefined}
              className={`rounded-full px-3 py-1.5 text-sm ${
                tab === item.id ? 'bg-foreground text-background' : 'text-muted-foreground'
              }`}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>
      <main className="flex-1 px-6 py-5">
        {!active?.live ? (
          <p className="text-sm text-muted-foreground">Coming next.</p>
        ) : tab === 'responses' ? (
          <Responses
            datasetId={datasetId}
            datasets={datasets}
            cell={cell}
            evidenceRequest={evidenceRequest}
            onSelectCell={setCell}
            onAdopted={adopt}
          />
        ) : (
          <TablesPanel datasetId={datasetId} projectId={project.id} onSelectCell={openEvidence} />
        )}
      </main>
    </div>
  );
}

const SHEET_PAGE = 100;

function Responses({
  datasetId,
  datasets,
  cell,
  evidenceRequest,
  onSelectCell,
  onAdopted,
}: {
  datasetId: string;
  datasets: StudyDataset[];
  cell: SelectedCell | null;
  evidenceRequest: number;
  onSelectCell: (cell: SelectedCell) => void;
  onAdopted: (dataset: StudyDataset) => void;
}) {
  const [view, setView] = useState<'sheet' | 'evidence' | 'themes' | 'frame'>(
    evidenceRequest ? 'evidence' : 'sheet'
  );
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const [filterColumn, setFilterColumn] = useState('');
  const [filterValue, setFilterValue] = useState('');
  const [showLabels, setShowLabels] = useState(true);
  const sheetKey = `${datasetId}|${filterColumn}|${filterValue}|${showLabels}`;
  const [sheetPage, setSheetPage] = useState({ key: sheetKey, offset: 0 });
  if (sheetPage.key !== sheetKey) {
    setSheetPage({ key: sheetKey, offset: 0 });
  }
  const offset = sheetPage.key === sheetKey ? sheetPage.offset : 0;
  const [selectedColumn, setSelectedColumn] = useState('');
  const [frequencies, setFrequencies] = useState<Record<string, unknown> | null>(null);
  const [quality, setQuality] = useState<Record<string, unknown> | null>(null);
  const [quotes, setQuotes] = useState<Record<string, unknown> | null>(null);
  const [weightOpen, setWeightOpen] = useState(false);
  const [anovaOpen, setAnovaOpen] = useState(false);

  useEffect(() => {
    if (!datasetId) return;
    const params = new URLSearchParams({
      limit: String(SHEET_PAGE),
      offset: String(offset),
      show_value_labels: String(showLabels),
    });
    if (filterColumn && filterValue) {
      params.set('filter_column', filterColumn);
      params.set('filter_value', filterValue);
    }
    setError('');
    api(`/datasets/${datasetId}/preview?${params}`)
      .then(setPreview)
      .catch(err => setError(err.message));
    api(`/datasets/${datasetId}/data-quality`)
      .then(setQuality)
      .catch(() => setQuality(null));
  }, [datasetId, filterColumn, filterValue, showLabels, offset]);

  const allColumns = (preview?.variable_names as string[]) || [];
  const shownIndexes = allColumns
    .map((name, index) => (isInternalColumn(name) ? -1 : index))
    .filter(index => index >= 0);
  const columns = shownIndexes.map(index => allColumns[index]);
  const rows = ((preview?.rows as unknown[][]) || []).map(row =>
    shownIndexes.map(index => row[index])
  );
  const columnInfo = ((preview?.columns as ColumnInfo[]) || []).filter(column => column?.name);
  const sample: ColumnSample = {
    names: allColumns,
    values: (preview?.rows as unknown[][]) || [],
  };
  const typed = columnInfo.some(column => column.type || column.measure);
  const factorColumns = typed ? categoricalColumns(columnInfo, sample) : columns;
  const dependentColumns = typed ? numericColumns(columnInfo, sample) : columns;

  useEffect(() => {
    if (!datasetId || !selectedColumn) return;
    api(`/datasets/${datasetId}/explore/column_frequencies`, {
      method: 'POST',
      body: JSON.stringify({ column: selectedColumn }),
    })
      .then(setFrequencies)
      .catch(err => setError(err.message));
  }, [datasetId, selectedColumn]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div>
        <div className="mb-3 flex flex-wrap gap-2">
          {(['sheet', 'evidence', 'themes', 'frame'] as const).map(item => (
            <Button
              key={item}
              type="button"
              variant={view === item ? 'default' : 'outline'}
              className="h-8 rounded-full capitalize"
              onClick={() => setView(item)}
            >
              {item === 'frame' ? 'Code frame' : item}
            </Button>
          ))}
          <Button
            type="button"
            variant="outline"
            className="h-8 rounded-full"
            onClick={() => setWeightOpen(true)}
          >
            Weighting
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-8 rounded-full"
            onClick={() => setAnovaOpen(true)}
          >
            ANOVA
          </Button>
        </div>
        {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
        {view === 'sheet' ? (
          <Sheet
            columns={columns}
            rows={rows}
            matched={Number(preview?.n_rows_matched ?? preview?.n_rows ?? rows.length)}
            offset={offset}
            pageSize={SHEET_PAGE}
            filterColumn={filterColumn}
            filterValue={filterValue}
            showLabels={showLabels}
            onFilterColumn={setFilterColumn}
            onFilterValue={setFilterValue}
            onShowLabels={setShowLabels}
            onSelectColumn={setSelectedColumn}
            onOffset={value => setSheetPage({ key: sheetKey, offset: value })}
          />
        ) : null}
        {view === 'evidence' ? (
          <Evidence datasetId={datasetId} cell={cell} onQuotes={setQuotes} quotes={quotes} />
        ) : null}
        {view === 'themes' ? (
          <Themes
            datasetId={datasetId}
            columns={columns}
            onSelectCell={selected => {
              onSelectCell(selected);
              setView('evidence');
            }}
          />
        ) : null}
        {view === 'frame' ? (
          <CodeFrame
            datasetId={datasetId}
            columns={columns}
            datasets={datasets}
            onAdopted={onAdopted}
          />
        ) : null}
      </div>
      <aside className="rounded-xl border border-border p-4 text-sm">
        <h2 className="mb-2 font-medium">Variable</h2>
        <p className="text-muted-foreground">{selectedColumn || 'Select a column'}</p>
        <FrequencyList frequencies={frequencies} />
        <h2 className="mb-2 mt-4 font-medium">Data quality</h2>
        <QualityList report={quality} />
      </aside>
      {weightOpen ? (
        <WeightingModal
          datasetId={datasetId}
          datasets={datasets}
          columns={columns}
          onClose={() => setWeightOpen(false)}
          onAdopted={onAdopted}
        />
      ) : null}
      {anovaOpen ? (
        <AnovaModal
          datasetId={datasetId}
          factors={factorColumns}
          dependents={dependentColumns}
          onClose={() => setAnovaOpen(false)}
        />
      ) : null}
    </div>
  );
}

function Sheet(props: {
  columns: string[];
  rows: unknown[][];
  matched: number;
  offset: number;
  pageSize: number;
  filterColumn: string;
  filterValue: string;
  showLabels: boolean;
  onFilterColumn: (value: string) => void;
  onFilterValue: (value: string) => void;
  onShowLabels: (value: boolean) => void;
  onSelectColumn: (value: string) => void;
  onOffset: (value: number) => void;
}) {
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end gap-2 text-sm">
        <label>
          Filter
          <select
            className="mt-1 block rounded-md border border-border bg-background px-2 py-1"
            value={props.filterColumn}
            onChange={event => props.onFilterColumn(event.target.value)}
          >
            <option value="">Column</option>
            {props.columns.map(column => (
              <option key={column} value={column}>
                {column}
              </option>
            ))}
          </select>
        </label>
        <input
          className="rounded-md border border-border bg-background px-2 py-1"
          placeholder="Value"
          value={props.filterValue}
          onChange={event => props.onFilterValue(event.target.value)}
        />
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={props.showLabels}
            onChange={event => props.onShowLabels(event.target.checked)}
          />
          Labels
        </label>
        <span className="text-muted-foreground">
          {props.rows.length ? props.offset + 1 : 0}–{props.offset + props.rows.length} of{' '}
          {props.matched}
        </span>
        <Button
          type="button"
          variant="outline"
          className="h-8"
          disabled={props.offset === 0}
          onClick={() => props.onOffset(Math.max(0, props.offset - props.pageSize))}
        >
          Previous
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-8"
          disabled={props.offset + props.rows.length >= props.matched}
          onClick={() => props.onOffset(props.offset + props.pageSize)}
        >
          Next
        </Button>
      </div>
      <div className="overflow-auto rounded-xl border border-border">
        <table className="min-w-full text-left text-xs">
          <thead>
            <tr>
              {props.columns.map(column => (
                <th key={column} className="border-b border-border px-2 py-2 font-medium">
                  <button type="button" onClick={() => props.onSelectColumn(column)}>
                    {column}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {props.rows.map((row, index) => (
              <tr key={index}>
                {props.columns.map((column, cell) => (
                  <td key={column} className="border-b border-border px-2 py-1.5">
                    {formatCell(row[cell])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatCell(value: unknown) {
  if (value == null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function FrequencyList({ frequencies }: { frequencies: Record<string, unknown> | null }) {
  const rows =
    (frequencies?.frequencies as { value: string; percentage: number; count: number }[]) || [];
  if (!frequencies) return <p className="mt-2 text-muted-foreground">No distribution yet.</p>;
  return (
    <ul className="mt-2 space-y-1">
      <li className="text-muted-foreground">
        {frequencies.weight_column ? `Weighted % · ${String(frequencies.weight_column)}` : '%'}
      </li>
      {rows.map(row => (
        <li key={row.value} className="flex justify-between gap-2">
          <span>{row.value}</span>
          <span>{(row.percentage * 100).toFixed(1)}%</span>
        </li>
      ))}
    </ul>
  );
}

function QualityList({ report }: { report: Record<string, unknown> | null }) {
  const findings = Array.isArray(report?.findings) ? (report?.findings as unknown[]) : [];
  if (!report) return <p className="text-muted-foreground">No scan yet.</p>;
  return (
    <ul className="space-y-1 text-muted-foreground">
      {findings.slice(0, 6).map((finding, index) => (
        <li key={index}>{typeof finding === 'string' ? finding : JSON.stringify(finding)}</li>
      ))}
      {!findings.length ? <li>No findings on this file.</li> : null}
    </ul>
  );
}

function Evidence({
  datasetId,
  cell,
  quotes,
  onQuotes,
}: {
  datasetId: string;
  cell: SelectedCell | null;
  quotes: Record<string, unknown> | null;
  onQuotes: (value: Record<string, unknown>) => void;
}) {
  const [error, setError] = useState('');
  useEffect(() => {
    if (!datasetId || !cell?.bitset || !cell.textColumn) return;
    setError('');
    api(`/datasets/${datasetId}/quotes`, {
      method: 'POST',
      body: JSON.stringify({
        text_column: cell.textColumn,
        row_uid_bitset: cell.bitset,
        page: 1,
        page_size: 20,
      }),
    })
      .then(onQuotes)
      .catch(err => setError(err.message));
  }, [datasetId, cell, onQuotes]);
  if (!cell) {
    return (
      <p className="text-sm text-muted-foreground">
        Select a cell in Themes or Tables to open its verbatims.
      </p>
    );
  }
  return (
    <div className="space-y-3 text-sm">
      <p className="font-medium">{cell.claim}</p>
      <p className="text-muted-foreground">
        Base {cell.base || '—'} · Weight {cell.weight || 'none'} · {cell.textColumn}
      </p>
      {!cell.textColumn ? (
        <p className="text-destructive">This cell has no source text column on its codeframe.</p>
      ) : null}
      {error ? <p className="text-destructive">{error}</p> : null}
      <QuoteList quotes={quotes} />
    </div>
  );
}

function QuoteList({ quotes }: { quotes: Record<string, unknown> | null }) {
  const items = (quotes?.quotes as { respondent_id: string; text: string }[]) || [];
  if (!quotes) return null;
  return (
    <div>
      <p className="text-muted-foreground">{String(quotes.total || 0)} respondents</p>
      <ul className="mt-2 space-y-2">
        {items.map(item => (
          <li key={item.respondent_id} className="rounded-lg border border-border p-2">
            <span className="text-muted-foreground">{item.respondent_id}</span>
            <p>{item.text}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function selectionFromCell(
  book: Record<string, unknown>,
  row: BannerRow,
  cell: BannerCell | undefined
): SelectedCell | null {
  const bitset = cell?.provenance?.row_uid_bitset;
  if (!cell || !bitset) return null;
  const weight = book.resolved_weight || (book.weight as { column?: string } | undefined)?.column;
  const percent = cell.percent != null ? `${cell.percent.toFixed(1)}%` : '';
  const count = cell.unweighted_n != null ? `${cell.unweighted_n} respondents` : '';
  return {
    bitset,
    textColumn: row.source_text_column || row.column || '',
    claim: [row.label, percent, count].filter(Boolean).join(' · '),
    base: cell.column_unweighted_n != null ? String(cell.column_unweighted_n) : '',
    weight: weight ? String(weight) : '',
  };
}

function BannerGrid({
  book,
  onSelectCell,
}: {
  book: Record<string, unknown>;
  onSelectCell: (cell: SelectedCell) => void;
}) {
  const stored = (book.banner_columns as BannerColumn[]) || [];
  const columns = stored.length
    ? stored
    : Array.from(
        new Map(
          ((book.rows as BannerRow[]) || [])
            .flatMap(row => row.cells || [])
            .map(cell => [cell.banner_id, { id: cell.banner_id, label: cell.banner_id }])
        ).values()
      );
  const letters = (book.letters as SigLetter[]) || [];
  const rows = ((book.rows as BannerRow[]) || []).filter(row => row.kind !== 'net');
  const notCoded = ((book.stubs as { not_coded?: { unweighted_n?: number } }[]) || [])[0]
    ?.not_coded;
  if (!columns.length) return null;
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr>
              <th className="border-b border-border px-2 py-1" />
              {columns.map(column => (
                <th key={column.id} className="border-b border-border px-2 py-1 font-medium">
                  {bannerHeading(column)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th className="px-2 py-1 font-normal text-muted-foreground">Base</th>
              {columns.map(column => {
                const sample = rows
                  .flatMap(row => row.cells || [])
                  .find(cell => cell.banner_id === column.id);
                return (
                  <td key={column.id} className="px-2 py-1 text-muted-foreground">
                    {sample?.column_unweighted_n ?? '—'}
                  </td>
                );
              })}
            </tr>
            {rows.map(row => (
              <tr key={row.id}>
                <th className="px-2 py-1 font-normal">{row.label}</th>
                {columns.map(column => {
                  const cell = (row.cells || []).find(item => item.banner_id === column.id);
                  const letter = lettersFor(letters, row.id, column.id);
                  return (
                    <td key={column.id} className="px-2 py-1">
                      <button
                        type="button"
                        className="text-left"
                        onClick={() => {
                          const selected = selectionFromCell(book, row, cell);
                          if (selected) onSelectCell(selected);
                        }}
                      >
                        {cell?.percent != null ? `${cell.percent.toFixed(1)}%` : '—'}
                        {letter ? ` ${letter}` : ''}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {notCoded?.unweighted_n != null ? (
        <p className="text-muted-foreground">Not coded: {notCoded.unweighted_n}</p>
      ) : null}
    </div>
  );
}

function Themes({
  datasetId,
  columns,
  onSelectCell,
}: {
  datasetId: string;
  columns: string[];
  onSelectCell: (cell: SelectedCell) => void;
}) {
  const [stub, setStub] = useState('');
  const [banner, setBanner] = useState('');
  const [book, setBook] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap gap-2">
        <select
          className="rounded-md border border-border bg-background px-2 py-1"
          value={stub}
          onChange={event => setStub(event.target.value)}
        >
          <option value="">Theme column</option>
          {visibleColumns(columns).map(column => (
            <option key={column}>{column}</option>
          ))}
        </select>
        <select
          className="rounded-md border border-border bg-background px-2 py-1"
          value={banner}
          onChange={event => setBanner(event.target.value)}
        >
          <option value="">Banner</option>
          {visibleColumns(columns).map(column => (
            <option key={column}>{column}</option>
          ))}
        </select>
        <Button
          type="button"
          onClick={() => {
            setError('');
            api(`/datasets/${datasetId}/tables`, {
              method: 'POST',
              body: JSON.stringify({
                stubs: [codedStub(stub)],
                banner: banner ? [{ column: banner }] : [],
                statistics: ['column_proportion'],
                significance_display: 'column_letters',
                save: false,
              }),
            })
              .then(setBook)
              .catch(err => setError(err.message));
          }}
        >
          Run themes
        </Button>
      </div>
      {error ? <p className="text-destructive">{error}</p> : null}
      {book ? <BannerGrid book={book} onSelectCell={onSelectCell} /> : null}
    </div>
  );
}

type FrameCode = { id: string; label: string; keywords: string[] };

function codeIdFromLabel(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return slug || 'code';
}

function CodeFrame({
  datasetId,
  columns,
  datasets,
  onAdopted,
}: {
  datasetId: string;
  columns: string[];
  datasets: StudyDataset[];
  onAdopted: (dataset: StudyDataset) => void;
}) {
  const [textColumn, setTextColumn] = useState('');
  const [codes, setCodes] = useState<FrameCode[]>([]);
  const [progress, setProgress] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const [rename, setRename] = useState({ code: '', label: '' });
  const [sourceDataset, setSourceDataset] = useState('');
  const [schemaOnly, setSchemaOnly] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [split, setSplit] = useState<{ id: string; left: string; right: string } | null>(null);

  useEffect(() => {
    api('/api/organizations')
      .then(body => {
        const active = (body.organizations || []).find(
          (org: { id?: string; privacy_mode?: string }) => org.id === body.active_organization_id
        );
        setSchemaOnly(active?.privacy_mode === 'schema_only');
      })
      .catch(() => setSchemaOnly(false));
  }, []);

  const codeColumn = String(progress?.code_column || (textColumn ? `${textColumn}_codes` : ''));
  const frameDataset = String(progress?.derived_dataset_id || datasetId);

  async function poll(jobId: string | null, useModel: boolean, frame: FrameCode[] = codes) {
    const result = await api(`/datasets/${datasetId}/open-end/apply`, {
      method: 'POST',
      body: JSON.stringify({
        text_column: textColumn,
        codes: frame,
        use_model: schemaOnly ? false : useModel,
        job_id: jobId,
      }),
    });
    setProgress(result);
    if (result.done && result.derived_dataset_id) {
      onAdopted({
        id: String(result.derived_dataset_id),
        original_filename: String(
          result.original_filename ||
            (result.derived_dataset as { original_filename?: string } | undefined)
              ?.original_filename ||
            datasets.find(dataset => dataset.id === datasetId)?.original_filename ||
            textColumn
        ),
        lineage_label: 'coded comments',
        n_rows: Number(result.n_rows || 0) || undefined,
      });
    }
    if (!result.done && result.job_id) {
      await poll(String(result.job_id), useModel, frame);
    }
  }

  async function proposeCodes() {
    const result = await api(`/datasets/${datasetId}/open-end/propose`, {
      method: 'POST',
      body: JSON.stringify({ text_column: textColumn, use_model: false }),
    });
    const next = (result.codes || []) as FrameCode[];
    setCodes(next);
    return next;
  }

  async function editFrame(body: Record<string, unknown>) {
    await api(`/datasets/${frameDataset}/open-end/frame`, {
      method: 'POST',
      body: JSON.stringify({ code_column: codeColumn, ...body }),
    });
  }

  return (
    <div className="space-y-3 text-sm">
      <select
        aria-label="Open-end column"
        className="rounded-md border border-border bg-background px-2 py-1"
        value={textColumn}
        onChange={event => setTextColumn(event.target.value)}
      >
        <option value="">Open-end column</option>
        {visibleColumns(columns).map(column => (
          <option key={column}>{column}</option>
        ))}
      </select>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setError('');
            proposeCodes().catch(err => setError(err.message));
          }}
        >
          Propose
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!textColumn}
          onClick={() => {
            setError('');
            const ready = codes.length ? Promise.resolve(codes) : proposeCodes();
            ready
              .then(next => {
                if (!next.length) {
                  setError('No themes were proposed for that column.');
                  return;
                }
                return poll(null, false, next);
              })
              .catch(err => setError(err.message));
          }}
        >
          Code with keywords
        </Button>
        {schemaOnly ? null : (
          <Button
            type="button"
            disabled={!textColumn}
            onClick={() => {
              setError('');
              const ready = codes.length ? Promise.resolve(codes) : proposeCodes();
              ready
                .then(next => {
                  if (!next.length) {
                    setError('Propose a frame before coding with Haiku.');
                    return;
                  }
                  return poll(null, true, next);
                })
                .catch(err => setError(err.message));
            }}
          >
            Code with Haiku
          </Button>
        )}
      </div>
      {schemaOnly ? (
        <p className="text-muted-foreground">Schema-only studies code with keywords.</p>
      ) : (
        <p className="text-muted-foreground">
          Haiku codes the themes in the frame. An empty frame is proposed first.
        </p>
      )}
      {error ? <p className="text-destructive">{error}</p> : null}
      <ul className="space-y-1">
        {codes.map(code => (
          <li key={code.id} className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selected.includes(code.id)}
                onChange={event => {
                  setSelected(current =>
                    event.target.checked
                      ? [...current, code.id]
                      : current.filter(id => id !== code.id)
                  );
                }}
              />
              {code.label} <span className="text-muted-foreground">{code.id}</span>
            </label>
            <Button
              type="button"
              variant="outline"
              className="h-7"
              onClick={() => setSplit({ id: code.id, left: '', right: '' })}
            >
              Split
            </Button>
          </li>
        ))}
      </ul>
      {selected.length > 1 ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            const [into, ...rest] = selected;
            setError('');
            rest
              .reduce(
                (chain, codeId) =>
                  chain.then(() => editFrame({ action: 'merge', code_id: codeId, into })),
                Promise.resolve()
              )
              .then(() => {
                setCodes(current =>
                  current.filter(code => code.id === into || !rest.includes(code.id))
                );
                setSelected([into]);
              })
              .catch(err => setError(err.message));
          }}
        >
          Merge
        </Button>
      ) : null}
      {split ? (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={event => {
            event.preventDefault();
            const left = codeIdFromLabel(split.left);
            const right = codeIdFromLabel(split.right);
            setError('');
            editFrame({
              action: 'split',
              code_id: split.id,
              parts: [
                { id: left, label: split.left, keywords: [split.left.toLowerCase()] },
                { id: right, label: split.right, keywords: [split.right.toLowerCase()] },
              ],
            })
              .then(() => {
                setCodes(current =>
                  current.flatMap(code =>
                    code.id === split.id
                      ? [
                          { id: left, label: split.left, keywords: [split.left.toLowerCase()] },
                          { id: right, label: split.right, keywords: [split.right.toLowerCase()] },
                        ]
                      : [code]
                  )
                );
                setSplit(null);
              })
              .catch(err => setError(err.message));
          }}
        >
          <input
            className="rounded-md border border-border px-2 py-1"
            placeholder="First theme"
            value={split.left}
            onChange={event => setSplit({ ...split, left: event.target.value })}
          />
          <input
            className="rounded-md border border-border px-2 py-1"
            placeholder="Second theme"
            value={split.right}
            onChange={event => setSplit({ ...split, right: event.target.value })}
          />
          <Button type="submit" variant="outline">
            Split {split.id}
          </Button>
        </form>
      ) : null}
      {progress ? (
        <p>
          {progress.error
            ? String(progress.error)
            : progress.done
              ? `Coded ${String(progress.processed)} of ${String(progress.total)} comments.${
                  Number(progress.review_count || 0)
                    ? ` ${String(progress.review_count)} need a look.`
                    : ''
                }`
              : `Coding comments: ${String(progress.processed)} of ${String(progress.total)}.`}
        </p>
      ) : null}
      {selected.length === 1 ? (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={event => {
            event.preventDefault();
            const codeId = selected[0];
            setError('');
            editFrame({ action: 'rename', code_id: codeId, label: rename.label })
              .then(() => {
                setCodes(current =>
                  current.map(code =>
                    code.id === codeId ? { ...code, label: rename.label } : code
                  )
                );
              })
              .catch(err => setError(err.message));
          }}
        >
          <input
            className="rounded-md border border-border px-2 py-1"
            aria-label="New theme label"
            placeholder="New label"
            value={rename.label}
            onChange={event => setRename({ ...rename, label: event.target.value })}
          />
          <Button type="submit" variant="outline">
            Rename
          </Button>
        </form>
      ) : null}
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={event => {
          event.preventDefault();
          if (!sourceDataset) return;
          setError('');
          api(`/datasets/${datasetId}/open-end/reapply`, {
            method: 'POST',
            body: JSON.stringify({
              text_column: textColumn,
              source_dataset_id: sourceDataset,
              code_column: `${textColumn}_codes`,
              use_model: false,
            }),
          })
            .then(result => {
              setProgress(result);
              if (result.derived_dataset_id) {
                onAdopted({
                  id: String(result.derived_dataset_id),
                  original_filename: String(
                    result.original_filename ||
                      (result.derived_dataset as { original_filename?: string } | undefined)
                        ?.original_filename ||
                      datasets.find(dataset => dataset.id === datasetId)?.original_filename ||
                      textColumn
                  ),
                  lineage_label: 'coded comments',
                });
              }
            })
            .catch(err => setError(err.message));
        }}
      >
        <label className="text-sm">
          Reapply onto
          <select
            aria-label="Reapply dataset"
            className="mt-1 block rounded-md border border-border bg-background px-2 py-1"
            value={sourceDataset}
            onChange={event => setSourceDataset(event.target.value)}
          >
            <option value="">Dataset in this study</option>
            {datasets
              .filter(dataset => dataset.id !== datasetId)
              .map(dataset => (
                <option key={dataset.id} value={dataset.id}>
                  {datasetSwitcherLabel(dataset)}
                </option>
              ))}
          </select>
        </label>
        <Button type="submit" variant="outline" disabled={!sourceDataset || !textColumn}>
          Reapply
        </Button>
      </form>
    </div>
  );
}

type WeightTarget = { column: string; code: string; percent: string };

function WeightingModal({
  datasetId,
  datasets,
  columns,
  onClose,
  onAdopted,
}: {
  datasetId: string;
  datasets: StudyDataset[];
  columns: string[];
  onClose: () => void;
  onAdopted: (dataset: StudyDataset) => void;
}) {
  const [targets, setTargets] = useState<WeightTarget[]>([
    { column: columns[0] || '', code: '', percent: '50' },
  ]);
  const [sourceDataset, setSourceDataset] = useState(
    datasets.find(dataset => dataset.id !== datasetId)?.id || ''
  );
  const [codeOptions, setCodeOptions] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const needed = [...new Set(targets.map(row => row.column).filter(Boolean))];
    for (const column of needed) {
      if (codeOptions[column]) continue;
      api(`/datasets/${datasetId}/explore/column_frequencies`, {
        method: 'POST',
        body: JSON.stringify({ column }),
      })
        .then(body => {
          const values = ((body.frequencies || []) as { value: string }[]).map(row =>
            String(row.value)
          );
          setCodeOptions(current => ({ ...current, [column]: values }));
        })
        .catch(() => setCodeOptions(current => ({ ...current, [column]: [] })));
    }
  }, [datasetId, targets, codeOptions]);

  function updateTarget(index: number, patch: Partial<WeightTarget>) {
    setTargets(current => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  return (
    <dialog
      open
      className="fixed inset-0 z-20 m-auto h-fit w-[520px] rounded-xl border border-border bg-background p-5"
    >
      <h2 className="text-lg font-medium">Weighting</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Rake each code to a target share. Load those shares from another dataset in this study.
      </p>
      <ul className="mt-3 space-y-2">
        {targets.map((row, index) => (
          <li key={index} className="grid grid-cols-[1fr_1fr_5rem_auto] gap-2">
            <select
              aria-label={`Target column ${index + 1}`}
              className="rounded-md border border-border bg-background px-2 py-1 text-sm"
              value={row.column}
              onChange={event => updateTarget(index, { column: event.target.value })}
            >
              {columns.map(item => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <select
              aria-label={`Target code ${index + 1}`}
              className="rounded-md border border-border bg-background px-2 py-1 text-sm"
              value={row.code}
              onChange={event => updateTarget(index, { code: event.target.value })}
            >
              <option value="">Code</option>
              {(codeOptions[row.column] || []).map(code => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
            <input
              aria-label={`Target percent ${index + 1}`}
              className="rounded-md border border-border px-2 py-1 text-sm"
              value={row.percent}
              onChange={event => updateTarget(index, { percent: event.target.value })}
            />
            <Button
              type="button"
              variant="outline"
              className="h-8"
              onClick={() => setTargets(current => current.filter((_, i) => i !== index))}
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>
      <Button
        type="button"
        variant="outline"
        className="mt-2 h-8"
        onClick={() =>
          setTargets(current => [...current, { column: columns[0] || '', code: '', percent: '' }])
        }
      >
        Add target
      </Button>
      <label className="mt-3 block text-sm">
        Load from
        <select
          className="mt-1 block w-full rounded-md border border-border bg-background px-2 py-1"
          value={sourceDataset}
          onChange={event => setSourceDataset(event.target.value)}
        >
          <option value="">Dataset in this study</option>
          {datasets
            .filter(dataset => dataset.id !== datasetId)
            .map(dataset => (
              <option key={dataset.id} value={dataset.id}>
                {dataset.original_filename || dataset.id}
              </option>
            ))}
        </select>
      </label>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      {result ? (
        <p className="mt-2 text-sm">
          Efficiency{' '}
          {efficiencyPercent(
            (result.diagnostics as { weighting_efficiency?: number })?.weighting_efficiency
          )}{' '}
          · ESS {String((result.diagnostics as { kish_ess?: number })?.kish_ess ?? '')}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (!sourceDataset) return;
            const columnsToLoad = [...new Set(targets.map(row => row.column).filter(Boolean))];
            setError('');
            Promise.all(
              columnsToLoad.map(column =>
                api(`/datasets/${sourceDataset}/explore/column_frequencies`, {
                  method: 'POST',
                  body: JSON.stringify({ column }),
                }).then(body => ({ column, body }))
              )
            )
              .then(loaded => {
                const next: WeightTarget[] = [];
                for (const item of loaded) {
                  const frequencies = (item.body.frequencies || []) as {
                    value: string;
                    percentage: number;
                  }[];
                  for (const frequency of frequencies) {
                    next.push({
                      column: item.column,
                      code: String(frequency.value),
                      percent: String(Math.round(frequency.percentage * 1000) / 10),
                    });
                  }
                }
                if (next.length) setTargets(next);
              })
              .catch(err => setError(err.message));
          }}
        >
          Load targets
        </Button>
        <Button
          type="button"
          onClick={() => {
            const categorical: Record<string, Record<string, number>> = {};
            for (const row of targets) {
              if (!row.column || !row.code) continue;
              categorical[row.column] = categorical[row.column] || {};
              categorical[row.column][row.code] = Number(row.percent) / 100;
            }
            setError('');
            api(`/datasets/${datasetId}/weights/rake`, {
              method: 'POST',
              body: JSON.stringify({ categorical_targets: categorical }),
            })
              .then(payload => {
                setResult(payload);
                const nextId = String(payload.derived_dataset_id || payload.dataset_id || '');
                if (nextId && nextId !== datasetId) {
                  const names = Object.keys(categorical).join(', ');
                  onAdopted({
                    id: nextId,
                    original_filename: String(payload.original_filename || 'weighted'),
                    lineage_label: names ? `weighted to ${names}` : 'weighted',
                    n_rows: Number(payload.n_rows || 0) || undefined,
                  });
                }
              })
              .catch(err => setError(err.message));
          }}
        >
          Rake
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
    </dialog>
  );
}

function AnovaModal({
  datasetId,
  factors,
  dependents,
  onClose,
}: {
  datasetId: string;
  factors: string[];
  dependents: string[];
  onClose: () => void;
}) {
  const [group, setGroup] = useState(factors[0] || '');
  const [value, setValue] = useState(dependents[0] || '');
  const [postHoc, setPostHoc] = useState('tukey');
  const [welch, setWelch] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  return (
    <dialog
      open
      className="fixed inset-0 z-20 m-auto h-fit w-[420px] rounded-xl border border-border bg-background p-5"
    >
      <h2 className="text-lg font-medium">ANOVA</h2>
      <label className="mt-3 block text-sm">
        Factor
        <select
          className="mt-1 block w-full rounded-md border border-border bg-background px-2 py-1"
          value={group}
          onChange={event => setGroup(event.target.value)}
        >
          {factors.map(item => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </label>
      <label className="mt-3 block text-sm">
        Dependent
        <select
          className="mt-1 block w-full rounded-md border border-border bg-background px-2 py-1"
          value={value}
          onChange={event => setValue(event.target.value)}
        >
          {dependents.map(item => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </label>
      <label className="mt-3 block text-sm">
        Post hoc
        <select
          className="mt-1 block w-full rounded-md border border-border bg-background px-2 py-1"
          value={postHoc}
          onChange={event => setPostHoc(event.target.value)}
        >
          <option value="tukey">Tukey</option>
          <option value="games_howell">Games-Howell</option>
          <option value="bonferroni">Bonferroni</option>
        </select>
      </label>
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={welch} onChange={event => setWelch(event.target.checked)} />
        Welch
      </label>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      {result ? <p className="mt-2 text-sm">{result}</p> : null}
      <div className="mt-4 flex gap-2">
        <Button
          type="button"
          onClick={() => {
            setError('');
            api(`/datasets/${datasetId}/analyze/anova_oneway`, {
              method: 'POST',
              body: JSON.stringify({
                group_column: group,
                value_column: value,
                post_hoc: welch ? 'games_howell' : postHoc,
                use_welch: welch,
                effect_size: 'eta_squared',
                output_chart: 'means_plot',
              }),
            })
              .then(payload => setResult(String(payload.summary || payload.title || 'Saved.')))
              .catch(err => setError(err.message));
          }}
        >
          Run
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
    </dialog>
  );
}

function TablesPanel({
  datasetId,
  projectId,
  onSelectCell,
}: {
  datasetId: string;
  projectId: string;
  onSelectCell: (cell: SelectedCell) => void;
}) {
  const [specs, setSpecs] = useState<
    { spec_id?: string; id?: string; name?: string; label?: string }[]
  >([]);
  const [books, setBooks] = useState<{ book_id?: string; id?: string; name?: string }[]>([]);
  const [openSpec, setOpenSpec] = useState<Record<string, unknown> | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [stub, setStub] = useState('');
  const [banner, setBanner] = useState('');
  const [weight, setWeight] = useState('');
  const [statistic, setStatistic] = useState('column_proportion');
  const [letters, setLetters] = useState(true);
  const [threads, setThreads] = useState<
    Record<string, { role: 'user' | 'assistant'; text: string }[]>
  >({});
  const [message, setMessage] = useState('');
  const [warming, setWarming] = useState(false);
  const [error, setError] = useState('');
  const threadKey = String((openSpec?.spec as { id?: string } | undefined)?.id || 'draft');
  const thread = threads[threadKey] || [];

  useEffect(() => {
    if (!datasetId) return;
    api(`/datasets/${datasetId}/tables`)
      .then(body => setSpecs(body.specs || []))
      .catch(err => setError(err.message));
    api(`/datasets/${datasetId}/banner-books`)
      .then(body => setBooks(body.books || body.banner_books || []))
      .catch(() => setBooks([]));
    api(`/datasets/${datasetId}/preview?limit=1`)
      .then(body => setColumns(visibleColumns((body.variable_names as string[]) || [])))
      .catch(() => setColumns([]));
  }, [datasetId]);

  function tableBody(save: boolean) {
    return {
      stubs: [codedStub(stub)],
      banner: banner ? [{ column: banner }] : [],
      statistics: [statistic],
      significance_display: letters ? 'column_letters' : 'none',
      weight: weight || 'none',
      save,
    };
  }

  async function askAboutTable() {
    setError('');
    setWarming(false);
    const run = () =>
      streamAgentLoop({
        message,
        mode: 'ask',
        agentVersion: 'v2',
        datasetId,
        projectId,
        openTableSpec: openSpec,
      });
    try {
      let result;
      try {
        result = await run();
      } catch (err) {
        if (!(err instanceof ApiRequestError) || err.status !== 503) throw err;
        setWarming(true);
        await new Promise(resolve => setTimeout(resolve, 1500));
        result = await run();
      }
      const answer = result.answer_markdown || '';
      setThreads(current => ({
        ...current,
        [threadKey]: [
          ...(current[threadKey] || []),
          { role: 'user', text: message },
          { role: 'assistant', text: answer },
        ],
      }));
      setMessage('');
    } catch (err) {
      setError(
        err instanceof ApiRequestError && err.status === 503
          ? 'The assistant is still warming up. Wait a moment and ask again.'
          : formatApiErrorMessage(err)
      );
    } finally {
      setWarming(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div>
        {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
        <form
          className="mb-4 flex flex-wrap items-end gap-2 text-sm"
          onSubmit={event => {
            event.preventDefault();
            if (!stub) return;
            setError('');
            api(`/datasets/${datasetId}/tables`, {
              method: 'POST',
              body: JSON.stringify(tableBody(true)),
            })
              .then(body => {
                setOpenSpec(body);
                const spec = body.spec as { id?: string; label?: string } | undefined;
                const id = String(spec?.id || '');
                if (id) {
                  setSpecs(current =>
                    current.some(item => (item.spec_id || item.id) === id)
                      ? current
                      : [{ spec_id: id, label: spec?.label || stub }, ...current]
                  );
                }
              })
              .catch(err => setError(err.message));
          }}
        >
          <label>
            Stub
            <select
              aria-label="Table stub"
              className="mt-1 block rounded-md border border-border bg-background px-2 py-1"
              value={stub}
              onChange={event => setStub(event.target.value)}
            >
              <option value="">Column</option>
              {columns.map(column => (
                <option key={column}>{column}</option>
              ))}
            </select>
          </label>
          <label>
            Banner
            <select
              aria-label="Table banner"
              className="mt-1 block rounded-md border border-border bg-background px-2 py-1"
              value={banner}
              onChange={event => setBanner(event.target.value)}
            >
              <option value="">None</option>
              {columns.map(column => (
                <option key={column}>{column}</option>
              ))}
            </select>
          </label>
          <label>
            Weight
            <select
              aria-label="Table weight"
              className="mt-1 block rounded-md border border-border bg-background px-2 py-1"
              value={weight}
              onChange={event => setWeight(event.target.value)}
            >
              <option value="">Unweighted</option>
              {columns.map(column => (
                <option key={column}>{column}</option>
              ))}
            </select>
          </label>
          <label>
            Statistic
            <select
              aria-label="Table statistic"
              className="mt-1 block rounded-md border border-border bg-background px-2 py-1"
              value={statistic}
              onChange={event => setStatistic(event.target.value)}
            >
              <option value="column_proportion">Column %</option>
              <option value="row_proportion">Row %</option>
              <option value="unweighted_n">Count</option>
            </select>
          </label>
          <label className="flex items-center gap-2 pb-1">
            <input
              type="checkbox"
              checked={letters}
              onChange={event => setLetters(event.target.checked)}
            />
            Sig letters
          </label>
          <Button type="submit" disabled={!stub}>
            Save table
          </Button>
        </form>
        <h2 className="mb-2 text-sm font-medium">Saved tables</h2>
        <ul className="space-y-1 text-sm">
          {specs.map(spec => {
            const id = spec.spec_id || spec.id || '';
            return (
              <li key={id}>
                <button
                  type="button"
                  className="underline"
                  onClick={() => {
                    api(`/datasets/${datasetId}/tables/${id}`).then(setOpenSpec);
                  }}
                >
                  {spec.label || spec.name || id}
                </button>
              </li>
            );
          })}
          {!specs.length ? (
            <li className="text-muted-foreground">No saved tables on this dataset.</li>
          ) : null}
        </ul>
        <h2 className="mb-2 mt-4 text-sm font-medium">Banner books</h2>
        <ul className="space-y-1 text-sm">
          {books.map(book => {
            const id = book.book_id || book.id || '';
            return (
              <li key={id}>
                <button
                  type="button"
                  className="underline"
                  onClick={() => {
                    downloadFile(
                      `/datasets/${datasetId}/banner-books/${id}/export.xlsx`,
                      `${book.name || 'banner-book'}.xlsx`,
                      'POST'
                    ).catch(err => setError(err.message));
                  }}
                >
                  {book.name || id || 'Banner book'} .xlsx
                </button>
              </li>
            );
          })}
          {!books.length ? <li className="text-muted-foreground">No banner books.</li> : null}
        </ul>
        {openSpec ? (
          <div className="mt-4 text-sm text-muted-foreground">
            <p>
              Open spec {String((openSpec.spec as { id?: string })?.id || '')} · base{' '}
              {String((openSpec.weight as { weighted_n?: number })?.weighted_n ?? '')}
            </p>
            <div className="mt-2 text-foreground">
              <BannerGrid book={openSpec} onSelectCell={onSelectCell} />
            </div>
            <div className="mt-2 flex gap-2">
              {(['xlsx', 'pptx', 'docx'] as const).map(kind => (
                <Button
                  key={kind}
                  type="button"
                  variant="outline"
                  className="h-8"
                  onClick={() => {
                    const specId = String((openSpec.spec as { id?: string })?.id || '');
                    downloadFile(
                      `/datasets/${datasetId}/tables/${specId}/export.${kind}`,
                      `table.${kind}`
                    ).catch(err => setError(err.message));
                  }}
                >
                  {kind}
                </Button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <aside className="rounded-xl border border-border p-4">
        <h2 className="text-sm font-medium">Ask about this table</h2>
        <textarea
          className="mt-2 w-full rounded-md border border-border bg-background p-2 text-sm"
          rows={4}
          value={message}
          onChange={event => setMessage(event.target.value)}
        />
        <Button type="button" className="mt-2" onClick={() => void askAboutTable()}>
          Ask
        </Button>
        {warming ? <p className="mt-3 text-sm text-muted-foreground">Warming up…</p> : null}
        <div className="mt-3 space-y-3 text-sm">
          {thread.map((entry, index) =>
            entry.role === 'user' ? (
              <p key={index}>{entry.text}</p>
            ) : (
              <div key={index}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{entry.text}</ReactMarkdown>
                {(looksLikeCrosstab(entry.text) || isCrosstabBook(openSpec)) && openSpec ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-2 h-8"
                    onClick={() => {
                      const spec = openSpec.spec as Record<string, unknown> | undefined;
                      api(`/datasets/${datasetId}/tables`, {
                        method: 'POST',
                        body: JSON.stringify({
                          stubs: spec?.stubs || tableBody(true).stubs,
                          banner: spec?.banner || [],
                          statistics: spec?.statistics || ['column_proportion'],
                          significance_display: spec?.significance_display || 'column_letters',
                          weight: spec?.weight || 'none',
                          save: true,
                        }),
                      })
                        .then(body => setOpenSpec(body))
                        .catch(err => setError(err.message));
                    }}
                  >
                    Save as table
                  </Button>
                ) : null}
              </div>
            )
          )}
        </div>
      </aside>
    </div>
  );
}
