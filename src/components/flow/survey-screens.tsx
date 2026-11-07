'use client';

import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger, Skeleton } from '@/components/ui/rest';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ChoiceSelect } from '@/components/ui/select';
import { Table } from '@/components/ui/table';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { flowFetch, flowJson } from '@/lib/flow-api';
import { titledWithQuestions } from '@/lib/flow-report';
import { loadOutputPreferences, saveOutputPreferences } from '@/lib/output-preferences';
import { visibleAgentStep } from '@/lib/agent-step-copy';
import { FlowComposer } from '@/components/flow/chat-composer';
import { formatStat } from '@/lib/number-format';
import { loadProjectTables, numberTables } from '@/components/flow/project-tables';
import { isNonAnswerTheme } from '@/components/flow/coding-review-data';
import {
  isIdColumn,
  isInternalColumn,
  openEndColumns,
  pickerColumns,
  themeColumns,
  type FlowColumn,
} from '@/lib/flow-columns';
import { TableChart } from '@/components/flow/table-chart-panel';
import { TableBars } from '@/components/flow/table-bars';
import { rememberTablePin, savePin } from '@/components/flow/report-pins';
import { FlowMarkdown } from '@/components/flow/flow-markdown';
import { runAgentLoop } from '@/lib/run-agent-loop';
import { WeightPanel } from '@/components/flow/weight-modal';
export { WeightPanel } from '@/components/flow/weight-modal';
import {
  bannerColumns,
  bannerFootnote,
  bannerHeading,
  chartSeriesFromBook,
  codedStub,
  lettersFor,
  selectionFromCell,
  themeRead,
  type BannerCell,
  type BannerColumn,
  type BannerRow,
  type SigLetter,
  type SurveyCell,
} from '@/lib/flow-survey';
import { tableBaseCopy } from '@/components/flow/table-base';
import { codingVersionStatus, type CodingFile } from '@/components/flow/coding-versions';
import { isTableSourceChanged } from '@/components/flow/stale-table';

type DatasetRow = {
  dataset_id?: string;
  id?: string;
  original_filename?: string;
  project_id?: string;
};

export function datasetRowId(row: DatasetRow): string {
  return row.dataset_id || row.id || '';
}

let currentCell: SurveyCell | null = null;
const cellListeners = new Set<(cell: SurveyCell | null) => void>();
let evidenceIds: string[] = [];
let evidenceFocus = 0;
const evidenceListeners = new Set<() => void>();

function publishEvidence() {
  evidenceListeners.forEach(listener => listener());
}

export function setEvidenceRespondents(ids: string[]) {
  evidenceIds = ids;
  publishEvidence();
}

export function focusEvidenceRows() {
  evidenceFocus += 1;
  publishEvidence();
}

export function useEvidenceSheet(): { ids: string[]; focus: number } {
  const [sheet, setSheet] = useState({ ids: evidenceIds, focus: evidenceFocus });
  useEffect(() => {
    const listener = () => setSheet({ ids: [...evidenceIds], focus: evidenceFocus });
    evidenceListeners.add(listener);
    return () => {
      evidenceListeners.delete(listener);
    };
  }, []);
  return sheet;
}

export function setSurveyCell(cell: SurveyCell | null) {
  currentCell = cell;
  if (!cell) setEvidenceRespondents([]);
  cellListeners.forEach(listener => listener(cell));
}

export function useSurveyCell(): SurveyCell | null {
  const [cell, setCell] = useState(currentCell);
  useEffect(() => {
    const listener = (next: SurveyCell | null) => setCell(next);
    cellListeners.add(listener);
    return () => {
      cellListeners.delete(listener);
    };
  }, []);
  return cell;
}

function columnNames(columns: { name?: string }[]): string[] {
  return columns.map(column => column.name || '').filter(Boolean);
}

/** A counts table shows the weighted count when a weight is applied, rounded like the export. */
export function displayedCount(
  cell:
    | { count?: number | null; weighted_n?: number | null; unweighted_n?: number | null }
    | undefined,
  weighted: boolean
): string {
  if (!cell) return '—';
  const raw = weighted
    ? (cell.count ?? cell.weighted_n ?? cell.unweighted_n)
    : (cell.unweighted_n ?? cell.count);
  if (raw == null || Number.isNaN(Number(raw))) return '—';
  return String(Math.round(Number(raw)));
}

/** The footer says Saved only once the open table matches what was stored. */
export function tableFootStatus(hasSavedSpec: boolean, dirty: boolean): string {
  return hasSavedSpec && !dirty ? 'Saved' : '';
}

/** A preview id is not a saved table. The id has to be in the saved list. */
export function savedTableMatches(
  listed: boolean,
  savedStub: string,
  savedBanners: string[],
  stub: string,
  banners: string[]
): boolean {
  if (!listed) return false;
  return (
    savedStub === stub &&
    savedBanners.length === banners.length &&
    savedBanners.every((name, index) => name === banners[index])
  );
}

const FILE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** The name a person gave the file. A stored id is not a name. */
export function datasetFileLabel(row: {
  original_filename?: string | null;
  source_filenames?: string[] | null;
}): string {
  const names = [row.original_filename, ...(row.source_filenames || [])];
  for (const name of names) {
    const text = String(name || '').trim();
    if (!text) continue;
    const stem = text.replace(/\.[^.]+$/, '');
    if (!FILE_UUID.test(text) && !FILE_UUID.test(stem)) return text;
  }
  return 'Untitled file';
}

/** The file's active weight, including the internal copy of a raked column. */
export function defaultTableWeight(active: string, choices: string[]): string {
  if (active && active !== '_weight' && choices.includes(active)) return active;
  if (active === '_weight') return choices[0] || '';
  return '';
}

/** The cell measure stays selected when the mean row is on. Counts stay whole numbers. */

export function shownStatistics(statistic: string, meanOn: boolean): string[] {
  return meanOn ? [statistic, 'column_mean'] : [statistic];
}

export function shownDecimals(
  statistic: string,
  digits: number,
  meanOn: boolean
): Record<string, number> {
  const places = Number.isFinite(digits) ? digits : 0;
  return {
    [statistic]: statistic === 'count' ? 0 : places,
    ...(meanOn ? { column_mean: Math.max(places, 1) } : {}),
  };
}

function cellFigure(
  cell: BannerCell | undefined,
  figure: 'percent' | 'row_percent' | 'total_percent' | 'count' | 'mean',
  digits: number,
  weighted = false
): string {
  if (!cell) return '—';
  if (figure === 'count') return displayedCount(cell, weighted);
  if (figure === 'mean') {
    return cell.mean != null ? formatStat(cell.mean, 'mean', digits) : '—';
  }
  const value =
    figure === 'row_percent'
      ? cell.row_percent
      : figure === 'total_percent'
        ? cell.total_percent
        : cell.percent;
  return value != null ? `${value.toFixed(digits)}%` : '—';
}

function bannerGroups(columns: BannerColumn[]): { label: string; span: number }[] {
  const groups: { label: string; span: number }[] = [];
  for (const column of columns) {
    const label =
      column.id === 'total' ? '' : String(column.column_label || column.codes?.[0]?.column || '');
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.span += 1;
    else groups.push({ label, span: 1 });
  }
  return groups;
}

/** Themes read largest first, and answers not yet coded are a row of their own. */
export function themeRows(rows: BannerRow[], notCoded?: number | null, sort = true): BannerRow[] {
  const total = (row: BannerRow) =>
    (row.cells || []).find(cell => cell.banner_id === 'total')?.unweighted_n ?? 0;
  // "No comment", "N/A" and the like are non-answers, left out of the base, so they are not theme rows.
  const themes = rows.filter(
    row => (row.kind || 'value') !== 'value' || !isNonAnswerTheme(String(row.label || ''))
  );
  const sorted = sort ? [...themes].sort((left, right) => total(right) - total(left)) : [...themes];
  // Zero is a count too: the row stays so people can see every answer has a theme.
  if (notCoded == null) return sorted;
  const sample = rows.flatMap(row => row.cells || []).find(cell => cell.banner_id === 'total');
  const base = sample?.column_unweighted_n;
  return [
    ...sorted,
    {
      id: 'not-coded',
      label: 'Not yet coded',
      kind: 'not_coded',
      cells: [
        {
          banner_id: 'total',
          unweighted_n: notCoded,
          count: notCoded,
          percent: base ? (100 * notCoded) / base : undefined,
          column_unweighted_n: base,
        } as BannerCell,
      ],
    } as BannerRow,
  ];
}

export function BannerGrid({
  book,
  onSelectCell,
  baseAtEnd = false,
  showQuotes = false,
  showNets = false,
  figure = 'percent',
  digits = 1,
  markLowBase = false,
  muted = false,
}: {
  book: Record<string, unknown>;
  onSelectCell: (cell: SurveyCell) => void;
  baseAtEnd?: boolean;
  showQuotes?: boolean;
  showNets?: boolean;
  figure?: 'percent' | 'row_percent' | 'total_percent' | 'count' | 'mean';
  digits?: number;
  markLowBase?: boolean;
  muted?: boolean;
}) {
  const weighted = Boolean((book.weight as { weight_aware?: boolean } | undefined)?.weight_aware);
  const [picked, setPicked] = useState('');
  const columns = bannerColumns(book);
  const letters = (book.letters as SigLetter[]) || [];
  const lettersShown = String(book.significance_display || 'column_letters') !== 'none';
  const notCoded = ((book.stubs as { not_coded?: { unweighted_n?: number } }[]) || [])[0]
    ?.not_coded;
  const listed = ((book.rows as BannerRow[]) || []).filter(row => showNets || row.kind !== 'net');
  // A coded open end always ends on its "Not yet coded" row, in Themes and in Tables.
  const rows = themeRows(listed, notCoded?.unweighted_n, showQuotes);
  if (!columns.length) return <p className="flow-muted">This table has no banner columns yet.</p>;
  const base = (
    <tr>
      <th>Base</th>
      {columns.map(column => {
        const sample = rows
          .flatMap(row => row.cells || [])
          .find(cell => cell.banner_id === column.id);
        const weight = book.weight as { weight_aware?: boolean } | undefined;
        const weighted = sample?.column_weighted_n;
        const unweighted = sample?.column_unweighted_n;
        const weightedShown =
          typeof weighted === 'number' ? Math.round(weighted).toLocaleString('en-GB') : null;
        const unweightedShown =
          typeof unweighted === 'number' ? Math.round(unweighted).toLocaleString('en-GB') : null;
        const text =
          weight?.weight_aware && weightedShown
            ? `${weightedShown} (${unweightedShown ?? '—'})`
            : (unweightedShown ?? '—');
        return <td key={column.id}>{text}</td>;
      })}
    </tr>
  );
  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <Table
          className={showQuotes ? 'flow-table banner-grid theme-grid' : 'flow-table banner-grid'}
          data-muted={muted ? 'true' : 'false'}
        >
          <thead>
            {bannerGroups(columns).some(group => group.label) ? (
              <tr className="grid-groups">
                <th />
                {bannerGroups(columns).map((group, index) => (
                  <th key={`${group.label}-${index}`} colSpan={group.span}>
                    {group.label ? <span>{group.label}</span> : null}
                  </th>
                ))}
              </tr>
            ) : null}
            <tr>
              <th>
                {showQuotes
                  ? 'Theme'
                  : String(
                      ((book.stubs as { label?: string; column?: string }[]) || [])[0]?.label ||
                        ((book.stubs as { column?: string }[]) || [])[0]?.column ||
                        ''
                    )}
              </th>
              {columns.map(column => (
                <th key={column.id}>
                  {bannerHeading(column)}
                  {column.letter_slot && lettersShown ? (
                    <span className="grid-slot"> {column.letter_slot}</span>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {baseAtEnd ? null : base}
            {rows.map(row => {
              const quotes = (row.cells || []).find(
                cell => cell.banner_id === 'total'
              )?.unweighted_n;
              return (
                <tr key={row.id}>
                  <th>
                    {row.label}
                    {showQuotes && quotes != null ? (
                      <span className="flow-muted"> {quotes}</span>
                    ) : null}
                  </th>
                  {columns.map((column: BannerColumn) => {
                    const cell = (row.cells || []).find(item => item.banner_id === column.id);
                    const letter = lettersFor(letters, row.id, column.id);
                    if (row.kind === 'not_coded') {
                      return (
                        <td key={column.id} className="flow-muted">
                          {cellFigure(cell, figure, digits, weighted)}
                        </td>
                      );
                    }
                    return (
                      <td key={column.id}>
                        <Button
                          className="flow-cell"
                          type="button"
                          data-active={picked === `${row.id}:${column.id}`}
                          onClick={() => {
                            const selected = selectionFromCell(book, row, cell, letter);
                            if (!selected) return;
                            setPicked(`${row.id}:${column.id}`);
                            onSelectCell(selected);
                          }}
                        >
                          {cellFigure(
                            cell,
                            row.kind === 'mean' || row.kind === 'sd' ? 'mean' : figure,
                            digits,
                            weighted
                          )}
                          {markLowBase && cell?.low_base ? ' *' : ''}
                          {letter ? <span className="grid-letter"> {letter}</span> : null}
                        </Button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {baseAtEnd ? base : null}
          </tbody>
        </Table>
      </div>
      {bannerFootnote(book) ? <p className="flow-muted">{bannerFootnote(book)}</p> : null}
    </div>
  );
}

/** Columns a theme can be split by: no ids, no system columns, not the theme or its open end. */
export function splitColumns<T extends { name: string; label: string }>(
  columns: T[],
  theme: string
): T[] {
  const source = theme.replace(/_codes$/, '');
  return pickerColumns(columns).filter(
    column =>
      column.name !== theme &&
      column.name !== source &&
      !isIdColumn(column.name) &&
      !isIdColumn(column.label)
  );
}

export function ThemesPanel({
  datasetId,
  projectId,
  files = [],
  onSelectCell,
  onEditFrame,
  onReview,
  onUseNewer,
  initialStub = '',
}: {
  datasetId?: string;
  projectId?: string;
  files?: CodingFile[];
  onSelectCell: (cell: SurveyCell) => void;
  onEditFrame?: (column: string) => void;
  onReview?: (codeColumn: string) => void;
  onUseNewer?: (datasetId: string) => void;
  /** The theme to reopen, e.g. the one just reviewed, so its table comes back with new counts. */
  initialStub?: string;
}) {
  const router = useRouter();
  const coding = codingVersionStatus(files, datasetId);
  const [columns, setColumns] = useState<
    { name: string; label: string; type?: string; measure?: string }[]
  >([]);
  const [stub, setStub] = useState(initialStub);
  const [banner, setBanner] = useState('');
  const [weight, setWeight] = useState('');
  const [book, setBook] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);
  const [savingReport, setSavingReport] = useState(false);
  const [columnsReady, setColumnsReady] = useState(false);
  useEffect(() => {
    if (!datasetId) {
      setColumnsReady(true);
      return;
    }
    setColumnsReady(false);
    void flowJson<{
      columns?: { name?: string; label?: string; type?: string; measure?: string }[];
    }>(`/datasets/${datasetId}/metadata`)
      .then(meta => {
        setColumns(
          (meta.columns || [])
            .map(column => ({
              name: column.name || '',
              label: column.label || column.name || '',
              type: column.type,
              measure: column.measure,
            }))
            .filter(column => column.name)
        );
        setColumnsReady(true);
      })
      .catch(() => {
        setColumns([]);
        setError('Could not load columns.');
        setColumnsReady(true);
      });
  }, [datasetId]);
  const stubColumn = columns.find(column => column.name === stub);
  const themes = themeColumns(columns);
  const stubLabel = themes.find(item => item.value === stub)?.label || stubColumn?.label || stub;
  const openEnds = openEndColumns(pickerColumns(columns));
  const frameColumn = stub || themes[0]?.value || openEnds[0] || '';
  const themeCount = ((book?.rows as { kind?: string }[]) || []).filter(
    row => row.kind !== 'net'
  ).length;
  const notCoded = ((book?.stubs as { not_coded?: { unweighted_n?: number } }[]) || [])[0]
    ?.not_coded?.unweighted_n;
  const runSeq = useRef(0);
  const run = () => {
    if (!datasetId || !stub) return;
    const seq = (runSeq.current += 1);
    setError('');
    setRunning(true);
    setBook(null);
    void flowJson<Record<string, unknown>>(`/datasets/${datasetId}/tables`, {
      method: 'POST',
      body: JSON.stringify({
        stubs: [codedStub(stub)],
        banner: banner ? [{ column: banner }] : [],
        statistics: ['column_proportion'],
        significance_display: 'column_letters',
        weight: weight || 'none',
        save: false,
      }),
    })
      .then(page => {
        if (seq !== runSeq.current) return;
        setBook(page);
        setRunning(false);
        const read = themeRead(page);
        const row = ((page.rows as BannerRow[]) || []).find(item => item.id === read.rowId);
        const cell = row?.cells?.find(item => item.banner_id === read.bannerId);
        if (row && cell) {
          const letter = lettersFor((page.letters as SigLetter[]) || [], row.id, read.bannerId);
          const selected = selectionFromCell(page, row, cell, letter);
          if (selected) onSelectCell(selected);
        }
      })
      .catch(err => {
        if (seq !== runSeq.current) return;
        setRunning(false);
        setError(err instanceof Error ? err.message : 'Themes did not run');
      });
  };
  useEffect(() => {
    if (!stub || !datasetId) return;
    run();
    // run reads stub, banner and weight; it reruns when any of them changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stub, banner, weight, datasetId]);

  return (
    <div className="themes">
      <div className="themes-tools">
        {book ? (
          <Button className="flow-btn" type="button" data-active onClick={() => setBook(null)}>
            {stubLabel} · {themeCount} theme{themeCount === 1 ? '' : 's'} ×
          </Button>
        ) : null}
        <Button
          className="flow-btn"
          type="button"
          disabled={!frameColumn}
          onClick={() => onEditFrame?.(frameColumn)}
        >
          Edit code frame
        </Button>
        <span className="sheet-spacer" />
        <ChoiceSelect
          className="flow-input themes-weight"
          aria-label="Weight"
          value={weight}
          onValueChange={value => {
            setWeight(value);
            setBook(null);
          }}
          options={[
            { value: '', label: 'Unweighted' },
            ...pickerColumns(columns).map(column => ({ value: column.name, label: column.label })),
          ]}
        />
      </div>
      <div className="themes-head">
        <div>
          <p className="flow-muted">
            Open end{stub ? ` · ${stubLabel}` : ''}
            {coding.inUseLabel ? ` · ${coding.inUseLabel}` : ''}
          </p>
          <h2>{stub ? stubLabel : 'Choose a theme'}</h2>
          <p className="flow-muted">
            {book
              ? `${themeCount} theme${themeCount === 1 ? '' : 's'} · ${weight ? `weighted ${weight}` : 'unweighted'} · column %`
              : 'Column % with significance letters'}
          </p>
          {coding.newerAvailable && coding.newerId ? (
            <p className="flow-banner warn" role="status">
              {coding.newerLabel
                ? `Newer coding available (${coding.newerLabel})`
                : 'Newer coding available'}
              <Button
                className="flow-btn"
                type="button"
                onClick={() => onUseNewer?.(coding.newerId!)}
              >
                Use newer
              </Button>
            </p>
          ) : null}
        </div>
        <div className="themes-split">
          <span className="flow-muted">Theme</span>
          <ChoiceSelect
            className="flow-input"
            aria-label="Theme"
            value={stub}
            onValueChange={value => {
              setStub(value);
              setBook(null);
            }}
            options={[
              { value: '', label: themes.length ? 'Choose a theme' : 'No coded open end yet' },
              ...themes,
            ]}
          />
          <span className="flow-muted">Split by</span>
          {banner ? (
            <Button className="flow-btn" type="button" data-active onClick={() => setBanner('')}>
              {columns.find(column => column.name === banner)?.label || banner} ×
            </Button>
          ) : null}
          <ChoiceSelect
            className="flow-input themes-add"
            aria-label="Split by"
            value=""
            placeholder="+"
            onValueChange={value => {
              setBanner(value);
              setBook(null);
            }}
            options={splitColumns(columns, stub).map(column => ({
              value: column.name,
              label: column.label,
            }))}
          />
        </div>
      </div>
      {!columnsReady ? (
        <div aria-busy="true">
          <Skeleton className="mb-2 h-8 w-full" />
          <Skeleton className="mb-2 h-8 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : error ? (
        <p className="flow-error">{error}</p>
      ) : running ? (
        <div aria-busy="true">
          <Skeleton className="mb-2 h-8 w-full" />
          <Skeleton className="mb-2 h-8 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : book ? (
        <div className="themes-grid-scroll">
          <BannerGrid book={book} onSelectCell={onSelectCell} baseAtEnd showQuotes digits={0} />
        </div>
      ) : (
        <p className="flow-muted">Choose a theme and run it to see the table.</p>
      )}
      <div className="themes-cards">
        <div className="themes-links">
          {book ? (
            <div className="themes-read">
              <span className="themes-read-label">
                <i /> Read of this table
              </span>
              <p>{themeRead(book).text}</p>
            </div>
          ) : null}
          {projectId ? (
            book ? (
              <Button
                className="flow-btn primary"
                type="button"
                disabled={savingReport || !datasetId || !stub}
                onClick={() => {
                  if (!datasetId || !stub) return;
                  setSavingReport(true);
                  setError('');
                  void flowJson<Record<string, unknown>>(`/datasets/${datasetId}/tables`, {
                    method: 'POST',
                    body: JSON.stringify({
                      stubs: [codedStub(stub)],
                      banner: banner ? [{ column: banner }] : [],
                      statistics: ['column_proportion'],
                      significance_display: 'column_letters',
                      weight: weight || 'none',
                      save: true,
                    }),
                  })
                    .then(() => {
                      router.push(`/flow/p/${projectId}/report`);
                    })
                    .catch(err => {
                      setSavingReport(false);
                      setError(
                        err instanceof Error
                          ? err.message
                          : 'Could not add that table to the report'
                      );
                    });
                }}
              >
                {savingReport ? 'Adding…' : 'Add to report'}
              </Button>
            ) : (
              <Button className="flow-btn primary" type="button" disabled>
                Add to report
              </Button>
            )
          ) : null}
          {projectId ? (
            stub ? (
              <Button className="flow-btn" type="button" asChild>
                <Link href={`/flow/p/${projectId}/interviews`}>Open interviews</Link>
              </Button>
            ) : (
              <Button className="flow-btn" type="button" disabled title="Choose a theme first">
                Open interviews
              </Button>
            )
          ) : null}
          {projectId ? (
            stub ? (
              <Button className="flow-btn" type="button" asChild>
                <Link href={`/flow/p/${projectId}/tables`}>Use as banner</Link>
              </Button>
            ) : (
              <Button className="flow-btn" type="button" disabled title="Choose a theme first">
                Use as banner
              </Button>
            )
          ) : null}
        </div>
        {notCoded != null ? (
          <div className="themes-uncoded">
            <strong>{notCoded}</strong>
            <span>
              {notCoded === 0
                ? 'Every answer has a theme.'
                : `${notCoded === 1 ? 'answer has' : 'answers have'} no theme yet. They show as Not yet coded until you review them.`}
            </span>
            {notCoded > 0 && (onReview || onEditFrame) ? (
              <Button
                className="themes-review"
                type="button"
                onClick={() => (onReview ? onReview(frameColumn) : onEditFrame?.(frameColumn))}
              >
                Review {notCoded} →
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function EvidencePanel({
  datasetId,
  projectId,
}: {
  datasetId?: string;
  projectId?: string;
}) {
  const cell = useSurveyCell();
  const [quotes, setQuotes] = useState<Record<string, unknown> | null>(null);
  const [quotePhase, setQuotePhase] = useState<'idle' | 'loading' | 'ready'>('idle');
  const [error, setError] = useState('');
  const [syntaxNote, setSyntaxNote] = useState('');
  useEffect(() => {
    setSyntaxNote('');
    if (!datasetId || !cell?.bitset || !cell.textColumn) {
      setQuotes(null);
      setQuotePhase('idle');
      setEvidenceRespondents([]);
      if (cell && !cell.bitset)
        setError('This cell has no respondent bitset, so the verbatims cannot be listed.');
      return;
    }
    setError('');
    setQuotes(null);
    setQuotePhase('loading');
    setEvidenceRespondents([]);
    const controller = new AbortController();
    void flowJson<Record<string, unknown>>(`/datasets/${datasetId}/quotes`, {
      method: 'POST',
      body: JSON.stringify({
        text_column: cell.textColumn,
        row_uid_bitset: cell.bitset,
        page: 1,
        page_size: 20,
      }),
      signal: controller.signal,
    })
      .then(page => {
        setQuotes(page);
        setQuotePhase('ready');
        const rows = (page.quotes as { respondent_id?: string; row_uid?: string }[]) || [];
        setEvidenceRespondents(
          rows
            .flatMap(row => [row.row_uid, row.respondent_id])
            .map(value => String(value || ''))
            .filter(Boolean)
        );
      })
      .catch(err => {
        if (controller.signal.aborted) return;
        setQuotes(null);
        setQuotePhase('idle');
        setError(err instanceof Error ? err.message : 'Could not load verbatims');
      });
    return () => controller.abort();
  }, [datasetId, cell]);
  if (!cell) {
    return (
      <div className="evidence">
        <p className="flow-muted">Select a cell in Themes or Tables to open its verbatims.</p>
      </div>
    );
  }
  const items = (quotes?.quotes as { respondent_id: string; text: string }[]) || [];
  const total = Number(quotes?.total || 0);
  const shown = items.length;
  return (
    <div className="evidence">
      <div className="evidence-lead">
        <p className="flow-muted">{cell.claim}</p>
        <p className="evidence-percent">
          {cell.percent || '—'}
          <span>{cell.textColumn}</span>
        </p>
        {cell.letter ? <Badge className="evidence-letter">Letter {cell.letter}</Badge> : null}
      </div>
      <div className="evidence-built">
        <p className="flow-muted">How it&apos;s built</p>
        <p>
          <span>Base, unweighted</span>
          <span>{cell.base || '—'}</span>
        </p>
        <p>
          <span>In this cell</span>
          <span>{cell.n || '—'}</span>
        </p>
        <p>
          <span>Weight</span>
          <span>{cell.weight || 'none'}</span>
        </p>
        <p>
          <span>Column</span>
          <span>{cell.textColumn || '—'}</span>
        </p>
      </div>
      {error ? <p className="flow-error">{error}</p> : null}
      <div className="evidence-said">
        {quotePhase === 'loading' ? (
          <div aria-busy="true">
            <Skeleton className="mb-2 h-4 w-40" />
            <Skeleton className="mb-2 h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <>
            <p className="flow-muted">
              <span>What they said · {cell.textColumn}</span>
              <span>{total}</span>
            </p>
            {items.map(item => (
              <article key={`${item.respondent_id}-${item.text}`}>
                <p>“{String(item.text).trim()}”</p>
                <p className="flow-muted">
                  Respondent{' '}
                  {/^[0-9a-f-]{20,}$/i.test(String(item.respondent_id))
                    ? String(item.respondent_id).slice(0, 8)
                    : item.respondent_id}
                </p>
              </article>
            ))}
            {total > shown ? (
              <p className="flow-muted">
                Showing {shown} of {total}
              </p>
            ) : null}
            <Button
              className="flow-btn evidence-see"
              type="button"
              onClick={() => focusEvidenceRows()}
            >
              See all {total} in the sheet
            </Button>
          </>
        )}
      </div>
      <div className="evidence-actions">
        {projectId ? (
          <Button className="flow-btn" type="button" asChild>
            <Link href={`/flow/p/${projectId}/tables`}>Open table</Link>
          </Button>
        ) : null}
        <Button
          className="flow-btn"
          type="button"
          onClick={() => setSyntaxNote('This cell has no stored syntax.')}
        >
          View syntax
        </Button>
        {projectId ? (
          <Button className="flow-btn primary" type="button" asChild>
            <Link href={`/flow/p/${projectId}/report`}>Cite in report</Link>
          </Button>
        ) : null}
      </div>
      {syntaxNote ? <p className="flow-muted">{syntaxNote}</p> : null}
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

export function CodeFramePanel({
  datasetId,
  datasets,
  onAdopted,
}: {
  datasetId?: string;
  datasets: DatasetRow[];
  onAdopted?: (datasetId: string) => void;
}) {
  const [columns, setColumns] = useState<string[]>([]);
  const [textColumn, setTextColumn] = useState('');
  const [codes, setCodes] = useState<FrameCode[]>([]);
  const [progress, setProgress] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const [rename, setRename] = useState('');
  const [sourceDataset, setSourceDataset] = useState('');
  const [schemaOnly, setSchemaOnly] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [split, setSplit] = useState<{ id: string; left: string; right: string } | null>(null);

  useEffect(() => {
    void flowJson<{
      organizations?: { id?: string; privacy_mode?: string }[];
      active_organization_id?: string;
    }>('/api/organizations')
      .then(body => {
        const active = (body.organizations || []).find(
          org => org.id === body.active_organization_id
        );
        setSchemaOnly(active?.privacy_mode === 'schema_only');
      })
      .catch(() => setSchemaOnly(false));
  }, []);

  useEffect(() => {
    if (!datasetId) return;
    void flowJson<{ columns?: FlowColumn[] }>(`/datasets/${datasetId}/metadata`)
      .then(meta => setColumns(openEndColumns(pickerColumns(meta.columns || []))))
      .catch(() => setColumns([]));
  }, [datasetId]);

  const codeColumn = String(progress?.code_column || (textColumn ? `${textColumn}_codes` : ''));
  const frameDataset = String(progress?.derived_dataset_id || datasetId || '');

  async function proposeCodes(useModel = false) {
    const request = () =>
      flowJson<{ codes?: FrameCode[] }>(`/datasets/${datasetId}/open-end/propose`, {
        method: 'POST',
        body: JSON.stringify({
          text_column: textColumn,
          use_model: useModel,
          confirm_verbatims_sent: useModel,
        }),
      });
    const read = (result: { codes?: FrameCode[] }) =>
      Array.isArray(result?.codes) ? result.codes : [];
    let next = read(await request());
    if (useModel && !next.length) next = read(await request());
    setCodes(next);
    return next;
  }

  async function applyCodes(useModel: boolean, frame: FrameCode[]) {
    let jobId: string | null = null;
    for (;;) {
      const applied: Record<string, unknown> = await flowJson(
        `/datasets/${datasetId}/open-end/apply`,
        {
          method: 'POST',
          body: JSON.stringify({
            text_column: textColumn,
            codes: frame,
            use_model: schemaOnly ? false : useModel,
            job_id: jobId,
          }),
        }
      );
      setProgress(applied);
      if (applied.done && applied.derived_dataset_id)
        onAdopted?.(String(applied.derived_dataset_id));
      if (applied.done || !applied.job_id) return;
      jobId = String(applied.job_id);
    }
  }

  async function editFrame(body: Record<string, unknown>) {
    await flowJson(`/datasets/${frameDataset}/open-end/frame`, {
      method: 'POST',
      body: JSON.stringify({ code_column: codeColumn, ...body }),
    });
  }

  return (
    <div className="flow-panel">
      <h2>Code frame</h2>
      <ChoiceSelect
        className="flow-input"
        aria-label="Open-end column"
        value={textColumn}
        onValueChange={setTextColumn}
        options={[
          { value: '', label: 'Open-end column' },
          ...columns.map(column => ({ value: column, label: column })),
        ]}
      />
      <div className="flow-row">
        <Button
          className="flow-btn"
          type="button"
          onClick={() => {
            setError('');
            proposeCodes(!schemaOnly).catch(err =>
              setError(err instanceof Error ? err.message : 'Propose failed')
            );
          }}
        >
          Propose
        </Button>
        <Button
          className="flow-btn primary"
          type="button"
          disabled={!textColumn || schemaOnly}
          onClick={() => {
            setError('');
            proposeCodes(true)
              .then(next => {
                if (!next.length) {
                  setError('No themes were read from those answers.');
                  return;
                }
                return applyCodes(true, next);
              })
              .catch(err => setError(err instanceof Error ? err.message : 'Coding failed'));
          }}
        >
          Code themes
        </Button>
      </div>
      {schemaOnly ? (
        <p className="flow-muted">Schema-only studies keep the answers in this workspace.</p>
      ) : (
        <p className="flow-muted">
          Themes are read from the answers. Everyone who answered is assigned, and blank answers
          stay out of the base.
        </p>
      )}
      {error ? <p className="flow-error">{error}</p> : null}
      {Array.isArray(progress?.shares) ? (
        <ul className="flow-muted">
          {(
            progress.shares as {
              id?: string;
              label?: string;
              n?: number;
              percent?: number;
              example?: string;
            }[]
          ).map(share => (
            <li key={String(share.id || share.label)}>
              {share.label}: {share.n} ({share.percent}% of {String(progress.base ?? '')} who
              answered)
              {share.example ? ` — “${share.example}”` : ''}
            </li>
          ))}
        </ul>
      ) : null}
      <ul>
        {codes.map(code => (
          <li key={code.id} className="flow-row">
            <label>
              <Checkbox
                checked={selected.includes(code.id)}
                onCheckedChange={checked => {
                  setSelected(current =>
                    checked === true ? [...current, code.id] : current.filter(id => id !== code.id)
                  );
                }}
              />{' '}
              {code.label} <span className="flow-muted">{code.id}</span>
            </label>
            <Button
              className="flow-btn"
              type="button"
              onClick={() => setSplit({ id: code.id, left: '', right: '' })}
            >
              Split
            </Button>
          </li>
        ))}
      </ul>
      {selected.length > 1 ? (
        <Button
          className="flow-btn"
          type="button"
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
              .catch(err => setError(err instanceof Error ? err.message : 'Merge failed'));
          }}
        >
          Merge
        </Button>
      ) : null}
      {split ? (
        <form
          className="flow-row"
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
              .catch(err => setError(err instanceof Error ? err.message : 'Split failed'));
          }}
        >
          <Input
            className="flow-input"
            placeholder="First theme"
            value={split.left}
            onChange={event => setSplit({ ...split, left: event.target.value })}
          />
          <Input
            className="flow-input"
            placeholder="Second theme"
            value={split.right}
            onChange={event => setSplit({ ...split, right: event.target.value })}
          />
          <Button className="flow-btn" type="submit">
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
          className="flow-row"
          onSubmit={event => {
            event.preventDefault();
            const codeId = selected[0];
            setError('');
            editFrame({ action: 'rename', code_id: codeId, label: rename })
              .then(() => {
                setCodes(current =>
                  current.map(code => (code.id === codeId ? { ...code, label: rename } : code))
                );
              })
              .catch(err => setError(err instanceof Error ? err.message : 'Rename failed'));
          }}
        >
          <Input
            className="flow-input"
            aria-label="New theme label"
            placeholder="New label"
            value={rename}
            onChange={event => setRename(event.target.value)}
          />
          <Button className="flow-btn" type="submit">
            Rename
          </Button>
        </form>
      ) : null}
      <form
        className="flow-row"
        onSubmit={event => {
          event.preventDefault();
          if (!sourceDataset || !datasetId) return;
          setError('');
          void flowJson<Record<string, unknown>>(`/datasets/${datasetId}/open-end/reapply`, {
            method: 'POST',
            body: JSON.stringify({
              text_column: textColumn,
              source_dataset_id: sourceDataset,
              code_column: `${textColumn}_codes`,
              use_model: false,
              candidate_dataset_ids: datasets.map(dataset => datasetRowId(dataset)).filter(Boolean),
            }),
          })
            .then(result => {
              setProgress(result);
              if (result.derived_dataset_id) onAdopted?.(String(result.derived_dataset_id));
            })
            .catch(err => {
              const raw = err instanceof Error ? err.message : 'Reapply failed';
              try {
                const body = JSON.parse(raw) as {
                  detail?: { message?: string; frames?: { dataset_id: string }[] };
                };
                const frames = body.detail?.frames || [];
                if (frames[0]?.dataset_id) setSourceDataset(frames[0].dataset_id);
                setError(
                  body.detail?.message ||
                    'That file has no saved code frame. Pick the dataset in this project that has one.'
                );
              } catch {
                setError(raw);
              }
            });
        }}
      >
        <ChoiceSelect
          className="flow-input"
          aria-label="Reapply dataset"
          value={sourceDataset}
          onValueChange={setSourceDataset}
          options={[
            { value: '', label: 'Dataset in this project' },
            ...datasets
              .filter(dataset => datasetRowId(dataset) && datasetRowId(dataset) !== datasetId)
              .map(dataset => ({
                value: datasetRowId(dataset),
                label: dataset.original_filename || datasetRowId(dataset),
              })),
          ]}
        />
        <Button className="flow-btn" type="submit" disabled={!sourceDataset || !textColumn}>
          Reapply
        </Button>
      </form>
    </div>
  );
}

type TableColumn = {
  name: string;
  label: string;
  labels: Record<string, string>;
  type?: string;
  role?: string;
};

/** Stub and banner choices. Ids, open text, and weight columns are not questions. */
export function tablePickerColumns(columns: TableColumn[], weights: string[] = []): TableColumn[] {
  const weightNames = new Set(weights.map(name => name.toLowerCase()).filter(Boolean));
  return columns.filter(column => {
    if (!column.name || isInternalColumn(column.name) || isIdColumn(column.name)) return false;
    if (weightNames.has(column.name.toLowerCase())) return false;
    if (String(column.role || '').toLowerCase() === 'weight') return false;
    const labelled = Object.keys(column.labels || {}).length > 0;
    const type = String(column.type || '').toLowerCase();
    if (!labelled && (type === 'string' || type === 'text')) return false;
    return true;
  });
}
type SavedSpec = {
  spec_id?: string;
  id?: string;
  label?: string;
  name?: string;
  dataset_id?: string;
  filename?: string;
  number?: number;
  stale?: boolean;
  detail?: string;
};
type SavedBook = { id?: string; name?: string; n_specs?: number };

function scaleCodes(labels: Record<string, string> | undefined, end: 'top' | 'bottom'): string[] {
  const scored = Object.keys(labels || {})
    .map(code => ({ code, n: Number(code) }))
    .filter(item => Number.isFinite(item.n))
    .sort((a, b) => a.n - b.n);
  const picked = end === 'bottom' ? scored.slice(0, 2) : scored.slice(-2);
  return picked.map(item => item.code);
}

/** Two highest or lowest numeric codes found in the whole file. */
export function scaleCodesFromValues(values: string[], end: 'top' | 'bottom'): string[] {
  const scored = values
    .map(code => ({ code, n: Number(code) }))
    .filter(item => item.code.trim() !== '' && Number.isFinite(item.n))
    .sort((a, b) => a.n - b.n);
  if (scored.length < 3) return [];
  const picked = end === 'bottom' ? scored.slice(0, 2) : scored.slice(-2);
  return picked.map(item => item.code);
}

/** Earlier turns in this pane, in the shape the agent reads as history. */
export function agentHistory(
  thread: { role: 'user' | 'run' | 'reply'; text: string }[]
): { role: string; content: string }[] {
  return thread
    .filter(item => item.role !== 'run' && item.text.trim())
    .map(item => ({ role: item.role === 'user' ? 'user' : 'assistant', content: item.text }));
}

/** The agent's answer, or its question when it needs one more detail. */
export function agentReplyText(result: {
  status?: string;
  answer_markdown?: string;
  clarification_questions?: string[];
}): string {
  if (result.answer_markdown) return result.answer_markdown;
  if (result.status === 'clarification')
    return (result.clarification_questions || []).filter(Boolean).join('\n');
  return '';
}

/** The saved weight first, then any other weight column the file has. */
export function tableWeightChoices(listed: string[] | undefined, active: string): string[] {
  // _weight is the internal copy of the visible raked column, never a choice of its own.
  const all = [active, ...(listed || [])].filter(name => Boolean(name) && name !== '_weight');
  return all.filter(
    (name, index) => all.findIndex(other => other.toLowerCase() === name.toLowerCase()) === index
  );
}

/** The weight's label. The variable name is only used when there is no label. */
export function weightOptionLabel(name: string, label: string): string {
  const clean = label.trim();
  if (!clean || clean.toLowerCase() === name.toLowerCase() || /^weight$/i.test(clean)) return name;
  return clean;
}

/** The question. A category such as Midlands is not the question's name. */
export function columnChoiceLabel(column: { name: string; label: string }): string {
  const label = column.label.trim();
  return label || column.name;
}

function bannerNames(spec: { banners?: { column?: string; columns?: string[] }[] } | undefined) {
  const names: string[] = [];
  for (const banner of spec?.banners || []) {
    if (banner.column) names.push(String(banner.column));
    for (const column of banner.columns || []) names.push(String(column));
  }
  return names.filter((name, index) => name && names.indexOf(name) === index);
}

/** The banner book an agent turn produced, if any. */
export function bookFromToolResults(results: unknown): Record<string, unknown> | null {
  const items = Array.isArray(results) ? results : [];
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index] as Record<string, unknown> | null;
    const candidates = [
      item,
      item?.result,
      (item?.result as Record<string, unknown> | undefined)?.result,
    ];
    for (const candidate of candidates) {
      if (
        candidate &&
        typeof candidate === 'object' &&
        Array.isArray((candidate as Record<string, unknown>).cells) &&
        Array.isArray((candidate as Record<string, unknown>).banner_columns)
      ) {
        return candidate as Record<string, unknown>;
      }
    }
  }
  return null;
}

/**
 * The table the agent built, as a Tables request: every value row kept beside its nets,
 * same banner, weight, statistics and filter, saved to the list.
 */
export function tableBodyFromAgentBook(
  book: Record<string, unknown>
): Record<string, unknown> | null {
  const spec = (book.spec || {}) as Record<string, unknown>;
  const stubs = (Array.isArray(spec.stubs) ? spec.stubs : [])
    .filter((stub): stub is Record<string, unknown> => Boolean(stub && typeof stub === 'object'))
    .map(stub => {
      const { values, ...rest } = stub;
      // An empty value list is the net row alone; Tables shows the whole scale.
      return Array.isArray(values) && values.length === 0 ? rest : stub;
    })
    .filter(stub => stub.column);
  if (!stubs.length) return null;
  const banners = (Array.isArray(spec.banners) ? spec.banners : [])
    .filter((banner): banner is Record<string, unknown> =>
      Boolean(banner && typeof banner === 'object')
    )
    .map(banner =>
      Array.isArray(banner.columns) ? { columns: banner.columns } : { column: banner.column }
    )
    .filter(banner => ('columns' in banner ? (banner.columns as unknown[]).length : banner.column));
  const weightRef = spec.weight as { column?: string; weight_vector?: unknown } | null | undefined;
  const weight = weightRef?.column ? String(weightRef.column) : weightRef ? undefined : 'none';
  return {
    stubs,
    banner: banners,
    ...(Array.isArray(spec.statistics) ? { statistics: spec.statistics } : {}),
    ...(spec.significance_display ? { significance_display: spec.significance_display } : {}),
    ...(typeof spec.nest_banners === 'boolean' ? { nest_banners: spec.nest_banners } : {}),
    ...(spec.filter_ref ? { filter_ref: spec.filter_ref } : {}),
    ...(weight ? { weight } : {}),
    save: true,
  };
}

/**
 * A net's codes in the form the column stores. A column kept as label text ("Agree") needs the
 * labels, not the codes (4, 5), or the net counts nobody.
 */
export function netValuesAsStored(
  codes: string[],
  labels: Record<string, string> | undefined,
  stored: string[]
): string[] {
  if (!stored.length || codes.some(code => stored.includes(code))) return codes;
  const asLabels = codes
    .map(code => labels?.[code])
    .filter((label): label is string => Boolean(label));
  return asLabels.length === codes.length && asLabels.some(label => stored.includes(label))
    ? asLabels
    : codes;
}

/** The agent's session id: the stream puts it under turn_state. */
export function agentSessionId(result: {
  session_id?: string;
  turn_state?: Record<string, unknown>;
}): string {
  return String(result.session_id || result.turn_state?.session_id || '');
}

/**
 * The last table the agent ran, as a Tables request. The reply carries the run's request body,
 * not the table, so Tables re-runs that body with every value row and saves it.
 */
export function tableBodyFromAgentRun(results: unknown): Record<string, unknown> | null {
  const items = Array.isArray(results) ? results : [];
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = (items[index] || {}) as Record<string, unknown>;
    const args = (item.args || {}) as Record<string, unknown>;
    const kind = String(item.analysis_type || item.procedure || args.analysis_type || '');
    if (kind !== 'banner_table') continue;
    const body = (item.request_body || args.request_body || {}) as Record<string, unknown>;
    const netsOnBody = Array.isArray(body.nets) ? body.nets : [];
    const listed: Record<string, unknown>[] = Array.isArray(body.stubs)
      ? (body.stubs as Record<string, unknown>[])
      : (Array.isArray(body.stub_columns) ? body.stub_columns : [body.stub_column])
          .filter(Boolean)
          .map(column => ({ column }) as Record<string, unknown>);
    const stubs = listed
      .filter(stub => stub && stub.column)
      .map(stub => {
        const { values, ...rest } = stub;
        const kept = Array.isArray(values) && values.length === 0 ? rest : stub;
        const nets = Array.isArray(kept.nets) && kept.nets.length ? kept.nets : netsOnBody;
        return nets.length ? { ...kept, nets } : kept;
      });
    if (!stubs.length) return null;
    const banner = Array.isArray(body.banner)
      ? (body.banner as Record<string, unknown>[])
          .map(item =>
            Array.isArray(item.columns) ? { columns: item.columns } : { column: item.column }
          )
          .filter(item => ('columns' in item ? (item.columns as unknown[]).length : item.column))
      : body.banner_column
        ? [{ column: body.banner_column }]
        : [];
    const statistics = Array.isArray(body.statistics)
      ? body.statistics
      : body.row_percent
        ? ['row_proportion']
        : ['column_proportion'];
    return {
      stubs,
      banner,
      statistics,
      significance_display: body.significance_display || 'column_letters',
      nest_banners:
        typeof body.nest_banners === 'boolean'
          ? body.nest_banners
          : banner.some(item => 'columns' in item),
      ...(typeof body.low_base_threshold === 'number'
        ? { low_base_threshold: body.low_base_threshold }
        : {}),
      ...(body.filter_ref ? { filter_ref: body.filter_ref } : {}),
      ...(typeof body.weight === 'string' && body.weight ? { weight: body.weight } : {}),
      save: true,
    };
  }
  return null;
}

/** Nets the user made on the stub, kept apart from Top 2 / Bottom 2. */
export function userNets(nets: { label?: string; values?: unknown[] }[] | undefined) {
  return (nets || [])
    .filter(net => net && !/^(top|bottom) 2 box$/i.test(String(net.label || '')))
    .map(net => ({ label: String(net.label || 'Net'), values: (net.values || []).map(String) }));
}

export function TablesBuilder({
  datasetId,
  projectId,
  files = [],
  datasets = [],
  onFile,
  onAdopted,
  initialStub = '',
  initialBanner = '',
}: {
  datasetId?: string;
  projectId?: string;
  files?: { id: string; name: string; inUse?: boolean }[];
  datasets?: {
    dataset_id?: string;
    id?: string;
    original_filename?: string;
    n_rows?: number;
  }[];
  onFile?: (id: string) => void;
  onAdopted?: (datasetId: string) => void;
  initialStub?: string;
  initialBanner?: string;
}) {
  const router = useRouter();
  const [weightOpen, setWeightOpen] = useState(false);
  const [weightRerake, setWeightRerake] = useState(false);
  const [customNets, setCustomNets] = useState<{ label: string; values: string[] }[]>([]);
  const [netOpen, setNetOpen] = useState(false);
  const [netOptions, setNetOptions] = useState<string[]>([]);
  const [netPicked, setNetPicked] = useState<string[]>([]);
  const [netLabel, setNetLabel] = useState('');
  const [agentSteps, setAgentSteps] = useState<string[]>([]);
  const [tableFilter, setTableFilter] = useState<{
    filters: { column: string; op: string; value: string | string[] }[];
  } | null>(null);
  useEffect(() => {
    if (!datasetId) return;
    try {
      const key = `tensr-table-filter:${datasetId}`;
      const raw = window.sessionStorage.getItem(key);
      if (raw) {
        setTableFilter(JSON.parse(raw));
        window.sessionStorage.removeItem(key);
      }
    } catch {
      // A filter handed over from Responses is optional.
    }
  }, [datasetId]);
  const [columns, setColumns] = useState<TableColumn[]>([]);
  const [weightColumns, setWeightColumns] = useState<string[]>([]);
  const [weightNeedsRefresh, setWeightNeedsRefresh] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [specs, setSpecs] = useState<SavedSpec[]>([]);
  const [books, setBooks] = useState<SavedBook[]>([]);
  const [stub, setStub] = useState(initialStub);
  const [banners, setBanners] = useState<string[]>(initialBanner ? [initialBanner] : []);
  const [weight, setWeight] = useState('');
  const activeWeightName = useRef('');
  const [statistic, setStatistic] = useState('column_proportion');
  const [digits, setDigits] = useState(0);
  const [lettersOn, setLettersOn] = useState(true);
  const [nest, setNest] = useState(false);
  const [lowBase, setLowBase] = useState(true);
  const [top2, setTop2] = useState(false);
  const [bottom2, setBottom2] = useState(false);
  const [meanOn, setMeanOn] = useState(false);
  const [book, setBook] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [ask, setAsk] = useState('');
  const [threads, setThreads] = useState<
    Record<string, { role: 'user' | 'run' | 'reply'; text: string }[]>
  >({});
  const [asking, setAsking] = useState(false);
  // One agent conversation per file, so an answer to its question resumes the same request.
  const [agentSessions, setAgentSessions] = useState<Record<string, string>>({});
  const [railReady, setRailReady] = useState(false);
  const [opening, setOpening] = useState(false);
  const [view, setView] = useState<'table' | 'chart'>('table');
  const loadingSaved = useRef(false);
  const weightFromTable = useRef(false);
  const fileIdsRef = useRef<string[]>([]);
  fileIdsRef.current = (files || []).map(file => file.id);

  useEffect(() => {
    if (!datasetId) {
      setRailReady(true);
      return;
    }
    setRailReady(false);
    let live = true;
    // A table picked on another file opens once that file is the one showing.
    let pendingOpen = '';
    try {
      pendingOpen = window.sessionStorage.getItem(`tensr-open-table:${datasetId}`) || '';
      window.sessionStorage.removeItem(`tensr-open-table:${datasetId}`);
    } catch {
      pendingOpen = '';
    }
    const firstPage = pendingOpen
      ? Promise.resolve({
          specs: [] as SavedSpec[],
          first: null as Record<string, unknown> | null,
        })
      : flowJson<{ specs?: SavedSpec[]; first?: Record<string, unknown> | null }>(
          `/datasets/${datasetId}/tables?open_first=true`
        ).catch(() => ({
          specs: [] as SavedSpec[],
          first: null as Record<string, unknown> | null,
        }));
    void Promise.all([
      firstPage,
      // The open file's list comes from the open_first call; the project list reads only this project's files.
      loadProjectTables(projectId, datasetId, {
        fileIds: fileIdsRef.current,
        filePage: pendingOpen ? undefined : firstPage,
      }),
      flowJson<{ books?: SavedBook[] }>(`/datasets/${datasetId}/banner-books`).catch(() => ({
        books: [] as SavedBook[],
      })),
    ]).then(async ([specPage, projectTables, bookPage]) => {
      if (!live) return;
      const saved: SavedSpec[] = projectTables.map(table => ({
        spec_id: table.id,
        label: table.label,
        dataset_id: table.datasetId,
        filename: table.filename,
        number: table.number,
        stale: table.stale,
        detail: table.detail,
      }));
      setSpecs(saved);
      setBooks(bookPage.books || []);
      const liveHere = saved.filter(
        item => !item.stale && (!item.dataset_id || item.dataset_id === datasetId)
      );
      const firstHere = saved.find(item => !item.dataset_id || item.dataset_id === datasetId);
      const firstId = pendingOpen || liveHere[0]?.spec_id || liveHere[0]?.id;
      const openedId = String(
        (specPage.first as { spec?: { id?: string } } | null)?.spec?.id || ''
      );
      const openedLive = liveHere.some(item => (item.spec_id || item.id) === openedId);
      setRailReady(true);
      if (specPage.first && !pendingOpen && openedLive) {
        remember(specPage.first);
      } else if (firstHere?.stale && !pendingOpen && !firstId) {
        setError(firstHere.detail || 'Rebuild this table on the current file.');
      } else if (firstId) {
        setOpening(true);
        const opened = await flowJson<Record<string, unknown>>(
          `/datasets/${datasetId}/tables/${firstId}`
        ).catch(() => null);
        if (!live) return;
        if (opened) remember(opened);
        setOpening(false);
      }
    });
    void flowJson<{
      columns?: {
        name?: string;
        label?: string;
        type?: string;
        role?: string | null;
        value_labels?: Record<string, string>;
      }[];
      active_weight_column?: string | null;
      weight_columns?: string[];
      weight_vector?: { needs_refresh?: boolean } | null;
    }>(`/datasets/${datasetId}/metadata`)
      .then(meta => {
        const choices = tableWeightChoices(meta.weight_columns, meta.active_weight_column || '');
        activeWeightName.current = meta.active_weight_column || '';
        setWeightColumns(choices);
        // A saved table's weight wins. The file weight is only the default before one is open.
        const active = meta.active_weight_column || '';
        const chosen = defaultTableWeight(active, choices);
        if (!weightFromTable.current && chosen) setWeight(current => current || chosen);
        setWeightNeedsRefresh(Boolean(meta.weight_vector?.needs_refresh));
        setColumns(
          (meta.columns || [])
            .map(column => ({
              name: column.name || '',
              label: column.label || column.name || '',
              labels: column.value_labels || {},
              type: column.type,
              role: column.role || undefined,
            }))
            .filter(column => column.name)
        );
      })
      .catch(() => setColumns([]));
    return () => {
      live = false;
    };
  }, [datasetId]);

  const labelFor = (name: string) => {
    const column = columns.find(item => item.name === name);
    return column ? columnChoiceLabel(column) : name;
  };
  const questionText = (name: string) => {
    const label = columns.find(column => column.name === name)?.label;
    return label && label !== name ? label : name;
  };
  const figure =
    statistic === 'count'
      ? 'count'
      : statistic === 'row_proportion'
        ? 'row_percent'
        : statistic === 'total_proportion'
          ? 'total_percent'
          : 'percent';

  function openCell(cell: SurveyCell) {
    setSurveyCell(cell);
    if (projectId) router.push(`/flow/p/${projectId}/responses`);
  }

  function remember(body: Record<string, unknown>) {
    loadingSaved.current = true;
    setBook(body);
    const spec = body.spec as
      | {
          id?: string;
          label?: string;
          nest_banners?: boolean;
          decimals?: Record<string, number>;
          filter?: { filters?: { column: string; op: string; value: string | string[] }[] } | null;
          stubs?: { column?: string; nets?: { label?: string; values?: unknown[] }[] }[];
          banners?: { column?: string; columns?: string[]; nested?: unknown }[];
          weight?: { column?: string } | string | null;
        }
      | undefined;
    const stubColumn = spec?.stubs?.[0]?.column;
    if (stubColumn) setStub(String(stubColumn));
    const storedNets = spec?.stubs?.[0]?.nets || [];
    setCustomNets(userNets(storedNets));
    setTop2(storedNets.some(net => /^top 2 box$/i.test(String(net.label || ''))));
    setBottom2(storedNets.some(net => /^bottom 2 box$/i.test(String(net.label || ''))));
    const names = bannerNames(spec);
    if (names.length) setBanners(names);
    setNest(Boolean(spec?.nest_banners));
    const decimals = spec?.decimals;
    if (decimals && typeof decimals === 'object') {
      const first = Object.values(decimals).find(value => typeof value === 'number');
      if (typeof first === 'number') setDigits(first);
    }
    const savedFilters = spec?.filter?.filters;
    if (Array.isArray(savedFilters)) setTableFilter({ filters: savedFilters });
    const savedWeight = spec?.weight;
    if (savedWeight && typeof savedWeight === 'object' && 'column' in savedWeight) {
      weightFromTable.current = true;
      const column = String(savedWeight.column || '');
      if (!column) setWeight('');
      else if (column === '_weight') {
        const visible = activeWeightName.current;
        setWeight(visible && visible !== '_weight' ? visible : '');
      } else setWeight(column);
    }
    const id = String(spec?.id || '');
    if (id) {
      const assigned = Number(body.table_number);
      setSpecs(current =>
        current.some(item => (item.spec_id || item.id) === id)
          ? current
          : [
              {
                spec_id: id,
                label: spec?.label || stubColumn || stub,
                dataset_id: datasetId,
                ...(Number.isFinite(assigned) && assigned > 0 ? { number: assigned } : {}),
              },
              ...current,
            ]
      );
    }
  }

  /** Re-runs the agent's table in the main pane with every row, and saves it to the list. */
  async function adoptAgentTable(request: Record<string, unknown>) {
    if (!datasetId) return;
    setView('table');
    setOpening(true);
    const saved = await flowJson<Record<string, unknown>>(`/datasets/${datasetId}/tables`, {
      method: 'POST',
      body: JSON.stringify(request),
    }).catch(() => null);
    setOpening(false);
    if (!saved) {
      setError('The agent built the table, but it could not be saved. Try Save.');
      setDirty(true);
      return;
    }
    loadingSaved.current = true;
    const nets = ((saved.spec as { stubs?: { nets?: { label?: string }[] }[] } | undefined)
      ?.stubs?.[0]?.nets || []) as { label?: string }[];
    setTop2(nets.some(net => /^top 2 box$/i.test(String(net.label || ''))));
    setBottom2(nets.some(net => /^bottom 2 box$/i.test(String(net.label || ''))));
    setDirty(false);
    const savedId = String((saved.spec as { id?: string } | undefined)?.id || '');
    // The conversation that built the table stays with it.
    if (savedId && savedId !== threadKey)
      setThreads(all => ({
        ...all,
        [savedId]: [...(all[savedId] || []), ...(all[threadKey] || [])],
      }));
    remember(saved);
  }

  async function netCodes(end: 'top' | 'bottom'): Promise<string[]> {
    const column = columns.find(item => item.name === stub);
    const labelled = scaleCodes(column?.labels, end);
    if (!datasetId) return labelled;
    const page = await flowJson<{ values?: string[] }>(
      `/datasets/${datasetId}/columns/${encodeURIComponent(stub)}/values`
    ).catch(() => ({ values: [] as string[] }));
    if (labelled.length >= 2) return netValuesAsStored(labelled, column?.labels, page.values || []);
    return scaleCodesFromValues(page.values || [], end);
  }

  function saveTable() {
    void runTable(true);
  }

  const tableRequest = useRef(0);
  async function runTable(save: boolean) {
    const token = ++tableRequest.current;
    if (!datasetId || !stub) return;
    const nets: { label: string; values: string[] }[] = [];
    if (top2) {
      const values = await netCodes('top');
      if (token !== tableRequest.current) return;
      if (values.length < 2) {
        setBook(null);
        setError('That column has no numbered scale for a top 2 box.');
        return;
      }
      nets.push({ label: 'Top 2 box', values });
    }
    if (bottom2) {
      const values = await netCodes('bottom');
      if (token !== tableRequest.current) return;
      if (values.length < 2) {
        setBook(null);
        setError('That column has no numbered scale for a bottom 2 box.');
        return;
      }
      nets.push({ label: 'Bottom 2 box', values });
    }
    if (token !== tableRequest.current) return;
    nets.push(...customNets);
    setError('');
    const statistics = shownStatistics(statistic, meanOn);
    const openId = String((book?.spec as { id?: string } | undefined)?.id || '');
    void flowJson<Record<string, unknown>>(`/datasets/${datasetId}/tables`, {
      method: 'POST',
      body: JSON.stringify({
        stubs: [{ ...codedStub(stub), nets }],
        banner: banners.map(columnName => ({ column: columnName })),
        statistics,
        significance_display: lettersOn ? 'column_letters' : 'none',
        nest_banners: nest,
        low_base_threshold: lowBase ? 30 : 0,
        suppress_low_base: false,
        decimals: shownDecimals(statistic, digits, meanOn),
        weight: weight || 'none',
        ...(openId ? { spec_id: openId } : {}),
        ...(tableFilter?.filters.length ? { filter_ref: tableFilter } : {}),
        save,
      }),
    })
      .then(body => {
        if (token !== tableRequest.current) return;
        if (!save) {
          setBook(body);
          return;
        }
        setDirty(false);
        remember(body);
        const across = banners.length ? banners.map(labelFor).join(', ') : 'the total';
        const savedId = String((body.spec as { id?: string } | undefined)?.id || threadKey);
        setThreads(all => ({
          ...all,
          [savedId]: [
            ...(all[threadKey] || []),
            {
              role: 'run',
              text: `Built ${labelFor(stub)} × ${across}`,
            },
            {
              role: 'run',
              text: `${weight ? `Weighted by ${labelFor(weight)}` : 'Unweighted'}, ${
                lettersOn ? 'sig at 95%' : 'no significance letters'
              }`,
            },
          ],
        }));
      })
      .catch(err => {
        if (token !== tableRequest.current) return;
        setError(err instanceof Error ? err.message : 'Could not save the table');
      });
  }

  const optionsKey = [
    top2,
    bottom2,
    weight,
    statistic,
    digits,
    lettersOn,
    nest,
    lowBase,
    meanOn,
    JSON.stringify(customNets),
    JSON.stringify(tableFilter),
  ].join('|');
  const lastOptions = useRef(optionsKey);
  useEffect(() => {
    if (lastOptions.current === optionsKey) return;
    lastOptions.current = optionsKey;
    // Options copied from a saved table describe that table; they do not rebuild it as a draft.
    if (loadingSaved.current) return;
    if (!stub || !book) return;
    setDirty(true);
    void runTable(false);
    // Options rebuild the table they belong to; stub and banner changes save on their own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optionsKey]);
  // Runs after the options effect in the same commit, so the flag covers exactly one update.
  const shapeKey = `${stub}|${banners.join(',')}`;
  const lastShape = useRef(shapeKey);
  useEffect(() => {
    if (lastShape.current === shapeKey) return;
    lastShape.current = shapeKey;
    if (loadingSaved.current) return;
    if (!stub) {
      setBook(null);
      setDirty(false);
      return;
    }
    setBook(null);
    setDirty(true);
    void runTable(false);
    // A saved table sets the stub itself. Only a later change rebuilds the body.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapeKey]);
  useEffect(() => {
    loadingSaved.current = false;
  });
  useEffect(() => {
    if (!datasetId || !stub || !banners.length || book) return;
    void runTable(false);
    // The first preview runs once a stub and a banner are both set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasetId, stub, banners, book]);

  function matchesSaved(): boolean {
    const spec = currentSpec() as {
      stubs?: { column?: string }[];
      banners?: { column?: string; columns?: string[] }[];
    } | null;
    const id = String((book?.spec as { id?: string } | undefined)?.id || '');
    const listed = Boolean(id) && specs.some(item => (item.spec_id || item.id) === id);
    return savedTableMatches(
      listed,
      String(spec?.stubs?.[0]?.column || ''),
      bannerNames(spec || undefined),
      stub,
      banners
    );
  }

  function currentSpec(): Record<string, unknown> | null {
    const spec = book?.spec;
    return spec && typeof spec === 'object' ? (spec as Record<string, unknown>) : null;
  }

  function addToBook() {
    const spec = currentSpec();
    if (!datasetId || !spec) {
      setError('Save a table before adding it to a banner book.');
      return;
    }
    setError('');
    void flowJson<{ book?: SavedBook }>(`/datasets/${datasetId}/banner-books`, {
      method: 'POST',
      body: JSON.stringify({ name: 'Banner book', specs: [spec] }),
    })
      .then(saved => {
        if (saved.book?.id) setBooks(current => [saved.book as SavedBook, ...current]);
        setNote('Added to a banner book.');
      })
      .catch(err =>
        setError(err instanceof Error ? err.message : 'Could not save the banner book')
      );
  }

  function runBook() {
    const spec = currentSpec();
    if (!datasetId || !spec) {
      setError('Save a table before running a banner book.');
      return;
    }
    setError('');
    void flowJson<{ book?: { id?: string } }>(`/datasets/${datasetId}/banner-books`, {
      method: 'POST',
      body: JSON.stringify({ name: 'Banner book', specs: [spec] }),
    })
      .then(saved => {
        const bookId = saved.book?.id;
        if (!bookId) throw new Error('The banner book was not saved.');
        if (saved.book) setBooks(current => [saved.book as SavedBook, ...current]);
        return flowJson<{ tables?: unknown[] }>(
          `/datasets/${datasetId}/banner-books/${bookId}/run`,
          {
            method: 'POST',
            body: JSON.stringify({ target_dataset_id: datasetId, mapping: {} }),
          }
        );
      })
      .then(result => {
        const count = result?.tables?.length ?? 0;
        setNote(`Banner book ran on this file. ${count} table${count === 1 ? '' : 's'}.`);
      })
      .catch(err => setError(err instanceof Error ? err.message : 'The banner book did not run'));
  }

  const specId = String((book?.spec as { id?: string } | undefined)?.id || '');
  const threadKey = specId || 'draft';
  const thread = threads[threadKey] || [];
  const setThread = (
    update: (
      current: { role: 'user' | 'run' | 'reply'; text: string }[]
    ) => { role: 'user' | 'run' | 'reply'; text: string }[]
  ) => setThreads(current => ({ ...current, [threadKey]: update(current[threadKey] || []) }));
  const openSaved = specs.find(item => (item.spec_id || item.id) === specId);
  const usedNumbers = specs.map(item => item.number || 0).filter(number => number > 0);
  const numberShift = usedNumbers.length ? Math.min(...usedNumbers) - 1 : 0;
  const selectedNumber = openSaved?.number
    ? Math.max(1, openSaved.number - numberShift)
    : undefined;
  const railLabel = (spec: SavedSpec) =>
    titledWithQuestions(
      spec.label || spec.name || '',
      columns.map(column => ({ name: column.name, label: columnChoiceLabel(column) }))
    );
  const title = book
    ? `${selectedNumber ? `T${selectedNumber} · ` : ''}${labelFor(stub)}${
        banners.length ? ` by ${banners.map(labelFor).join(', ')}` : ''
      }`
    : 'Save a table';
  const baseCopy = tableBaseCopy(
    book
      ? {
          base_label: book.base_label as string | null | undefined,
          answered_n: book.answered_n as number | null | undefined,
          respondent_n: book.respondent_n as number | null | undefined,
          weight: book.weight as
            | {
                weight_aware?: boolean;
                weighted_n?: number | null;
                unweighted_n?: number | null;
              }
            | null
            | undefined,
        }
      : null
  );
  const baseLine = baseCopy.line;
  const totalBase = baseCopy.foot;

  return (
    <div className="flow-split tables-board">
      <aside className="tables-rail">
        <div className="tables-rail-head">
          <span>Tables</span>
          <span>{specs.length}</span>
        </div>
        {!railReady ? (
          <div aria-busy="true">
            <Skeleton className="mb-2 h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : specs.length ? (
          specs.map(spec => {
            const id = spec.spec_id || spec.id || '';
            return (
              <Button
                key={id}
                className="tables-saved"
                type="button"
                data-active={id === specId}
                onClick={() => {
                  if (dirty) {
                    setError('This table has unsaved changes. Save it before opening another.');
                    return;
                  }
                  if (spec.dataset_id && spec.dataset_id !== datasetId && onFile && !spec.stale) {
                    try {
                      window.sessionStorage.setItem(`tensr-open-table:${spec.dataset_id}`, id);
                    } catch {
                      // Without storage the file still switches; its first table opens.
                    }
                    onFile(spec.dataset_id);
                    return;
                  }
                  void flowJson<Record<string, unknown>>(`/datasets/${datasetId}/tables/${id}`)
                    .then(remember)
                    .catch(err => {
                      if (isTableSourceChanged(err)) {
                        setBook(null);
                        setError(
                          'Built on an older version of the data. Rebuild on current file from Report, or open the original version from Sources.'
                        );
                        return;
                      }
                      setError(err instanceof Error ? err.message : 'Could not open that table');
                    });
                }}
              >
                <span>T{Math.max(1, (spec.number || 1) - numberShift)}</span>
                <span className="tables-saved-copy">
                  <span>{railLabel(spec)}</span>
                  {spec.stale ? (
                    <span className="flow-muted">Rebuild</span>
                  ) : spec.filename ? (
                    <span className="flow-muted">{spec.filename}</span>
                  ) : null}
                </span>
              </Button>
            );
          })
        ) : (
          <p className="flow-muted">No saved tables yet</p>
        )}
        <div className="tables-rail-head">
          <span>Banner books</span>
          <Button
            className="flow-btn"
            type="button"
            onClick={addToBook}
            aria-label="Add to banner book"
          >
            +
          </Button>
        </div>
        {!railReady ? null : books.length ? (
          books.map(item => (
            <p key={item.id} className="tables-book">
              {item.name || 'Banner book'}
              {item.n_specs != null ? ` · ${item.n_specs}` : ''}
            </p>
          ))
        ) : (
          <p className="flow-muted">No banner books yet</p>
        )}
      </aside>
      {view === 'chart' && !chartSeriesFromBook(book).length ? (
        <TableChart
          datasetId={datasetId}
          projectId={projectId}
          columns={columns}
          onShowTable={() => setView('table')}
          tables={specs.map(item => ({
            id: item.spec_id || item.id || '',
            label: item.label || item.name || '',
            number: item.number,
          }))}
          onOpenTable={id => {
            setView('table');
            void flowJson<Record<string, unknown>>(`/datasets/${datasetId}/tables/${id}`)
              .then(remember)
              .catch(() => undefined);
          }}
        />
      ) : (
        <>
          <section className="tables-main">
            <div className="tables-tools">
              {tableFilter?.filters.length ? (
                <div className="tables-line">
                  <span>Filter</span>
                  <Button
                    className="tables-chip accent"
                    type="button"
                    onClick={() => setTableFilter(null)}
                  >
                    {tableFilter.filters
                      .map(
                        item =>
                          `${item.column} ${item.op === 'in' ? 'is' : 'is not'} ${
                            Array.isArray(item.value) ? item.value.join(', ') : item.value
                          }`
                      )
                      .join(' and ')}{' '}
                    ×
                  </Button>
                </div>
              ) : null}
              {files.length ? (
                <div className="tables-line">
                  <span>File</span>
                  <ChoiceSelect
                    className="flow-input tables-file"
                    aria-label="Table file"
                    value={datasetId || ''}
                    onValueChange={value => onFile?.(value)}
                    options={files.map(file => ({
                      value: file.id,
                      label: `${file.name}${file.inUse ? ' · in use' : ''}`,
                    }))}
                  />
                </div>
              ) : null}
              <div className="tables-line">
                <span>Stub</span>
                {stub ? (
                  <Button className="tables-chip accent" type="button" onClick={() => setStub('')}>
                    {labelFor(stub)} ×
                  </Button>
                ) : null}
                <ChoiceSelect
                  className="flow-input"
                  aria-label="Table stub"
                  value=""
                  onValueChange={value => {
                    if (value) setStub(value);
                  }}
                  options={[
                    { value: '', label: '+ Drop variable' },
                    ...tablePickerColumns(columns, weightColumns).map(column => ({
                      value: column.name,
                      label: columnChoiceLabel(column),
                    })),
                  ]}
                />
              </div>
              <div className="tables-line">
                <span>Banner</span>
                {banners.map(name => (
                  <Button
                    key={name}
                    className="tables-chip"
                    type="button"
                    onClick={() => setBanners(current => current.filter(item => item !== name))}
                  >
                    {labelFor(name)} ×
                  </Button>
                ))}
                <ChoiceSelect
                  className="flow-input"
                  aria-label="Add banner"
                  value=""
                  onValueChange={value => {
                    if (!value || value === stub || banners.includes(value)) return;
                    setBanners(current => [...current, value]);
                  }}
                  options={[
                    { value: '', label: '+' },
                    ...tablePickerColumns(columns, weightColumns)
                      .filter(column => column.name !== stub && !banners.includes(column.name))
                      .map(column => ({ value: column.name, label: columnChoiceLabel(column) })),
                  ]}
                />
              </div>
              <div className="tables-line wrap">
                <span>Show</span>
                <div className="tables-segment">
                  {(
                    [
                      ['count', 'Counts'],
                      ['column_proportion', 'Column %'],
                      ['row_proportion', 'Row %'],
                      ['total_proportion', 'Total %'],
                    ] as const
                  ).map(([value, label]) => (
                    <Button
                      key={value}
                      className="flow-btn"
                      type="button"
                      data-active={statistic === value}
                      onClick={() => setStatistic(value)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                <Button
                  className="flow-btn"
                  type="button"
                  onClick={() =>
                    setDigits(current => {
                      const next = (current + 1) % 7;
                      saveOutputPreferences({ ...loadOutputPreferences(), decimalPlaces: next });
                      return next;
                    })
                  }
                >
                  {digits} dp
                </Button>
                <Button
                  className="flow-btn"
                  type="button"
                  data-active={lettersOn}
                  onClick={() => setLettersOn(current => !current)}
                >
                  Sig 95% · A/a letters
                </Button>
                <Button
                  className="flow-btn"
                  type="button"
                  onClick={() => setView(current => (current === 'chart' ? 'table' : 'chart'))}
                >
                  {view === 'chart' ? 'Table' : 'Chart'}
                </Button>
                <Button
                  className="flow-btn"
                  type="button"
                  data-active={nest}
                  onClick={() => setNest(current => !current)}
                >
                  Nest banners
                </Button>
                <Button
                  className="flow-btn"
                  type="button"
                  data-active={lowBase}
                  onClick={() => setLowBase(current => !current)}
                >
                  Low base &lt; 30 *
                </Button>
                <ChoiceSelect
                  className="flow-input tables-weight"
                  aria-label="Table weight"
                  value={weight}
                  onValueChange={setWeight}
                  options={[
                    { value: '', label: 'Unweighted' },
                    ...weightColumns.map(name => {
                      const label = labelFor(name);
                      const shared = weightColumns.filter(other => labelFor(other) === label);
                      return {
                        value: name,
                        label:
                          shared.length > 1 ? `${label} · ${name}` : weightOptionLabel(name, label),
                      };
                    }),
                  ]}
                />
                <span className="flow-muted">Scale</span>
                <div className="tables-segment">
                  <Button
                    className="flow-btn"
                    type="button"
                    data-active={top2}
                    onClick={() => setTop2(current => !current)}
                  >
                    Top 2 box
                  </Button>
                  <Button
                    className="flow-btn"
                    type="button"
                    data-active={bottom2}
                    onClick={() => setBottom2(current => !current)}
                  >
                    Bottom 2 box
                  </Button>
                  <Button
                    className="flow-btn"
                    type="button"
                    data-active={meanOn}
                    onClick={() => setMeanOn(current => !current)}
                  >
                    Mean
                  </Button>
                </div>
                {customNets.map(net => (
                  <Button
                    key={net.label}
                    className="tables-chip accent"
                    type="button"
                    title={net.values.join(', ')}
                    onClick={() =>
                      setCustomNets(current => current.filter(item => item.label !== net.label))
                    }
                  >
                    {net.label} ×
                  </Button>
                ))}
                <Popover
                  open={netOpen}
                  onOpenChange={open => {
                    setNetOpen(open);
                    if (!open || !stub) return;
                    setNetPicked([]);
                    setNetLabel('');
                    const labelled = Object.keys(
                      columns.find(item => item.name === stub)?.labels || {}
                    );
                    if (labelled.length) {
                      setNetOptions(labelled);
                      return;
                    }
                    void flowJson<{ values?: string[] }>(
                      `/datasets/${datasetId}/columns/${encodeURIComponent(stub)}/values`
                    )
                      .then(page => setNetOptions(page.values || []))
                      .catch(() => setNetOptions([]));
                  }}
                >
                  <PopoverTrigger asChild>
                    <Button className="flow-btn" type="button" disabled={!stub}>
                      + Net
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="tables-net">
                    <p className="tables-net-head">Net codes of {labelFor(stub)}</p>
                    <div className="tables-net-codes">
                      {netOptions.map(code => {
                        const label = columns.find(item => item.name === stub)?.labels?.[code];
                        return (
                          <label key={code} className="stack-file">
                            <Checkbox
                              checked={netPicked.includes(code)}
                              onCheckedChange={checked =>
                                setNetPicked(current =>
                                  checked === true
                                    ? [...current, code]
                                    : current.filter(item => item !== code)
                                )
                              }
                            />
                            <span>{label ? `${label} (${code})` : code}</span>
                          </label>
                        );
                      })}
                      {netOptions.length === 0 ? (
                        <p className="flow-muted">No codes found.</p>
                      ) : null}
                    </div>
                    <Input
                      aria-label="Net name"
                      placeholder="Net name, e.g. Any agree"
                      value={netLabel}
                      onChange={event => setNetLabel(event.target.value)}
                    />
                    <Button
                      className="flow-btn primary"
                      type="button"
                      disabled={netPicked.length < 2}
                      onClick={() => {
                        const label = netLabel.trim() || `Net ${netPicked.join('+')}`;
                        setCustomNets(current => [
                          ...current.filter(item => item.label !== label),
                          { label, values: netPicked },
                        ]);
                        setNetOpen(false);
                      }}
                    >
                      Add net
                    </Button>
                  </PopoverContent>
                </Popover>
                <span className="flow-muted">Nets kept on re-run</span>
                <Button className="flow-btn tables-run-book" type="button" onClick={runBook}>
                  Run as banner book →
                </Button>
              </div>
            </div>
            {error ? <p className="flow-error">{error}</p> : null}
            {note ? <p className="flow-muted">{note}</p> : null}
            {weightNeedsRefresh ? (
              <p className="flow-banner warn" role="status">
                Made before a weighting fix · re-run
                <Button
                  className="flow-btn"
                  type="button"
                  onClick={() => {
                    setWeightRerake(true);
                    setWeightOpen(true);
                  }}
                >
                  Re-rake
                </Button>
              </p>
            ) : null}
            <div className="tables-sheet">
              <div className="tables-title">
                <div>
                  <h2>{title}</h2>
                  <p className="flow-muted">
                    {[questionText(stub), baseLine].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div className="tables-title-actions">
                  {stub && (dirty || !matchesSaved()) ? (
                    <Button className="flow-btn primary" type="button" onClick={saveTable}>
                      Save table
                    </Button>
                  ) : null}
                  {dirty ? <span className="flow-muted">Unsaved changes</span> : null}
                  <Button
                    className="flow-btn"
                    type="button"
                    onClick={() => setView(current => (current === 'chart' ? 'table' : 'chart'))}
                  >
                    {view === 'chart' ? 'Table' : 'Chart'}
                  </Button>
                  <Button className="flow-btn" type="button" onClick={addToBook}>
                    Add to book
                  </Button>
                  <Button
                    className="flow-btn"
                    type="button"
                    onClick={() => {
                      if (!datasetId || !specId) {
                        setError('Save the table before exporting.');
                        return;
                      }
                      const title = String(openSaved?.label || 'table');
                      const filename = `${title.replace(/[^\w.-]+/g, ' ').trim() || 'table'}.docx`;
                      void downloadExport(
                        `/datasets/${datasetId}/tables/${specId}/export.docx`,
                        filename
                      ).catch(err =>
                        setError(err instanceof Error ? err.message : 'Could not export the table')
                      );
                    }}
                  >
                    Export
                  </Button>
                </div>
              </div>
              {!railReady || (opening && !book) ? (
                <div aria-busy="true">
                  <Skeleton className="mb-2 h-8 w-full" />
                  <Skeleton className="mb-2 h-8 w-full" />
                  <Skeleton className="h-48 w-full" />
                </div>
              ) : book ? (
                <>
                  {openSaved?.stale ? (
                    <div className="tables-stale">
                      <p>{openSaved.detail || 'This table is on an older version of the data.'}</p>
                      <Button
                        className="flow-btn"
                        type="button"
                        onClick={() => {
                          if (!datasetId || !specId) return;
                          void flowJson<{
                            ok?: boolean;
                            blocked?: boolean;
                            detail?: string;
                            dataset_id?: string;
                            weight_note?: string;
                          }>(`/datasets/${datasetId}/tables/${specId}/rebuild`, {
                            method: 'POST',
                            body: JSON.stringify({}),
                          })
                            .then(async result => {
                              if (result.blocked) {
                                setError(result.detail || 'This file has a scale problem.');
                                return;
                              }
                              setSpecs(current =>
                                current.map(item =>
                                  (item.spec_id || item.id) === specId
                                    ? { ...item, stale: false, detail: '' }
                                    : item
                                )
                              );
                              setError(result.weight_note || '');
                              const opened = await flowJson<Record<string, unknown>>(
                                `/datasets/${result.dataset_id || datasetId}/tables/${specId}`
                              );
                              remember(opened);
                            })
                            .catch(err =>
                              setError(err instanceof Error ? err.message : 'Could not rebuild')
                            );
                        }}
                      >
                        Rebuild
                      </Button>
                      <Button
                        className="flow-btn"
                        type="button"
                        onClick={() => {
                          if (openSaved?.dataset_id) onFile?.(openSaved.dataset_id);
                        }}
                      >
                        Open original version
                      </Button>
                    </div>
                  ) : null}
                  {view === 'chart' && chartSeriesFromBook(book).length ? (
                    <TableBars
                      series={chartSeriesFromBook(book)}
                      onAddToReport={
                        projectId && datasetId && (book.run_id || specId)
                          ? () => {
                              const runId = book.run_id
                                ? String(book.run_id)
                                : specId
                                  ? `table:${specId}`
                                  : '';
                              if (!runId) return;
                              const series = chartSeriesFromBook(book);
                              const pin = {
                                id: runId,
                                runId,
                                datasetId,
                                headline: String(book.title || labelFor(stub) || 'Chart'),
                                support: bannerFootnote(book),
                                citation: 'Chart',
                                afterId: '',
                                deck: true,
                                topline: true,
                                keepLive: true,
                                bars: series.flatMap(row =>
                                  row.values.map(item => ({
                                    label:
                                      row.values.length > 1
                                        ? `${row.label} · ${item.name}`
                                        : row.label,
                                    percent: item.value,
                                  }))
                                ),
                              };
                              if (book.run_id) void savePin(projectId, datasetId, pin);
                              else rememberTablePin(projectId, pin);
                            }
                          : undefined
                      }
                    />
                  ) : (
                    <BannerGrid
                      book={book}
                      onSelectCell={openCell}
                      muted={Boolean(openSaved?.stale)}
                      baseAtEnd
                      showNets={
                        top2 ||
                        bottom2 ||
                        ((book.rows as { kind?: string }[]) || []).some(row => row.kind === 'net')
                      }
                      figure={figure}
                      digits={digits}
                      markLowBase={lowBase}
                    />
                  )}
                </>
              ) : (
                <p className="flow-muted">
                  {stub && banners.length
                    ? 'Building the preview.'
                    : stub
                      ? 'Choose a banner to preview the table.'
                      : 'Choose a stub to preview the table.'}
                </p>
              )}
            </div>
            <div className="tables-foot">
              <span>{totalBase}</span>
              <span>{tableFootStatus(Boolean(specId) && matchesSaved(), dirty)}</span>
            </div>
          </section>
          <aside className="tables-agent">
            <div className="tables-agent-head">
              <span className="tables-dot" />
              <span>{book ? title.replace(/^T\d+ · /, '') : 'Table'}</span>
            </div>
            <div className="tables-thread">
              {thread.length === 0 && !asking ? (
                <div className="tables-thread-empty">
                  <strong>
                    {selectedNumber ? `Ask about T${selectedNumber}` : 'Ask about this table'}
                  </strong>
                  <p className="flow-muted">
                    Ask what moved, or tell it to change the table: add a banner, net the top two
                    boxes, or weight it.
                  </p>
                </div>
              ) : null}
              {thread.map((item, index) =>
                item.role === 'reply' ? (
                  <FlowMarkdown key={`reply-${index}`} className="tables-reply">
                    {item.text}
                  </FlowMarkdown>
                ) : (
                  <p
                    key={`${item.role}-${index}`}
                    className={item.role === 'user' ? 'tables-ask' : 'flow-muted'}
                  >
                    {item.role === 'run' ? `✓ ${item.text}` : item.text}
                  </p>
                )
              )}
              {asking ? (
                <p className="flow-status">{agentSteps.filter(Boolean).at(-1) || 'Thinking…'}</p>
              ) : null}
            </div>
            <FlowComposer
              value={ask}
              onChange={setAsk}
              onSend={() => {
                const text = ask.trim();
                if (!text || asking) return;
                setThread(current => [...current, { role: 'user', text }]);
                setAsk('');
                setAsking(true);
                setAgentSteps([]);
                const history = agentHistory(thread);
                const sessionKey = `${datasetId}:${threadKey}`;
                void runAgentLoop({
                  message: text,
                  mode: 'agent',
                  datasetId: datasetId || null,
                  agentVersion: 'v2',
                  sessionId: agentSessions[sessionKey] || null,
                  conversationHistory: history,
                  signal: AbortSignal.timeout(180_000),
                  onProgress: progress => {
                    const line = visibleAgentStep(progress.step, progress.message);
                    if (line)
                      setAgentSteps(current =>
                        current.includes(line) ? current : [...current, line]
                      );
                  },
                })
                  .then(result => {
                    const session = agentSessionId(result);
                    if (session)
                      setAgentSessions(current => ({ ...current, [sessionKey]: session }));
                    const built = bookFromToolResults(result.tool_results);
                    const request = built
                      ? tableBodyFromAgentBook(built)
                      : tableBodyFromAgentRun(result.tool_results);
                    if (built) {
                      setBook(built);
                      setView('table');
                    }
                    if (request) void adoptAgentTable(request);
                    setThread(current => [
                      ...current,
                      {
                        role: 'reply',
                        text:
                          agentReplyText(result) ||
                          (built || request ? 'Built the table.' : 'No answer came back.'),
                      },
                    ]);
                  })
                  .catch(err =>
                    setThread(current => [
                      ...current,
                      {
                        role: 'run',
                        text: err instanceof Error ? err.message : 'The reply did not finish.',
                      },
                    ])
                  )
                  .finally(() => setAsking(false));
              }}
              placeholder="Ask, or tell it to change the table…"
              mode="agent"
              onMode={() => undefined}
              showModes={false}
              busy={asking}
              columns={columns.map(column => column.name)}
              attachments={[]}
              onAttach={() => undefined}
              onRemoveAttachment={() => undefined}
              layout="thread"
            />
          </aside>
        </>
      )}
      {weightOpen ? (
        <WeightPanel
          datasetId={datasetId}
          datasets={
            datasets.length
              ? datasets
              : files.map(file => ({ id: file.id, original_filename: file.name }))
          }
          rerake={weightRerake}
          onClose={() => {
            setWeightOpen(false);
            setWeightRerake(false);
          }}
          onAdopted={nextId => {
            setWeightOpen(false);
            setWeightRerake(false);
            setWeightNeedsRefresh(false);
            onAdopted?.(nextId);
          }}
        />
      ) : null}
    </div>
  );
}

export async function downloadExport(path: string, filename: string, init?: RequestInit) {
  const response = await flowFetch(path, init);
  if (!response.ok) throw new Error(await response.text());
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || '');
      const comma = value.indexOf(',');
      resolve(comma >= 0 ? value.slice(comma + 1) : value);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
