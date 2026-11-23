'use client';

import { useEffect, useRef, useState } from 'react';
import { Quote } from 'lucide-react';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/atoms/empty';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger, Skeleton } from '@/components/ui/rest';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ChoiceSelect } from '@/components/ui/select';
import { Table } from '@/components/ui/table';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiRequestError, formatApiErrorMessage } from '@/lib/api-error';
import { flowFetch, flowJson } from '@/lib/flow-api';
import { titledWithQuestions } from '@/lib/flow-report';
import { loadOutputPreferences, saveOutputPreferences } from '@/lib/output-preferences';
import { AgentThread } from '@/components/flow/agent-thread';
import { SidePanel } from '@/components/flow/side-panel';
import { formatStat } from '@/lib/number-format';
import { loadProjectTables, numberTables } from '@/components/flow/project-tables';
import { isNonAnswerTheme } from '@/components/flow/coding-review-data';
import {
  isAdminField,
  isIdColumn,
  isInternalColumn,
  isOtherSpecifyField,
  isTableTextCategorical,
  openEndColumns,
  pickerColumns,
  questionnaireOutline,
  tableStubPickerOptions,
  themeColumns,
  type FlowColumn,
  type OutlineQuestion,
  type OutlineSetWithStructure,
} from '@/lib/flow-columns';
import { TableChart } from '@/components/flow/table-chart-panel';
import { TableBars } from '@/components/flow/table-bars';
import { NumberTracePopover } from '@/components/flow/number-trace-popover';
import { VariablePreviewTrigger } from '@/components/flow/variable-preview-trigger';
import { rememberTablePin, savePin } from '@/components/flow/report-pins';
import { WeightPanel } from '@/components/flow/weight-modal';
export { WeightPanel } from '@/components/flow/weight-modal';
import { TableSignificancePanel } from '@/components/flow/table-significance-panel';
import { TabSpecDialog } from '@/components/flow/tab-spec-dialog';
import { TidyTablesDialog } from '@/components/flow/tidy-tables-dialog';
import { TablesFirstRun } from '@/components/flow/tables-first-run';
import { firstRunAgentPrompts, isTablesFirstRun } from '@/lib/tables-first-run';
import {
  DEFAULT_TABLE_SIGNIFICANCE,
  arrowForCell,
  clearProjectSignificance,
  loadProjectSignificance,
  saveProjectSignificance,
  settingsFromSpec,
  significanceRequestFields,
  significanceToolbarLabel,
  type TableSignificanceSettings,
} from '@/lib/table-significance';
import { numberTraceFromCell } from '@/lib/number-trace';
import {
  bannerColumns,
  bannerFootnote,
  bannerHeading,
  chartSeriesFromBook,
  chartSignificanceNote,
  codedStub,
  lettersFor,
  formatGroupedNumber,
  extraCellStatLines,
  mediaCellLines,
  mediaCellText,
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
import type { SavedAudience } from '@/components/flow/audience-panel';
import { BannerAddPicker, bannerChipClass } from '@/components/flow/table-banner-picker';
import { CellStatsPopover, type SummaryColumnKind } from '@/components/flow/cell-stats-popover';
import {
  bannerRefLabel,
  bannerRefsFromSpec,
  bannerRequestItems,
  columnNamesFromBannerRefs,
  tableBannerKey,
  tableBannerKeys,
  type TableBannerRef,
} from '@/components/flow/table-banner-refs';

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

/**
 * Counts use the same people units as the table base (never silent thousands).
 * Projected 000s are a separate statistic and render via mediaCellLines with a k label.
 */
export function displayedCount(
  cell:
    | {
        count?: number | null;
        weighted_n?: number | null;
        unweighted_n?: number | null;
        projected_thousands?: number | null;
      }
    | undefined,
  weighted: boolean
): string {
  if (!cell) return '—';
  if (weighted) {
    const raw = cell.count ?? cell.weighted_n;
    if (raw == null || Number.isNaN(Number(raw))) return '—';
    const weightedShown = formatGroupedNumber(Number(raw));
    const unweighted = cell.unweighted_n;
    if (unweighted != null && !Number.isNaN(Number(unweighted))) {
      return `${weightedShown} (${formatGroupedNumber(Number(unweighted))})`;
    }
    return weightedShown;
  }
  const raw = cell.unweighted_n ?? cell.count;
  if (raw == null || Number.isNaN(Number(raw))) return '—';
  return formatGroupedNumber(Number(raw));
}

/**
 * Statistics sent for a table run. Only what the user toggled — never force
 * index / projected / unweighted on (Paper 5d checklist). Drop Projected 000s
 * when the active weight is not a projection.
 */
export function tableStatisticsForWeight(
  selected: string[],
  weighted: boolean,
  isProjection = false
): string[] {
  const stats = selected.filter(Boolean);
  const base = stats.length ? stats : ['column_proportion'];
  if (!weighted || isProjection) return base;
  return base.filter(kind => kind !== 'projected_thousands');
}

/** Book weight block: projection weights carry is_projection / projection_unit. */
export function bookIsProjection(
  book: { weight?: { is_projection?: boolean; projection_unit?: string | null } | null } | null
): boolean {
  const weight = book?.weight;
  if (!weight || typeof weight !== 'object') return false;
  if (weight.is_projection === true) return true;
  if (weight.is_projection === false) return false;
  return Boolean(weight.projection_unit);
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

export {
  audienceBannerSizeLabel,
  bannerRefsFromSpec,
  bannerRequestItems,
  tableBannerKey,
} from '@/components/flow/table-banner-refs';
export type { TableBannerRef } from '@/components/flow/table-banner-refs';

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

function storedWeightColumn(stored: unknown): string {
  if (typeof stored === 'string') return stored.trim();
  if (stored && typeof stored === 'object' && 'column' in stored) {
    return String((stored as { column?: unknown }).column || '').trim();
  }
  return '';
}

function isRealWeightColumn(name: string): boolean {
  return Boolean(name) && name !== '_weight' && !/^(none|unweighted|null)$/i.test(name);
}

/**
 * The weight the picker shows. A stored sentinel is not a choice.
 * A weighted book names its column. An unweighted book stays Unweighted.
 */
export function selectedTableWeight(
  stored: unknown,
  bookWeight: { column?: string | null; weight_aware?: boolean } | null | undefined,
  active: string
): string {
  const specColumn = storedWeightColumn(stored);
  if (isRealWeightColumn(specColumn)) return specColumn;
  const bookColumn = String(bookWeight?.column || '').trim();
  if (bookWeight?.weight_aware && isRealWeightColumn(bookColumn)) return bookColumn;
  if (specColumn === '_weight' || bookColumn === '_weight') {
    return active && active !== '_weight' ? active : '';
  }
  if (bookWeight?.weight_aware && active && active !== '_weight') return active;
  return '';
}

/** The file's active weight, including the internal copy of a raked column. */
export function defaultTableWeight(active: string, choices: string[]): string {
  if (active && active !== '_weight' && choices.includes(active)) return active;
  if (active === '_weight') return choices[0] || '';
  return '';
}

/** The cell measure stays selected when the mean row is on. Counts stay whole numbers. */

const CELL_FIGURES = ['count', 'percent', 'row_percent', 'total_percent', 'mean'] as const;

type CellFigure = (typeof CELL_FIGURES)[number];

const STATISTIC_FIGURE: Record<string, CellFigure> = {
  count: 'count',
  column_proportion: 'percent',
  row_proportion: 'row_percent',
  total_proportion: 'total_percent',
  column_mean: 'mean',
};

/** One or more Show chips, plus the mean row when that toggle is on. */
export function shownStatistics(statistic: string | string[], meanOn: boolean): string[] {
  const selected = (Array.isArray(statistic) ? statistic : [statistic]).filter(Boolean);
  const base = selected.length ? selected : ['column_proportion'];
  if (meanOn && !base.includes('column_mean')) return [...base, 'column_mean'];
  return [...base];
}

export function shownDecimals(
  statistic: string | string[],
  digits: number,
  meanOn: boolean
): Record<string, number> {
  const places = Number.isFinite(digits) ? digits : 0;
  const selected = shownStatistics(statistic, false);
  const out: Record<string, number> = {};
  for (const kind of selected) {
    out[kind] = kind === 'count' ? 0 : places;
  }
  if (meanOn) out.column_mean = Math.max(places, 1);
  return out;
}

/** Figures the grid paints for the selected Show statistics. */
export function figuresForStatistics(statistics: string[]): CellFigure[] {
  const figures: CellFigure[] = [];
  for (const kind of statistics) {
    const figure = STATISTIC_FIGURE[kind];
    if (figure && !figures.includes(figure)) figures.push(figure);
  }
  return figures.length ? figures : ['percent'];
}

function cellFigure(
  cell: BannerCell | undefined,
  figure: CellFigure,
  digits: number,
  weighted = false,
  options?: { includeProjected?: boolean; includeIndex?: boolean }
): string {
  if (!cell) return '—';
  if (figure === 'count') return displayedCount(cell, weighted);
  if (figure === 'mean') {
    return cell.mean != null ? formatStat(cell.mean, 'mean', digits) : '—';
  }
  return mediaCellText(cell, figure, digits, options);
}

function cellFigures(
  cell: BannerCell | undefined,
  figures: CellFigure[],
  digits: number,
  weighted = false,
  isProjection = false,
  statistics: string[] = []
): string {
  const hasCount = figures.includes('count');
  const parts = figures
    .map(figure =>
      cellFigure(cell, figure, digits, weighted, {
        includeProjected:
          isProjection &&
          !hasCount &&
          figure === 'percent' &&
          statistics.includes('projected_thousands'),
        includeIndex: figure === 'percent' && statistics.includes('index'),
      })
    )
    .filter(part => part && part !== '—');
  return parts.length ? parts.join(' · ') : '—';
}

/** Paper 5d: one statistic group per line so multi-stat cells do not collide. */
function StackedCellFigures({
  cell,
  figures,
  digits,
  weighted,
  letter,
  isProjection = false,
  statistics = [],
}: {
  cell: BannerCell | undefined;
  figures: CellFigure[];
  digits: number;
  weighted: boolean;
  letter?: string;
  isProjection?: boolean;
  statistics?: string[];
}) {
  const wantsPercent = figures.includes('percent');
  const hasCount = figures.includes('count');
  const extras = figures.filter(figure => figure !== 'percent');
  const inferential = extraCellStatLines(cell, statistics, digits);
  const showProjected = isProjection && !hasCount && statistics.includes('projected_thousands');
  const showIndex = statistics.includes('index');
  const showUnweighted =
    !hasCount &&
    (statistics.includes('unweighted_base') || statistics.includes('projected_thousands'));
  const multi =
    figures.length > 1 || showProjected || showIndex || showUnweighted || inferential.length > 0;
  // Always stack when more than one figure is on (Row % used to overflow sideways).
  if (!wantsPercent || !multi) {
    const text = cellFigures(cell, figures, digits, weighted, isProjection, statistics);
    return (
      <span className="flow-cell-stack">
        <span className="flow-cell-stack-primary">
          {text}
          {letter ? <span className="grid-letter"> {letter}</span> : null}
        </span>
        {inferential.map(text => (
          <span key={text} className="flow-cell-stack-muted">
            {text}
          </span>
        ))}
      </span>
    );
  }
  const lines = mediaCellLines(cell, digits, {
    includeProjected: showProjected,
    includeIndex: showIndex,
    includeUnweighted: showUnweighted,
  });
  const extraText = extras
    .map(figure => cellFigure(cell, figure, digits, weighted))
    .filter(part => part && part !== '—');
  return (
    <span className="flow-cell-stack">
      <span className="flow-cell-stack-primary">
        {lines.percent}
        {letter ? <span className="grid-letter"> {letter}</span> : null}
      </span>
      {lines.detail ? <span className="flow-cell-stack-muted">{lines.detail}</span> : null}
      {lines.base ? <span className="flow-cell-stack-muted">{lines.base}</span> : null}
      {extraText.map(text => (
        <span key={text} className="flow-cell-stack-muted">
          {text}
        </span>
      ))}
      {inferential.map(text => (
        <span key={text} className="flow-cell-stack-muted">
          {text}
        </span>
      ))}
    </span>
  );
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
  onCommentCell,
  baseAtEnd = false,
  showQuotes = false,
  showNets = false,
  figure = 'percent',
  figures,
  statistics = [],
  digits = 1,
  markLowBase = false,
  muted = false,
  columnLabels = [],
  significance,
}: {
  book: Record<string, unknown>;
  onSelectCell: (cell: SurveyCell) => void;
  /** Optional Paper 9f Comment action when the host screen can open comments. */
  onCommentCell?: (cell: SurveyCell) => void;
  baseAtEnd?: boolean;
  showQuotes?: boolean;
  showNets?: boolean;
  figure?: CellFigure;
  figures?: CellFigure[];
  /** Full statistic kinds selected in the cell-stats popover. */
  statistics?: string[];
  digits?: number;
  markLowBase?: boolean;
  muted?: boolean;
  columnLabels?: { name: string; label: string }[];
  /** Live Tables significance settings so the footnote matches the panel. */
  significance?: TableSignificanceSettings | null;
}) {
  const shownFigures = figures?.length ? figures : [figure];
  const weighted = Boolean((book.weight as { weight_aware?: boolean } | undefined)?.weight_aware);
  const isProjection = bookIsProjection(book);
  const cellStatistics =
    statistics.length > 0
      ? statistics
      : Array.isArray((book.spec as { statistics?: string[] } | undefined)?.statistics)
        ? ((book.spec as { statistics?: string[] }).statistics as string[])
        : [];
  const [picked, setPicked] = useState('');
  const columns = bannerColumns(book);
  const letters = (book.letters as SigLetter[]) || [];
  const lettersShown = String(book.significance_display || 'column_letters') === 'column_letters';
  const arrowsShown = String(book.significance_display || '') === 'cell_comparisons';
  const stubMeta = ((book.stubs as {
    not_coded?: { unweighted_n?: number };
    source_text_column?: string | null;
  }[]) || [])[0];
  const notCoded = stubMeta?.not_coded;
  // Mean and SD stay with the scale for every cell measure, including Counts.
  // Nets hide only when the user has not asked for them on this table.
  const listed = ((book.rows as BannerRow[]) || []).filter(
    row => row.kind === 'mean' || row.kind === 'sd' || showNets || row.kind !== 'net'
  );
  // "Not yet coded" is for open-end themes only (Themes, or a coded stub with source text).
  // Multi-select dichotomies must not invent that row.
  const codedOpenEnd = showQuotes || Boolean(String(stubMeta?.source_text_column || '').trim());
  const rows = themeRows(listed, codedOpenEnd ? notCoded?.unweighted_n : null, showQuotes);
  if (!columns.length) return <p className="flow-muted">This table has no banner columns yet.</p>;
  const cornerLabel = showQuotes
    ? 'Theme'
    : ((book.stubs as { label?: string; column?: string }[]) || []).length > 1
      ? ''
      : stubHeaderLabel(
          ((book.stubs as { label?: string; column?: string }[]) || [])[0],
          columnLabels
        );
  const base = (
    <tr>
      <th title="Base">Base</th>
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
              <th title={cornerLabel || undefined}>{cornerLabel}</th>
              {columns.map(column => {
                const heading = bannerHeading(column);
                return (
                  <th key={column.id} title={heading || undefined}>
                    {heading}
                    {column.letter_slot && lettersShown ? (
                      <span className="grid-slot"> {column.letter_slot}</span>
                    ) : null}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {baseAtEnd ? null : base}
            {rows.map(row => {
              const quotes = (row.cells || []).find(
                cell => cell.banner_id === 'total'
              )?.unweighted_n;
              if (row.kind === 'header') {
                return (
                  <tr key={row.id} className="grid-stub-header">
                    <th colSpan={columns.length + 1} title={row.label}>
                      {row.label}
                    </th>
                  </tr>
                );
              }
              return (
                <tr key={row.id}>
                  <th title={row.label}>
                    {row.label}
                    {row.letter_slot && lettersShown ? (
                      <span className="grid-slot"> {row.letter_slot}</span>
                    ) : null}
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
                          <StackedCellFigures
                            cell={cell}
                            figures={shownFigures}
                            digits={digits}
                            weighted={weighted}
                            isProjection={isProjection}
                            statistics={cellStatistics}
                          />
                        </td>
                      );
                    }
                    const cellKey = `${row.id}:${column.id}`;
                    const shownForRow =
                      row.kind === 'mean' ||
                      row.kind === 'sd' ||
                      /^mean$/i.test(String(row.label || ''))
                        ? (['mean'] as CellFigure[])
                        : shownFigures;
                    const selected = selectionFromCell(book, row, cell, letter);
                    const trace = numberTraceFromCell(book, row, column, cell, letter, {
                      digits,
                      figure:
                        shownForRow[0] === 'mean'
                          ? 'mean'
                          : shownForRow[0] === 'count'
                            ? 'count'
                            : 'percent',
                      columnLabels,
                    });
                    return (
                      <td key={column.id}>
                        <Popover
                          open={picked === cellKey}
                          onOpenChange={open => {
                            if (open) setPicked(cellKey);
                            else if (picked === cellKey) setPicked('');
                          }}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              className="flow-cell"
                              type="button"
                              data-active={picked === cellKey}
                            >
                              <StackedCellFigures
                                cell={cell}
                                figures={shownForRow}
                                digits={digits}
                                weighted={weighted}
                                isProjection={isProjection}
                                statistics={cellStatistics}
                                letter={letter || undefined}
                              />
                              {markLowBase && cell?.low_base ? ' *' : ''}
                              {arrowsShown && !letter
                                ? (() => {
                                    const arrow = arrowForCell(book, row.id, column.id);
                                    return arrow ? (
                                      <span className="grid-arrow">{arrow}</span>
                                    ) : null;
                                  })()
                                : null}
                            </Button>
                          </PopoverTrigger>
                          {trace ? (
                            <PopoverContent
                              align="start"
                              sideOffset={8}
                              className="number-trace-popover"
                            >
                              <NumberTracePopover
                                trace={trace}
                                onShowRespondents={
                                  selected
                                    ? () => {
                                        setPicked('');
                                        onSelectCell(selected);
                                      }
                                    : undefined
                                }
                                onComment={
                                  selected && onCommentCell
                                    ? () => {
                                        setPicked('');
                                        onCommentCell(selected);
                                      }
                                    : undefined
                                }
                              />
                            </PopoverContent>
                          ) : null}
                        </Popover>
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
      {bannerFootnote(book, significance) ? (
        <p className="flow-muted">{bannerFootnote(book, significance)}</p>
      ) : null}
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
  variable,
}: {
  datasetId?: string;
  projectId?: string;
  variable?: { label: string; rows: { label: string; count: number }[]; total: number };
}) {
  const cell = useSurveyCell();
  const [quotes, setQuotes] = useState<Record<string, unknown> | null>(null);
  const [quotePhase, setQuotePhase] = useState<'idle' | 'loading' | 'ready'>('idle');
  const [error, setError] = useState('');
  const [syntaxNote, setSyntaxNote] = useState('');
  useEffect(() => {
    setSyntaxNote('');
    if (!datasetId || !cell?.textColumn) {
      setQuotes(null);
      setQuotePhase('idle');
      setEvidenceRespondents([]);
      return;
    }
    setError('');
    setQuotes(null);
    setQuotePhase('loading');
    setEvidenceRespondents([]);
    const controller = new AbortController();
    const load = async () => {
      let bitset = cell.bitset || '';
      if (!bitset && cell.runId && cell.stubRowId && cell.bannerId) {
        try {
          const restored = await flowJson<{
            provenance?: { row_uid_bitset?: string };
          }>(
            `/datasets/analysis-runs/${encodeURIComponent(cell.runId)}/cell-provenance` +
              `?stub_row_id=${encodeURIComponent(cell.stubRowId)}` +
              `&banner_id=${encodeURIComponent(cell.bannerId)}`,
            { signal: controller.signal }
          );
          bitset = String(restored.provenance?.row_uid_bitset || '');
        } catch (err) {
          if (controller.signal.aborted) return;
          setQuotes(null);
          setQuotePhase('idle');
          setError(
            err instanceof Error
              ? err.message
              : 'This cell has no respondent bitset, so the verbatims cannot be listed.'
          );
          return;
        }
      }
      if (!bitset) {
        setQuotes(null);
        setQuotePhase('idle');
        setEvidenceRespondents([]);
        setError('This cell has no respondent bitset, so the verbatims cannot be listed.');
        return;
      }
      try {
        const page = await flowJson<Record<string, unknown>>(`/datasets/${datasetId}/quotes`, {
          method: 'POST',
          body: JSON.stringify({
            text_column: cell.textColumn,
            row_uid_bitset: bitset,
            page: 1,
            page_size: 20,
          }),
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setQuotes(page);
        setQuotePhase('ready');
        const rows = (page.quotes as { respondent_id?: string; row_uid?: string }[]) || [];
        setEvidenceRespondents(
          rows
            .flatMap(row => [row.row_uid, row.respondent_id])
            .map(value => String(value || ''))
            .filter(Boolean)
        );
      } catch (err) {
        if (controller.signal.aborted) return;
        setQuotes(null);
        setQuotePhase('idle');
        setError(err instanceof Error ? err.message : 'Could not load verbatims');
      }
    };
    void load();
    return () => controller.abort();
  }, [datasetId, cell]);
  if (!cell && variable && variable.rows.length) {
    const total = variable.total || 1;
    return (
      <div className="evidence">
        <div className="evidence-lead">
          <p className="flow-muted">{variable.label}</p>
        </div>
        <div className="evidence-said">
          {variable.rows.map((row, index) => (
            <article key={`${row.label}-${index}`}>
              <p>{row.label || 'Blank'}</p>
              <p>
                {row.count.toLocaleString('en-GB')} · {Math.round((row.count / total) * 100)}%
              </p>
            </article>
          ))}
        </div>
      </div>
    );
  }
  if (!cell) {
    return (
      <div className="evidence">
        <Empty className="min-h-[280px] border-0 bg-transparent">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Quote />
            </EmptyMedia>
            <EmptyTitle className="text-sm">No cell selected</EmptyTitle>
            <EmptyDescription>
              Select a cell in Themes or Tables to open its verbatims.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
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
  linked_set?: string;
  n_unique?: number | null;
  n_rows?: number | null;
};

export { TABLE_TEXT_CATEGORY_MAX, isTableTextCategorical } from '@/lib/flow-columns';

/** A weight column by role, name, or label. The weight menu lists these; stub/banner do not. */
export function isTableWeightColumn(
  column: { name: string; label?: string; role?: string },
  weights: string[] = []
): boolean {
  if (String(column.role || '').toLowerCase() === 'weight') return true;
  if (weights.some(name => name.toLowerCase() === column.name.toLowerCase())) return true;
  const name = column.name.trim().toLowerCase();
  if (
    name.includes('weight') ||
    name === 'wt' ||
    name === 'wgt' ||
    name === 'wght' ||
    name.endsWith('_wt')
  ) {
    return true;
  }
  return /\bweight\b/i.test(String(column.label || ''));
}

/** Stub and banner choices. Ids, open text, and weight columns are not questions. */
export function tablePickerColumns(columns: TableColumn[], weights: string[] = []): TableColumn[] {
  return columns.filter(column => {
    if (!column.name || isInternalColumn(column.name)) return false;
    if (isIdColumn(column.name) || isIdColumn(String(column.label || ''))) return false;
    if (isAdminField(column.name, column.label)) return false;
    if (isOtherSpecifyField(column.name, column.label)) return false;
    if (column.linked_set) return false;
    if (isTableWeightColumn(column, weights)) return false;
    const labelled = Object.keys(column.labels || {}).length > 0;
    const type = String(column.type || '').toLowerCase();
    if (!labelled && (type === 'string' || type === 'text' || type === 'categorical')) {
      return isTableTextCategorical(column);
    }
    return true;
  });
}

/** Grid corner header: the question label, never the bare variable name when a label exists. */
export function stubHeaderLabel(
  stub: { label?: string; column?: string } | undefined,
  columns: { name: string; label: string }[]
): string {
  const column = String(stub?.column || '').trim();
  const own = String(stub?.label || '').trim();
  const meta = columns.find(item => item.name === column);
  const labelled = meta ? columnChoiceLabel(meta).trim() : '';
  if (labelled && labelled !== column) return labelled;
  if (own && own !== column) return own;
  return labelled || own || column;
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
  parked?: boolean;
  hidden?: boolean;
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

/** Sentinel in weight ChoiceSelects: opens WeightPanel instead of selecting a column. */
export const NEW_WEIGHT_OPTION = '__new_weight__';

/** Append "New weight…" so Tables and Responses can open the weighting screen. */
export function appendNewWeightOption(
  options: { value: string; label: string }[]
): { value: string; label: string }[] {
  return [...options, { value: NEW_WEIGHT_OPTION, label: 'New weight…' }];
}

/** True when the select chose "New weight…". */
export function isNewWeightChoice(value: string): boolean {
  return value === NEW_WEIGHT_OPTION;
}

/** The question. A category such as Midlands is not the question's name. */
export function columnChoiceLabel(column: { name: string; label: string }): string {
  const label = column.label.trim();
  return label || column.name;
}

function bannerNames(spec: { banners?: { column?: string; columns?: string[] }[] } | undefined) {
  return tableBannerKeys(bannerRefsFromSpec(spec));
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
    const body = (item.request_body || args.request_body || {}) as Record<string, unknown>;
    if (kind === 'frequencies') {
      const named = [
        ...(Array.isArray(body.columns) ? body.columns : []),
        ...(body.column ? [body.column] : []),
      ]
        .map(column => String(column || '').trim())
        .filter(Boolean);
      const columns = [...new Set(named)];
      if (!columns.length) continue;
      const filters = Array.isArray(body.row_filters) ? body.row_filters : [];
      const weight =
        typeof body.weight_column === 'string'
          ? body.weight_column
          : typeof body.weight === 'string'
            ? body.weight
            : '';
      return {
        stubs: columns.map(column => ({ column })),
        banner: [],
        statistics: ['column_proportion'],
        significance_display: 'none',
        nest_banners: false,
        ...(body.filter_ref
          ? { filter_ref: body.filter_ref }
          : filters.length
            ? { filter_ref: { filters, combine: 'and' } }
            : {}),
        ...(weight ? { weight } : {}),
        save: true,
      };
    }
    if (kind !== 'banner_table') continue;
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
  ready = false,
}: {
  datasetId?: string;
  projectId?: string;
  ready?: boolean;
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
  const [tidyOpen, setTidyOpen] = useState(false);
  const [tabSpecOpen, setTabSpecOpen] = useState(false);
  const [customNets, setCustomNets] = useState<{ label: string; values: string[] }[]>([]);
  const [netOpen, setNetOpen] = useState(false);
  const [netOptions, setNetOptions] = useState<string[]>([]);
  const [netPicked, setNetPicked] = useState<string[]>([]);
  const [netLabel, setNetLabel] = useState('');
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
  useEffect(() => {
    const saved = loadProjectSignificance(projectId);
    if (saved) setSignificance(saved);
  }, [projectId]);

  function applySignificance(next: TableSignificanceSettings) {
    setSignificance(next);
    if (next.asProjectDefault && projectId) {
      saveProjectSignificance(projectId, next);
      return;
    }
    if (!next.asProjectDefault && projectId) clearProjectSignificance(projectId);
  }
  const [columns, setColumns] = useState<TableColumn[]>([]);
  const [variableSets, setVariableSets] = useState<OutlineSetWithStructure[]>([]);
  const [weightColumns, setWeightColumns] = useState<string[]>([]);
  const [weightNeedsRefresh, setWeightNeedsRefresh] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [specs, setSpecs] = useState<SavedSpec[]>([]);
  const [books, setBooks] = useState<SavedBook[]>([]);
  const [stub, setStub] = useState(initialStub);
  const [banners, setBanners] = useState<TableBannerRef[]>(
    initialBanner ? [{ kind: 'column', column: initialBanner }] : []
  );
  const [audiences, setAudiences] = useState<SavedAudience[]>([]);
  const [weight, setWeight] = useState('');
  const activeWeightName = useRef('');
  const [statistics, setStatistics] = useState<string[]>(['column_proportion']);
  const [summaryColumns, setSummaryColumns] = useState<SummaryColumnKind[]>([]);
  const [cellStatsOpen, setCellStatsOpen] = useState(false);
  const [selectedSpecIds, setSelectedSpecIds] = useState<string[]>([]);
  const [batchBusy, setBatchBusy] = useState(false);
  const [digits, setDigits] = useState(0);
  const [significance, setSignificance] = useState<TableSignificanceSettings>(() => {
    const saved = loadProjectSignificance(projectId);
    return saved || { ...DEFAULT_TABLE_SIGNIFICANCE };
  });
  const [sigPanelOpen, setSigPanelOpen] = useState(false);
  const [nest, setNest] = useState(false);
  const [lowBase, setLowBase] = useState(true);
  const [top2, setTop2] = useState(false);
  const [bottom2, setBottom2] = useState(false);
  const [meanOn, setMeanOn] = useState(false);
  const [book, setBook] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [railReady, setRailReady] = useState(false);
  const [opening, setOpening] = useState(false);
  const [view, setView] = useState<'table' | 'chart'>('table');
  const [summaryBusy, setSummaryBusy] = useState(false);
  const loadingSaved = useRef(false);
  const weightFromTable = useRef(false);
  const bookRef = useRef<Record<string, unknown> | null>(null);
  const fileIdsRef = useRef<string[]>([]);
  fileIdsRef.current = (files || []).map(file => file.id);

  useEffect(() => {
    if (!datasetId) {
      setRailReady(ready);
      if (ready) setSpecs([]);
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
    // Banner books are not needed to paint the rail or open the first table.
    void flowJson<{ books?: SavedBook[] }>(`/datasets/${datasetId}/banner-books`)
      .then(bookPage => {
        if (live) setBooks(bookPage.books || []);
      })
      .catch(() => {
        if (live) setBooks([]);
      });
    void Promise.all([
      firstPage,
      // The open file's list comes from the open_first call; the project list reads only this project's files.
      loadProjectTables(projectId, datasetId, {
        fileIds: fileIdsRef.current,
        filePage: pendingOpen ? undefined : firstPage,
      }),
    ]).then(async ([specPage, projectTables]) => {
      if (!live) return;
      const saved: SavedSpec[] = projectTables.map(table => ({
        spec_id: table.id,
        label: table.label,
        dataset_id: table.datasetId,
        filename: table.filename,
        number: table.number,
        stale: table.stale,
        detail: table.detail,
        parked: table.parked,
        hidden: table.hidden,
      }));
      setSpecs(saved);
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
        linked_set?: string | null;
        value_labels?: Record<string, string>;
        n_unique?: number | null;
        n_rows?: number | null;
      }[];
      variable_sets?: OutlineSetWithStructure[] | null;
      multiple_response_sets?: OutlineSetWithStructure[] | null;
      active_weight_column?: string | null;
      weight_columns?: string[];
      weight_vector?: { needs_refresh?: boolean } | null;
    }>(`/datasets/${datasetId}/metadata`)
      .then(meta => {
        const choices = tableWeightChoices(meta.weight_columns, meta.active_weight_column || '');
        const active = meta.active_weight_column || '';
        activeWeightName.current = active;
        setWeightColumns(choices);
        // A saved table's weight wins. The file weight is only the default before one is open.
        // When the table opened before metadata arrived, resolve _weight / active again.
        const chosen = defaultTableWeight(active, choices);
        setWeight(current => {
          if (weightFromTable.current) {
            const opened = bookRef.current;
            const bookWeight = opened?.weight as
              | { column?: string | null; weight_aware?: boolean }
              | null
              | undefined;
            const saved = (opened?.spec as { weight?: unknown } | undefined)?.weight;
            const fromBook = selectedTableWeight(saved, bookWeight, active);
            if (fromBook) return fromBook;
            return current;
          }
          return current || chosen;
        });
        setWeightNeedsRefresh(Boolean(meta.weight_vector?.needs_refresh));
        const sets = Array.isArray(meta.variable_sets)
          ? meta.variable_sets
          : Array.isArray(meta.multiple_response_sets)
            ? meta.multiple_response_sets
            : [];
        setVariableSets(sets.filter(item => item && typeof item === 'object'));
        setColumns(
          (meta.columns || [])
            .map(column => ({
              name: column.name || '',
              label: column.label || column.name || '',
              labels: column.value_labels || {},
              type: column.type,
              role: column.role || undefined,
              linked_set: column.linked_set || undefined,
              n_unique: column.n_unique ?? null,
              n_rows: column.n_rows ?? null,
            }))
            .filter(column => column.name)
        );
      })
      .catch(() => {
        setColumns([]);
        setVariableSets([]);
      });
    void flowJson<{ audiences?: SavedAudience[] }>(`/datasets/${datasetId}/audiences`)
      .then(page => {
        if (!live) return;
        setAudiences(Array.isArray(page.audiences) ? page.audiences : []);
      })
      .catch(() => {
        if (live) setAudiences([]);
      });
    return () => {
      live = false;
    };
    // ready only gates the empty-state path above; refetching on ready flip duplicated /tables.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasetId]);

  const pickerColumnsMeta: FlowColumn[] = columns.map(column => ({
    name: column.name,
    label: column.label,
    type: column.type,
    role: column.role,
    linked_set: column.linked_set,
    value_labels: column.labels,
    n_unique: column.n_unique,
    n_rows: column.n_rows,
  }));
  const outlineQuestions: OutlineQuestion[] = questionnaireOutline(
    pickerColumnsMeta,
    variableSets,
    { weightName: weightColumns.find(name => Boolean(name)) || '' }
  );
  const stubOptions = tableStubPickerOptions(pickerColumnsMeta, variableSets, weightColumns);
  const labelFor = (name: string) => {
    const fromSet = stubOptions.find(item => item.value === name);
    if (fromSet) return fromSet.label;
    const set = variableSets.find(
      item =>
        String(item.name || '') === name ||
        String(item.label || '') === name ||
        String(item.id || '') === name
    );
    if (set) return String(set.label || set.name || name);
    const column = columns.find(item => item.name === name);
    return column ? columnChoiceLabel(column) : name;
  };
  /** Stub payload: set names the API knows, else expand multi members client-side. */
  const stubsForRun = (column: string, nets: { label: string; values: string[] }[]) => {
    const knownSet = variableSets.some(
      item =>
        String(item.name || '') === column ||
        String(item.label || '') === column ||
        String(item.id || '') === column
    );
    if (knownSet) return [{ ...codedStub(column), nets }];
    const unit = outlineQuestions.find(
      item => item.stubValue === column || item.key === column || item.columns[0] === column
    );
    if (unit && unit.columns.length > 1 && (unit.kind === 'multi' || unit.kind === 'grid')) {
      return unit.columns.map((name, index) => ({
        column: name,
        ...(index === 0 && nets.length ? { nets } : {}),
      }));
    }
    return [{ ...codedStub(column), nets }];
  };
  const questionText = (name: string) => {
    const fromSet = stubOptions.find(item => item.value === name);
    if (fromSet) return fromSet.label;
    const label = columns.find(column => column.name === name)?.label;
    return label && label !== name ? label : name;
  };
  const figures = figuresForStatistics(shownStatistics(statistics, meanOn));

  function toggleStatistic(value: string) {
    setStatistics(current => {
      if (current.includes(value)) {
        const next = current.filter(item => item !== value);
        return next.length ? next : current;
      }
      return [...current, value];
    });
  }

  function openCell(cell: SurveyCell) {
    setSurveyCell(cell);
    if (projectId) router.push(`/flow/p/${projectId}/responses`);
  }

  function remember(body: Record<string, unknown>) {
    loadingSaved.current = true;
    bookRef.current = body;
    setBook(body);
    const spec = body.spec as
      | {
          id?: string;
          label?: string;
          nest_banners?: boolean;
          decimals?: Record<string, number>;
          statistics?: string[];
          significance_display?: string;
          significance_alpha?: number;
          multiple_comparison?: string;
          comparison_type?: string;
          means_post_hoc?: string;
          post_hoc_control?: string;
          filter?: { filters?: { column: string; op: string; value: string | string[] }[] } | null;
          stubs?: { column?: string; nets?: { label?: string; values?: unknown[] }[] }[];
          banners?: {
            column?: string;
            columns?: string[];
            nested?: unknown;
            filter?: { combine?: string; filters?: unknown[] };
            audience?: string;
            label?: string;
          }[];
          weight?: { column?: string } | string | null;
        }
      | undefined;
    if (spec) {
      setSignificance(current =>
        settingsFromSpec(spec as Record<string, unknown>, {
          ...current,
          asProjectDefault: current.asProjectDefault,
        })
      );
    }
    const stubColumn = spec?.stubs?.[0]?.column;
    if (stubColumn) setStub(String(stubColumn));
    const storedNets = spec?.stubs?.[0]?.nets || [];
    setCustomNets(userNets(storedNets));
    setTop2(storedNets.some(net => /^top 2 box$/i.test(String(net.label || ''))));
    setBottom2(storedNets.some(net => /^bottom 2 box$/i.test(String(net.label || ''))));
    const refs = bannerRefsFromSpec(spec);
    if (refs.length) setBanners(refs);
    setNest(Boolean(spec?.nest_banners));
    const savedStats = Array.isArray(spec?.statistics)
      ? spec.statistics.map(String).filter(kind => kind && kind !== 'column_mean')
      : [];
    if (savedStats.length) setStatistics(savedStats);
    setMeanOn(Array.isArray(spec?.statistics) && spec.statistics.includes('column_mean'));
    const savedSummaries = (
      (spec as { summary_columns?: string[] } | undefined)?.summary_columns || []
    )
      .map(String)
      .filter((kind): kind is SummaryColumnKind => kind === 'average' || kind === 'total');
    setSummaryColumns(savedSummaries);
    const decimals = spec?.decimals;
    if (decimals && typeof decimals === 'object') {
      const first = Object.values(decimals).find(value => typeof value === 'number');
      if (typeof first === 'number') setDigits(first);
    }
    const savedFilters = spec?.filter?.filters;
    if (Array.isArray(savedFilters)) setTableFilter({ filters: savedFilters });
    const savedWeight = spec?.weight;
    const bookWeight = body.weight as
      | { column?: string | null; weight_aware?: boolean }
      | null
      | undefined;
    if (savedWeight != null || (bookWeight && typeof bookWeight === 'object')) {
      weightFromTable.current = true;
      setWeight(selectedTableWeight(savedWeight, bookWeight, activeWeightName.current));
    }
    const id = String(spec?.id || '');
    if (id) {
      const assigned = Number(body.table_number);
      const stubMeta = ((body.stubs as { label?: string; column?: string }[]) || [])[0];
      const listed = stubHeaderLabel(stubMeta, columns);
      setSpecs(current =>
        current.some(item => (item.spec_id || item.id) === id)
          ? current.map(item =>
              (item.spec_id || item.id) === id && listed && listed !== stubColumn
                ? { ...item, label: listed }
                : item
            )
          : [
              {
                spec_id: id,
                label: listed || spec?.label || stubColumn || stub,
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

  /** Paper 5d: apply cell stats (and optional summaries) to this table or every saved table. */
  function applyCellStats(next: {
    statistics: string[];
    summaryColumns: SummaryColumnKind[];
    scope: 'this' | 'all';
  }) {
    setStatistics(next.statistics.filter(kind => kind !== 'column_mean'));
    setMeanOn(next.statistics.includes('column_mean') || meanOn);
    setSummaryColumns(next.summaryColumns);
    if (next.scope === 'this') {
      setDirty(true);
      return;
    }
    const targets =
      selectedSpecIds.length >= 2
        ? selectedSpecIds
        : activeSpecs.map(spec => String(spec.spec_id || spec.id || '')).filter(Boolean);
    void batchPatchSelected({
      statistics: tableStatisticsForWeight(
        next.statistics,
        Boolean(weight),
        bookIsProjection(book)
      ),
      summary_columns: next.summaryColumns,
      ...(targets.length ? { onlyIds: targets } : {}),
    });
  }

  /** Re-save several tables with shared weight / filter / banner / cell stats. */
  async function batchPatchSelected(patch: {
    weight?: string;
    filter_ref?: { filters: { column: string; op: string; value: string | string[] }[] } | null;
    banner?: ReturnType<typeof bannerRequestItems>;
    statistics?: string[];
    summary_columns?: SummaryColumnKind[];
    onlyIds?: string[];
  }) {
    if (!datasetId) return;
    const ids = patch.onlyIds?.length ? patch.onlyIds : selectedSpecIds;
    if (ids.length < 1) return;
    setBatchBusy(true);
    setError('');
    try {
      for (const id of ids) {
        const listed = activeSpecs.find(spec => (spec.spec_id || spec.id) === id);
        const fileId = String(listed?.dataset_id || datasetId);
        const existing = await flowJson<Record<string, unknown>>(
          `/datasets/${fileId}/tables/${encodeURIComponent(id)}`
        ).catch(() => null);
        const spec = (existing?.spec || {}) as {
          stubs?: { column?: string; nets?: { label: string; values: string[] }[] }[];
          banners?: unknown[];
          statistics?: string[];
          nest_banners?: boolean;
          decimals?: Record<string, number>;
          weight?: { column?: string } | string | null;
          filter?: { filters?: { column: string; op: string; value: string | string[] }[] } | null;
          summary_columns?: string[];
        };
        const stubColumn = String(spec.stubs?.[0]?.column || stub || '');
        if (!stubColumn) continue;
        const bodyWeight =
          patch.weight !== undefined
            ? patch.weight
            : storedWeightColumn(spec.weight) || weight || 'none';
        await flowJson(`/datasets/${fileId}/tables`, {
          method: 'POST',
          body: JSON.stringify({
            stubs: spec.stubs?.length ? spec.stubs : stubsForRun(stubColumn, []),
            banner:
              patch.banner ||
              bannerRequestItems(bannerRefsFromSpec({ banners: spec.banners as never })),
            statistics:
              patch.statistics ||
              tableStatisticsForWeight(
                shownStatistics(spec.statistics || statistics, meanOn),
                Boolean(bodyWeight && bodyWeight !== 'none'),
                bookIsProjection(existing)
              ),
            ...significanceRequestFields(significance),
            nest_banners: Boolean(spec.nest_banners),
            low_base_threshold: lowBase ? 30 : 0,
            suppress_low_base: false,
            decimals: spec.decimals || shownDecimals(statistics, digits, meanOn),
            weight: bodyWeight || 'none',
            ...(patch.summary_columns?.length || spec.summary_columns?.length
              ? {
                  summary_columns:
                    patch.summary_columns ||
                    (spec.summary_columns || []).filter(
                      (kind): kind is SummaryColumnKind => kind === 'average' || kind === 'total'
                    ),
                }
              : {}),
            spec_id: id,
            ...(patch.filter_ref !== undefined
              ? patch.filter_ref?.filters?.length
                ? { filter_ref: patch.filter_ref }
                : {}
              : spec.filter?.filters?.length
                ? { filter_ref: { filters: spec.filter.filters } }
                : {}),
            save: true,
          }),
        });
      }
      setSelectedSpecIds([]);
      setNote('Saved a new version of each selected table.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the selected tables');
    } finally {
      setBatchBusy(false);
    }
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
    const selectedStats = tableStatisticsForWeight(
      shownStatistics(statistics, meanOn),
      Boolean(weight),
      bookIsProjection(book)
    );
    const openId = String((book?.spec as { id?: string } | undefined)?.id || '');
    void flowJson<Record<string, unknown>>(`/datasets/${datasetId}/tables`, {
      method: 'POST',
      body: JSON.stringify({
        stubs: stubsForRun(stub, nets),
        banner: bannerRequestItems(banners),
        statistics: selectedStats,
        ...significanceRequestFields(significance),
        nest_banners: nest,
        low_base_threshold: lowBase ? 30 : 0,
        suppress_low_base: false,
        decimals: shownDecimals(statistics, digits, meanOn),
        weight: weight || 'none',
        ...(summaryColumns.length ? { summary_columns: summaryColumns } : {}),
        ...(openId ? { spec_id: openId } : {}),
        ...(tableFilter?.filters.length ? { filter_ref: tableFilter } : {}),
        save,
      }),
    })
      .then(body => {
        if (token !== tableRequest.current) return;
        if (!save) {
          setBook(body);
          // Keep the left list label in sync when the stub changes on a preview.
          const previewId = String((body.spec as { id?: string } | undefined)?.id || '');
          const stubMeta = ((body.stubs as { label?: string; column?: string }[]) || [])[0];
          const listed = stubHeaderLabel(stubMeta, columns);
          if (previewId && listed) {
            setSpecs(current =>
              current.map(item =>
                (item.spec_id || item.id) === previewId ? { ...item, label: listed } : item
              )
            );
          }
          return;
        }
        setDirty(false);
        remember(body);
      })
      .catch(err => {
        if (token !== tableRequest.current) return;
        setError(err instanceof Error ? err.message : 'Could not save the table');
      });
  }

  const projectionFlag = bookIsProjection(book) ? '1' : '0';
  const optionsKey = [
    top2,
    bottom2,
    weight,
    statistics.join(','),
    summaryColumns.join(','),
    projectionFlag,
    digits,
    JSON.stringify(significanceRequestFields(significance)),
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
  const shapeKey = `${stub}|${tableBannerKeys(banners).join(',')}`;
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
      banners?: {
        column?: string;
        columns?: string[];
        filter?: { combine?: string; filters?: unknown[] };
        audience?: string;
        label?: string;
      }[];
    } | null;
    const id = String((book?.spec as { id?: string } | undefined)?.id || '');
    const listed = Boolean(id) && specs.some(item => (item.spec_id || item.id) === id);
    return savedTableMatches(
      listed,
      String(spec?.stubs?.[0]?.column || ''),
      bannerNames(spec || undefined),
      stub,
      tableBannerKeys(banners)
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
  const openSaved = specs.find(item => (item.spec_id || item.id) === specId);
  const selectedNumber = openSaved?.number && openSaved.number > 0 ? openSaved.number : undefined;
  const railLabel = (spec: SavedSpec) =>
    titledWithQuestions(
      spec.label || spec.name || '',
      columns.map(column => ({ name: column.name, label: columnChoiceLabel(column) }))
    );
  const activeSpecs = specs.filter(spec => !spec.parked);
  const parkedSpecs = specs.filter(spec => spec.parked);
  const firstRun = isTablesFirstRun({
    railReady,
    savedCount: activeSpecs.length,
    stub,
  });
  const agentPrompts = firstRun ? firstRunAgentPrompts(outlineQuestions, 3) : [];

  function reloadSpecs() {
    if (!datasetId) return;
    void loadProjectTables(projectId, datasetId, { fileIds: fileIdsRef.current }).then(
      projectTables => {
        setSpecs(
          projectTables.map(table => ({
            spec_id: table.id,
            label: table.label,
            dataset_id: table.datasetId,
            filename: table.filename,
            number: table.number,
            stale: table.stale,
            detail: table.detail,
            parked: table.parked,
            hidden: table.hidden,
          }))
        );
      }
    );
  }

  async function rebuildSavedTable(id: string): Promise<boolean> {
    if (!datasetId || !id) return false;
    try {
      const result = await flowJson<{
        ok?: boolean;
        blocked?: boolean;
        detail?: string;
        dataset_id?: string;
        weight_note?: string;
      }>(`/datasets/${datasetId}/tables/${id}/rebuild`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (result.blocked) {
        setError(result.detail || 'This file has a scale problem.');
        return false;
      }
      if (result.weight_note) setError(result.weight_note);
      else setError('');
      // Reload the rail from classify so siblings keep their live state; do not
      // invent stale flags client-side after one rebuild.
      reloadSpecs();
      const opened = await flowJson<Record<string, unknown>>(
        `/datasets/${result.dataset_id || datasetId}/tables/${id}`
      );
      remember(opened);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not rebuild');
      return false;
    }
  }

  function openSavedSpec(spec: SavedSpec) {
    const id = spec.spec_id || spec.id || '';
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
    if (spec.stale) {
      setOpening(true);
      void rebuildSavedTable(id).finally(() => setOpening(false));
      return;
    }
    void flowJson<Record<string, unknown>>(`/datasets/${datasetId}/tables/${id}`)
      .then(remember)
      .catch(err => {
        if (isTableSourceChanged(err)) {
          // Spec fingerprint drifted: rebuild on this file instead of asking the user.
          setOpening(true);
          void rebuildSavedTable(id).finally(() => setOpening(false));
          return;
        }
        setError(err instanceof Error ? err.message : 'Could not open that table');
      });
  }
  const title = book
    ? `${selectedNumber ? `T${selectedNumber} · ` : ''}${labelFor(stub)}${
        banners.length ? ` by ${banners.map(ref => bannerRefLabel(ref, labelFor)).join(', ')}` : ''
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
          <span>{railReady ? activeSpecs.length : ''}</span>
        </div>
        {!railReady ? (
          <div aria-busy="true">
            <Skeleton className="mb-2 h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : activeSpecs.length ? (
          activeSpecs.map(spec => {
            const id = spec.spec_id || spec.id || '';
            const multiSelected = selectedSpecIds.includes(id);
            return (
              <Button
                key={id}
                className="tables-saved"
                type="button"
                data-active={id === specId || multiSelected}
                data-batch={multiSelected ? 'true' : undefined}
                onClick={event => {
                  if (event.shiftKey) {
                    setSelectedSpecIds(current =>
                      current.includes(id) ? current.filter(item => item !== id) : [...current, id]
                    );
                    return;
                  }
                  setSelectedSpecIds([]);
                  openSavedSpec(spec);
                }}
              >
                <span>T{spec.number || ''}</span>
                <span className="tables-saved-copy">
                  <span>{railLabel(spec)}</span>
                  {spec.stale ? (
                    <span
                      className="flow-muted"
                      title={
                        spec.detail ||
                        'The file changed after this table was saved. Opening it re-runs the same stub and banners on the file in use.'
                      }
                    >
                      Needs rebuild · file changed
                    </span>
                  ) : spec.filename ? (
                    <span className="flow-muted">{spec.filename}</span>
                  ) : null}
                </span>
              </Button>
            );
          })
        ) : firstRun ? (
          <p className="tables-rail-hint">Tables you save show up here, one per question.</p>
        ) : (
          <p className="flow-muted">No saved tables yet</p>
        )}
        {selectedSpecIds.length >= 2 ? (
          <div className="tables-batch-bar" role="status">
            <p className="tables-batch-count">{selectedSpecIds.length} tables selected</p>
            <div className="tables-batch-actions">
              <Button
                type="button"
                className="tables-batch-chip"
                disabled={batchBusy || !weight}
                onClick={() => void batchPatchSelected({ weight: weight || 'none' })}
              >
                Weight
              </Button>
              <Button
                type="button"
                className="tables-batch-chip"
                disabled={batchBusy}
                onClick={() =>
                  void batchPatchSelected({
                    filter_ref: tableFilter?.filters.length ? tableFilter : null,
                  })
                }
              >
                Filter
              </Button>
              <Button
                type="button"
                className="tables-batch-chip"
                disabled={batchBusy}
                onClick={() => setCellStatsOpen(true)}
              >
                Cell stats
              </Button>
              <Button
                type="button"
                className="tables-batch-chip"
                disabled={batchBusy}
                onClick={() => void batchPatchSelected({ banner: bannerRequestItems(banners) })}
              >
                Banner
              </Button>
            </div>
            <p className="tables-batch-hint">
              Shift-click tables in the list to select. Each change saves a new version.
            </p>
          </div>
        ) : null}
        {parkedSpecs.length ? (
          <>
            <div className="tables-rail-head">
              <span>Parked</span>
              <span>{parkedSpecs.length}</span>
            </div>
            {parkedSpecs.map(spec => {
              const id = spec.spec_id || spec.id || '';
              return (
                <Button
                  key={`parked-${id}`}
                  className="tables-saved"
                  type="button"
                  data-active={id === specId}
                  data-parked="true"
                  onClick={() => openSavedSpec(spec)}
                >
                  <span>T{spec.number || ''}</span>
                  <span className="tables-saved-copy">
                    <span>{railLabel(spec)}</span>
                    {spec.filename ? <span className="flow-muted">{spec.filename}</span> : null}
                  </span>
                </Button>
              );
            })}
          </>
        ) : null}
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
          <p className="flow-muted">{firstRun ? 'None yet' : 'No banner books yet'}</p>
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
            {firstRun ? (
              <TablesFirstRun
                outline={outlineQuestions}
                columns={columns}
                questionCount={stubOptions.length}
                onPickQuestion={value => {
                  if (!value) return;
                  setStub(value);
                  setBanners(current =>
                    current.filter(item => !(item.kind === 'column' && item.column === value))
                  );
                }}
                selectedGroups={columnNamesFromBannerRefs(banners)}
                onPickGroup={value => {
                  if (!value || value === stub) return;
                  setBanners(current => {
                    const key = tableBannerKey({ kind: 'column', column: value });
                    if (current.some(item => tableBannerKey(item) === key)) {
                      return current.filter(item => tableBannerKey(item) !== key);
                    }
                    return [...current, { kind: 'column', column: value }];
                  });
                }}
                onAskAgent={() => {
                  const root = document.querySelector(
                    '.tables-agent textarea, .tables-agent [contenteditable="true"]'
                  );
                  if (root instanceof HTMLElement) root.focus();
                }}
                onTabSpec={() => setTabSpecOpen(true)}
                onSummaryTables={() => {
                  if (!datasetId || summaryBusy) return;
                  setSummaryBusy(true);
                  setError('');
                  void flowJson<{ n_tables?: number }>(
                    `/datasets/${datasetId}/data-checks/summary-tables`,
                    { method: 'POST', body: JSON.stringify({}) }
                  )
                    .then(result => {
                      const n = result.n_tables ?? 0;
                      setNote(
                        n === 1
                          ? 'Built 1 summary table.'
                          : `Built ${n.toLocaleString('en-GB')} summary tables.`
                      );
                      reloadSpecs();
                    })
                    .catch(err =>
                      setError(
                        err instanceof Error ? err.message : 'Could not build summary tables'
                      )
                    )
                    .finally(() => setSummaryBusy(false));
                }}
                summaryBusy={summaryBusy}
              />
            ) : null}
            {!firstRun ? (
              <div className="tables-tidy-bar">
                <Button
                  className="tables-tidy-trigger"
                  type="button"
                  disabled={!datasetId || !railReady}
                  onClick={() => setTabSpecOpen(true)}
                >
                  Build from a spec…
                </Button>
                <Button
                  className="tables-tidy-trigger"
                  type="button"
                  disabled={!datasetId || !railReady}
                  onClick={() => setTidyOpen(true)}
                >
                  Tidy tables…
                </Button>
              </div>
            ) : null}
            {!firstRun ? (
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
                    <span className="tables-chip-wrap accent">
                      <VariablePreviewTrigger
                        datasetId={datasetId}
                        projectId={projectId}
                        column={stub}
                        label={labelFor(stub)}
                        memberColumns={
                          variableSets.find(
                            item =>
                              String(item.name || '') === stub ||
                              String(item.label || '') === stub ||
                              String(item.id || '') === stub
                          )?.columns
                        }
                        fileName={
                          files.find(file => file.id === datasetId)?.name ||
                          datasets.find(row => (row.dataset_id || row.id) === datasetId)
                            ?.original_filename ||
                          ''
                        }
                      />
                      <Button
                        className="tables-chip-clear"
                        type="button"
                        aria-label={`Remove ${labelFor(stub)}`}
                        onClick={() => setStub('')}
                      >
                        ×
                      </Button>
                    </span>
                  ) : null}
                  <ChoiceSelect
                    className="flow-input"
                    aria-label="Table stub"
                    searchable
                    value=""
                    onValueChange={value => {
                      if (value) setStub(value);
                    }}
                    options={[
                      { value: '', label: '+ Drop variable' },
                      ...stubOptions
                        .filter(
                          item =>
                            !banners.some(
                              banner => banner.kind === 'column' && banner.column === item.value
                            )
                        )
                        .map(item => ({ value: item.value, label: item.label })),
                    ]}
                  />
                </div>
                <div className="tables-line">
                  <span>Banner</span>
                  {banners.map(ref => {
                    const key = tableBannerKey(ref);
                    const label = bannerRefLabel(ref, labelFor);
                    return (
                      <span key={key} className={bannerChipClass(ref)}>
                        {ref.kind === 'column' ? (
                          <VariablePreviewTrigger
                            datasetId={datasetId}
                            projectId={projectId}
                            column={ref.column}
                            label={label}
                            fileName={
                              files.find(file => file.id === datasetId)?.name ||
                              datasets.find(row => (row.dataset_id || row.id) === datasetId)
                                ?.original_filename ||
                              ''
                            }
                          />
                        ) : (
                          <span className="tables-chip-label">{label}</span>
                        )}
                        <Button
                          className="tables-chip-clear"
                          type="button"
                          aria-label={`Remove ${label}`}
                          onClick={() =>
                            setBanners(current =>
                              current.filter(item => tableBannerKey(item) !== key)
                            )
                          }
                        >
                          ×
                        </Button>
                      </span>
                    );
                  })}
                  <BannerAddPicker
                    audiences={audiences}
                    questions={stubOptions.map(item => ({
                      value: item.value,
                      label: item.label,
                    }))}
                    selected={banners}
                    stub={stub}
                    onPick={ref => {
                      const key = tableBannerKey(ref);
                      if (ref.kind === 'column' && ref.column === stub) return;
                      setBanners(current =>
                        current.some(item => tableBannerKey(item) === key)
                          ? current
                          : [...current, ref]
                      );
                    }}
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
                        data-active={statistics.includes(value)}
                        onClick={() => toggleStatistic(value)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                  <CellStatsPopover
                    open={cellStatsOpen}
                    onOpenChange={setCellStatsOpen}
                    statistics={shownStatistics(statistics, meanOn)}
                    isProjection={bookIsProjection(book)}
                    meanOn={meanOn}
                    summaryColumns={summaryColumns}
                    tableCount={
                      selectedSpecIds.length >= 2
                        ? selectedSpecIds.length
                        : Math.max(activeSpecs.length, 1)
                    }
                    preview={mediaCellLines(
                      (
                        ((book?.rows as BannerRow[] | undefined) || []).find(
                          row => row.kind === 'value' || !row.kind
                        )?.cells || []
                      ).find(cell => cell.banner_id === 'total') ||
                        (((book?.rows as BannerRow[] | undefined) || [])[0]?.cells || [])[0],
                      Math.max(digits, 0),
                      {
                        includeProjected:
                          bookIsProjection(book) &&
                          shownStatistics(statistics, meanOn).includes('projected_thousands'),
                        includeIndex: shownStatistics(statistics, meanOn).includes('index'),
                        includeUnweighted: shownStatistics(statistics, meanOn).includes(
                          'unweighted_base'
                        ),
                      }
                    )}
                    onApply={applyCellStats}
                    trigger={
                      <Button
                        className="flow-btn"
                        type="button"
                        data-active={cellStatsOpen}
                        aria-expanded={cellStatsOpen}
                      >
                        In each cell ▾
                      </Button>
                    }
                  />
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
                    data-active={sigPanelOpen || significance.showAs !== 'off'}
                    aria-expanded={sigPanelOpen}
                    onClick={() => setSigPanelOpen(current => !current)}
                  >
                    {significanceToolbarLabel(significance)} ▾
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
                    onValueChange={value => {
                      if (isNewWeightChoice(value)) {
                        setWeightRerake(false);
                        setWeightOpen(true);
                        return;
                      }
                      setWeight(value);
                    }}
                    options={appendNewWeightOption([
                      { value: '', label: 'Unweighted' },
                      ...weightColumns.map(name => {
                        const label = labelFor(name);
                        const shared = weightColumns.filter(other => labelFor(other) === label);
                        return {
                          value: name,
                          label:
                            shared.length > 1
                              ? `${label} · ${name}`
                              : weightOptionLabel(name, label),
                        };
                      }),
                    ])}
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
            ) : null}
            {error ? <p className="flow-error">{error}</p> : null}
            {note ? <p className="flow-muted">{note}</p> : null}
            {!firstRun ? (
              <>
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
                <div className="tables-main-body">
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
                          onClick={() =>
                            setView(current => (current === 'chart' ? 'table' : 'chart'))
                          }
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
                              setError(
                                err instanceof Error ? err.message : 'Could not export the table'
                              )
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
                            <p>
                              {openSaved.detail ||
                                'Rebuild means re-run this saved table on the file in use. The stub, banners and options stay the same; the numbers update.'}
                            </p>
                            <Button
                              className="flow-btn"
                              type="button"
                              onClick={() => {
                                if (!specId) return;
                                void rebuildSavedTable(specId);
                              }}
                            >
                              Rebuild now
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
                            title={title}
                            significanceNote={chartSignificanceNote(book)}
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
                                      support: bannerFootnote(book, significance),
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
                              ((book.rows as { kind?: string }[]) || []).some(
                                row => row.kind === 'net'
                              )
                            }
                            figures={figures}
                            statistics={tableStatisticsForWeight(
                              shownStatistics(statistics, meanOn),
                              Boolean(weight),
                              bookIsProjection(book)
                            )}
                            significance={significance}
                            digits={digits}
                            markLowBase={lowBase}
                            columnLabels={columns.map(column => ({
                              name: column.name,
                              label: columnChoiceLabel(column),
                            }))}
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
                </div>
                <div className="tables-foot">
                  <span>{totalBase}</span>
                  <span>{tableFootStatus(Boolean(specId) && matchesSaved(), dirty)}</span>
                </div>
              </>
            ) : null}
          </section>
          {/* Paper 9b: significance is the right column (360px). Hide the agent while it is open
              so the table is not squeezed between both panels. */}
          {sigPanelOpen ? (
            <TableSignificancePanel
              settings={significance}
              onChange={applySignificance}
              onClose={() => setSigPanelOpen(false)}
              controlOptions={columnNamesFromBannerRefs(banners).map(column => ({
                value: column,
                label: labelFor(column),
              }))}
            />
          ) : (
            <SidePanel id="tables-agent" defaultWidth={320} className="tables-agent">
              <div className="tables-agent-head">
                <span className="tables-dot" />
                <span>
                  {firstRun ? 'Ask the agent' : book ? title.replace(/^T\d+ · /, '') : 'Table'}
                </span>
              </div>
              <AgentThread
                projectId={projectId || ''}
                datasetId={datasetId}
                columnNames={columns.map(column => column.name)}
                columnLabels={columns.map(column => ({
                  name: column.name,
                  label: column.label,
                  value_labels: column.labels,
                }))}
                placeholder={
                  firstRun
                    ? 'Ask, or describe a table to build…'
                    : 'Ask, or tell it to change the table…'
                }
                projectHref={projectId ? `/flow/p/${projectId}` : '/flow'}
                emptyTitle={
                  firstRun
                    ? 'Not sure where to start?'
                    : selectedNumber
                      ? `Ask about T${selectedNumber}`
                      : 'Ask about this table'
                }
                emptyDescription={
                  firstRun
                    ? 'Tell the agent what you want to know and it builds the table for you.'
                    : 'Ask what moved, or tell it to change the table: add a banner, net the top two boxes, or weight it.'
                }
                emptySuggestions={agentPrompts}
                onFinished={result => {
                  const built = bookFromToolResults(result.tool_results);
                  const request = built
                    ? tableBodyFromAgentBook(built)
                    : tableBodyFromAgentRun(result.tool_results);
                  if (built) {
                    setBook(built);
                    setView('table');
                  }
                  if (request) void adoptAgentTable(request);
                }}
              />
            </SidePanel>
          )}
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
      <TidyTablesDialog
        datasetId={datasetId}
        open={tidyOpen}
        onOpenChange={setTidyOpen}
        onApplied={() => {
          setNote('Tables tidied.');
          reloadSpecs();
        }}
      />
      <TabSpecDialog
        datasetId={datasetId}
        open={tabSpecOpen}
        onOpenChange={setTabSpecOpen}
        onBuilt={result => {
          const n = result.n_built ?? 0;
          setNote(n === 1 ? 'Built 1 table from the spec.' : `Built ${n} tables from the spec.`);
          reloadSpecs();
        }}
      />
    </div>
  );
}

export async function downloadExport(path: string, filename: string, init?: RequestInit) {
  const response = await flowFetch(path, init);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(formatApiErrorMessage(new ApiRequestError(response.status, body)));
  }
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
