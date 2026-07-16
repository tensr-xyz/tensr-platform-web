import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  Header,
  SortingState,
  useReactTable,
  VisibilityState,
  OnChangeFn,
  type ColumnPinningState,
} from '@tanstack/react-table';
import {
  computeColumnHeatmapScale,
  heatmapBackgroundForValue,
  parseNumericCellValue,
} from '@/lib/column-heatmap';
import {
  EditableCell,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/molecules/table';
import { createColumns, CreateColumnsProps } from '@/components/templates/spreadsheet/columns';
import { HeaderComponent } from '@/components/templates/spreadsheet/header';
import { useSession, wsService } from '@/hooks/ui/use-session';
import { cn } from '@/utils';
import { useTabsStore } from '@/stores/tabs-store';
import { ColumnSummary } from '@/types/file';
import Filters from '@/components/templates/spreadsheet/filters';
import {
  CellPosition,
  CellRange,
  SelectionMode,
  SortConfig,
  SpreadsheetProps,
} from '@/types/spreadsheet';
import { handleKeyboardNavigation } from '@/utils/spreadsheet';
import { isCellInRange, getCellsInRange, rangeToNotation } from '@/utils/range-utils';
import _ from 'lodash';
import useAuth from '@/hooks/api/use-auth';
import { Column } from '@/stores/tabs-store';
import { resolveColumnIsNumeric } from '@/components/molecules/column-type-badge';
import { Input } from '@/components/atoms/input';
import { Button } from '@/components/atoms/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from '@/components/molecules/context-menu';
import { apiClient } from '@/lib/api-client';
import { useClipboardStore, ClipboardData } from '@/stores/clipboard-store';
import { Copy, Scissors, Clipboard, Trash2 } from 'lucide-react';
import { RowFixModal, RowFixIssue } from '@/components/molecules/row-fix-modal';
import { TransformationModal, Transformation } from '@/components/molecules/transformation-modal';
import { CategoryCleaner, CategoryMapping } from '@/components/molecules/category-cleaner';
import { FillHandle } from '@/components/molecules/fill-handle';
import { useSheetState } from '@/hooks/ui/use-sheet-state';
import { getTensrApiBaseUrl, tensrApiUrl } from '@/lib/tensr-api-url';
import { handleUnauthorizedResponse } from '@/lib/session-expired';
import { getDatasetIdFromPath } from '@/lib/workspace-dataset';
import { useProjectStore } from '@/stores/project-store';
import Loading from '@/components/molecules/loading';
import { applyClientColumnFilters } from '@/utils/column-filters';
import { toast } from '@/hooks/ui/use-toast';
import {
  fetchDatasetColumnMetadata,
  patchColumnMetadata,
  type ColumnMetadataMap,
} from '@/lib/dataset-metadata';
import type { MeasurementLevel } from '@/lib/measurement-level';
import { useAnalysisSetupStore } from '@/stores/analysis-setup-store';
import { recordTabSnapshot } from '@/lib/tab-history';
import { SPREADSHEET_EVENTS, type TabColumnFilterPayload } from '@/lib/spreadsheet-commands';

const INITIAL_EMPTY_ROWS = 200;
const ROWS_PER_BATCH = 250;
const EXTRA_COLUMNS = 10;
const DEFAULT_COLUMN_WIDTH = 150;
const ROW_HEIGHT_PX = 36;
const SCROLL_PERCENTAGE_THRESHOLD = 0.7;
const PREFETCH_THRESHOLD = 0.3;
const INITIAL_PREFETCH_DELAY = 50;
/** Rows to load beyond the last visible virtual row (fast scroll buffer). */
const LOAD_AHEAD_ROWS = 180;
/** Datasets at or below this size load entirely (one preview fetch for UUID datasets). */
const SMALL_DATASET_EAGER_LOAD = 2500;
/** Extra rows rendered above/below viewport — more while paginating to reduce blank flashes. */
const VIRTUAL_OVERSCAN_LOADED = 40;
const VIRTUAL_OVERSCAN_LOADING = 80;

function rowsFromColumnMajorPage(
  processedData: unknown[][],
  columns: Column[],
  startRow: number
): RowType[] {
  if (!processedData[0]) return [];
  return processedData[0].map((_: unknown, rowIndex: number) => {
    const row: RowType = { id: `row-${startRow + rowIndex}` };
    columns.forEach((col, colIndex) => {
      if (col.id) {
        row[col.id] = processedData[colIndex][rowIndex];
      }
    });
    return row;
  });
}

function formatCellDisplayValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

/** Merge a fetched page without duplicating rows when hydrate and pagination race. */
function mergeRowPage(
  prev: RowType[],
  startRow: number,
  newRows: RowType[],
  totalRows: number
): RowType[] {
  if (newRows.length === 0 || totalRows <= 0) return prev.slice(0, totalRows);
  if (startRow >= totalRows) return prev.slice(0, totalRows);
  const merged =
    startRow >= prev.length ? [...prev, ...newRows] : [...prev.slice(0, startRow), ...newRows];
  return merged.slice(0, totalRows);
}

type RowType = Record<string, any> & { id: string };

/** Empty grid row for virtual slots not yet loaded from the server. */
function VirtualSheetPlaceholderRow({
  rowIndex,
  translateY,
  columns,
  rowHeightPx,
}: {
  rowIndex: number;
  translateY: number;
  columns: { id: string; getSize: () => number }[];
  rowHeightPx: number;
}) {
  return (
    <TableRow
      data-index={rowIndex}
      aria-busy="true"
      className="!border-b-0"
      style={{
        height: `${rowHeightPx}px`,
        transform: `translateY(${translateY}px)`,
        display: 'flex',
        width: '100%',
        minWidth: '100%',
        borderBottom: 'none',
        boxSizing: 'border-box',
        backgroundColor: 'var(--background)',
      }}
    >
      {columns.map(column => {
        const width = column.getSize() || DEFAULT_COLUMN_WIDTH;
        return (
          <TableCell
            key={column.id}
            style={{
              width,
              minWidth: width,
              flexShrink: 0,
              height: rowHeightPx,
              padding: 0,
              boxSizing: 'border-box',
              borderRight: '1px solid var(--border)',
              borderBottom: '1px solid var(--border)',
            }}
          />
        );
      })}
    </TableRow>
  );
}

type UuidDatasetGridCache = Map<
  string,
  { headers: string[]; variableNames: string[]; rows: unknown[][] }
>;

function compareSpreadsheetCellValues(av: unknown, bv: unknown, desc: boolean): number {
  if (av == null && bv == null) return 0;
  if (av == null) return desc ? 1 : -1;
  if (bv == null) return desc ? -1 : 1;
  if (typeof av === 'number' && typeof bv === 'number') {
    return desc ? bv - av : av - bv;
  }
  const an = Number(av);
  const bn = Number(bv);
  if (!Number.isNaN(an) && !Number.isNaN(bn) && av !== '' && bv !== '') {
    return desc ? bn - an : an - bn;
  }
  const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
  return desc ? -cmp : cmp;
}

function sortSpreadsheetRows<T extends Record<string, unknown>>(
  rows: T[],
  sortConfig: SortConfig[]
): T[] {
  if (sortConfig.length === 0) return rows;
  return [...rows].sort((a, b) => {
    for (const sort of sortConfig) {
      const cmp = compareSpreadsheetCellValues(a[sort.column], b[sort.column], sort.desc);
      if (cmp !== 0) return cmp;
    }
    return 0;
  });
}

function sortDatasetPreviewRows(
  rows: unknown[][],
  headers: string[],
  variableNames: string[],
  sortConfig: SortConfig[]
): unknown[][] {
  if (sortConfig.length === 0) return rows;
  const columnIndex = (columnId: string) => {
    const byVar = variableNames.indexOf(columnId);
    if (byVar >= 0) return byVar;
    return headers.indexOf(columnId);
  };

  return [...rows].sort((a, b) => {
    for (const sort of sortConfig) {
      const idx = columnIndex(sort.column);
      if (idx < 0) continue;
      const cmp = compareSpreadsheetCellValues(a[idx], b[idx], sort.desc);
      if (cmp !== 0) return cmp;
    }
    return 0;
  });
}

/** tensr-api dataset as grid: cache preview once, slice rows into fetch-page column-major `data`. */
async function fetchDatasetGridSliceForSpreadsheet(
  datasetId: string,
  token: string | null,
  startRow: number,
  endRow: number,
  cache: UuidDatasetGridCache,
  sortConfig?: SortConfig[]
): Promise<{ data: unknown[][] } | null> {
  if (!token) return null;
  const headers = { Authorization: `Bearer ${token}` };

  let entry = cache.get(datasetId);
  if (!entry) {
    const schemaRes = await fetch(tensrApiUrl(`/datasets/${datasetId}/schema`), { headers });
    if (!schemaRes.ok) return null;
    const previewRes = await fetch(tensrApiUrl(`/datasets/${datasetId}/preview?limit=5000`), {
      headers,
    });
    if (!previewRes.ok) return null;
    const preview = (await previewRes.json()) as {
      headers?: string[];
      variable_names?: string[];
      rows?: unknown[][];
    };
    entry = {
      headers: preview.headers || [],
      variableNames: preview.variable_names || preview.headers || [],
      rows: preview.rows || [],
    };
    cache.set(datasetId, entry);
  }

  const sortedRows = sortDatasetPreviewRows(
    entry.rows,
    entry.headers,
    entry.variableNames,
    sortConfig ?? []
  );
  const slice = sortedRows.slice(startRow, endRow);
  const processedData = entry.headers.map((_, colIdx) =>
    slice.map(row => (row as unknown[])[colIdx])
  );
  return { data: processedData };
}

// Memoized cell component to prevent unnecessary re-renders
const MemoizedTableCell = React.memo<{
  cell: any;
  rowIndex: number;
  columnId: string;
  cellKey: string;
  isCellFocused: boolean;
  isCellSelected: boolean;
  cellRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  handleCellEdit: (rowIndex: number, columnId: string, value: any) => void | Promise<void>;
  setFocusedCell: (position: { rowIndex: number; columnId: string }) => void;
  onMouseDown?: (e: React.MouseEvent, rowIndex: number, columnId: string) => void;
  onMouseEnter?: (e: React.MouseEvent, rowIndex: number, columnId: string) => void;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onDelete: () => void;
  clipboardHasData: boolean;
  onSelectRow?: (rowIndex: number) => void;
  onCellContextMenu?: (rowIndex: number, columnId: string) => void;
  isNumericColumn?: boolean;
  heatmapBackgroundColor?: string;
}>(
  ({
    cell,
    rowIndex,
    columnId,
    cellKey,
    isCellFocused,
    isCellSelected,
    cellRefs,
    handleCellEdit,
    setFocusedCell,
    onMouseDown,
    onMouseEnter,
    onCopy,
    onCut,
    onPaste,
    onDelete,
    clipboardHasData,
    onSelectRow,
    onCellContextMenu,
    isNumericColumn = false,
    heatmapBackgroundColor,
  }) => {
    // Memoize callbacks to prevent recreation on every render
    const onEdit = useCallback(
      (value: any) => {
        handleCellEdit(rowIndex, columnId, value);
      },
      [rowIndex, columnId, handleCellEdit]
    );

    const onFocus = useCallback(() => {
      setFocusedCell({ rowIndex, columnId });
    }, [rowIndex, columnId, setFocusedCell]);

    // Extract values once to avoid repeated calls during render
    const cellValue = cell.getValue();
    const columnSize = cell.column.getSize() || 150;
    const pinned = cell.column.getIsPinned();
    const hasHeatmap = !!heatmapBackgroundColor;
    const showCellHover = columnId !== 'select' && !isCellFocused;

    return (
      <TableCell
        data-row-index={rowIndex}
        data-column-id={columnId}
        ref={cellRef => {
          if (cellRef) {
            cellRefs.current.set(cellKey, cellRef);
          } else {
            cellRefs.current.delete(cellKey);
          }
        }}
        onContextMenu={() => {
          onCellContextMenu?.(rowIndex, columnId);
        }}
        onMouseDown={e => {
          if (columnId === 'select') {
            e.preventDefault();
            onSelectRow?.(rowIndex);
            return;
          }
          onMouseDown?.(e, rowIndex, columnId);
        }}
        onMouseEnter={e => {
          if (onMouseEnter && e.buttons === 1) {
            onMouseEnter(e, rowIndex, columnId);
          }
        }}
        className={cn(
          'border-r border-b border-border/70 last:border-r-0 text-[13px] tabular-nums transition-colors',
          columnId === 'select' && 'bg-muted/20 hover:bg-muted/50',
          isNumericColumn && columnId !== 'select' && 'justify-end',
          showCellHover && !hasHeatmap && 'hover:bg-muted/55',
          showCellHover &&
            hasHeatmap &&
            'relative hover:after:pointer-events-none hover:after:absolute hover:after:inset-0 hover:after:bg-muted/50 hover:after:content-[""]',
          isCellFocused &&
            'relative z-10 bg-background outline outline-2 outline-primary outline-offset-[-2px]',
          isCellSelected && !isCellFocused && 'bg-primary/5',
          isCellSelected && isCellFocused && 'bg-background'
        )}
        style={{
          width: columnSize,
          minWidth: columnSize,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          padding: 0,
          height: 36,
          boxSizing: 'border-box',
          backgroundColor: heatmapBackgroundColor,
          ...(pinned
            ? {
                position: 'sticky',
                left: cell.column.getStart(pinned as 'left'),
                zIndex: 1,
              }
            : {}),
        }}
      >
        {columnId === 'select' ? (
          flexRender(cell.column.columnDef.cell, cell.getContext())
        ) : isCellFocused ? (
          <EditableCell
            value={(cellValue as string | number | null) || ''}
            onEdit={onEdit}
            className={cn('h-9 w-full px-3.5', isNumericColumn && 'text-right font-mono')}
            isFocused
            onFocus={onFocus}
          />
        ) : (
          <div
            className={cn(
              'flex h-9 w-full min-w-0 items-center truncate px-3.5',
              isNumericColumn && 'justify-end font-mono'
            )}
          >
            {formatCellDisplayValue(cellValue)}
          </div>
        )}
      </TableCell>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison function - only re-render if these specific props change
    // This prevents all cells from re-rendering when any cell is edited
    const cellValueChanged = prevProps.cell.getValue() !== nextProps.cell.getValue();
    const focusChanged = prevProps.isCellFocused !== nextProps.isCellFocused;
    const selectionChanged = prevProps.isCellSelected !== nextProps.isCellSelected;
    const sizeChanged = prevProps.cell.column.getSize() !== nextProps.cell.column.getSize();
    const clipboardChanged = prevProps.clipboardHasData !== nextProps.clipboardHasData;
    const numericChanged = prevProps.isNumericColumn !== nextProps.isNumericColumn;
    const heatmapChanged = prevProps.heatmapBackgroundColor !== nextProps.heatmapBackgroundColor;

    // Only re-render if something actually changed for this specific cell
    // Return true means "props are equal, skip render", false means "props changed, render"
    // Note: onMouseDown and onMouseEnter are functions and may change on every render,
    // but they don't affect the visual appearance, so we ignore them in comparison
    return (
      !cellValueChanged &&
      !focusChanged &&
      !selectionChanged &&
      !sizeChanged &&
      !clipboardChanged &&
      !numericChanged &&
      !heatmapChanged
    );
  }
);

MemoizedTableCell.displayName = 'MemoizedTableCell';

export function Spreadsheet({
  initialData,
  initialColumns,
  showStats = false,
  filePath,
  totalRowCount,
  tabId,
  showFilters = false,
  onCloseFilters,
  onRequestShowFilters,
  onSelectionChange,
  onSheetStatusChange,
  onChange,
  columnStats,
  showMenu = true,
  tabData,
  onInsertRow,
  onDeleteRows,
}: SpreadsheetProps) {
  // Removed tokens - using getIdToken() directly
  const tableContainerRef = useRef<HTMLDivElement | null>(null);
  const waitingForDatasetRows = !!filePath && initialData.length === 0 && (totalRowCount ?? 0) > 0;
  const [isLoading, setIsLoading] = useState(() => waitingForDatasetRows);
  const loadingRef = useRef(false);
  /** Cached dataset preview when filePath is a dataset UUID (tensr-api has no /projects/:id). */
  const uuidDatasetGridCacheRef = useRef<UuidDatasetGridCache>(new Map());
  const lastLoadedRowRef = useRef(
    totalRowCount && initialData.length >= totalRowCount ? totalRowCount : initialData.length
  );
  /** Invalidate in-flight pagination when full hydrate replaces grid data. */
  const loadGenerationRef = useRef(0);
  /** Cached row count for pagination guards (avoids stale closure during async fetch). */
  const dataLengthRef = useRef(initialData.length);
  /** Catch-up target end row for the next fetch (set by virtualizer / ensureRowsLoaded). */
  const pendingLoadEndRef = useRef(0);
  const [localColumnStats, setLocalColumnStats] = useState<
    Record<string, ColumnSummary> | undefined
  >(undefined);
  const [focusedCell, setFocusedCell] = useState<CellPosition | null>(null);
  const [cellSelection, setCellSelection] = useState<CellRange | null>(null);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('single');
  const [selectionAnchor, setSelectionAnchor] = useState<CellPosition | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  /** Row/column captured on right-click — drives the single shared ContextMenu. */
  const [ctxMenuRowIndex, setCtxMenuRowIndex] = useState<number | null>(null);
  const [ctxMenuColumnId, setCtxMenuColumnId] = useState<string | null>(null);
  const [selectedRowData, setSelectedRowData] = useState<Record<string, any> | null>(null);
  const [highlightedRows, setHighlightedRows] = useState<Set<number>>(new Set());
  const [rowInsight, setRowInsight] = useState<any | null>(null);
  const [rowFixModalOpen, setRowFixModalOpen] = useState(false);
  const [rowFixIssues, setRowFixIssues] = useState<RowFixIssue[]>([]);
  const [rowFixSummary, setRowFixSummary] = useState<string>('');
  const [rowFixLoading, setRowFixLoading] = useState(false);
  const [currentRowIndexForFix, setCurrentRowIndexForFix] = useState<number | null>(null);
  const [transformationModalOpen, setTransformationModalOpen] = useState(false);
  const [transformations, setTransformations] = useState<Transformation[]>([]);
  const [transformationLoading, setTransformationLoading] = useState(false);
  const [currentColumnForTransformation, setCurrentColumnForTransformation] = useState<
    string | null
  >(null);
  const [categoryCleanerOpen, setCategoryCleanerOpen] = useState(false);
  const [categoryMappings, setCategoryMappings] = useState<CategoryMapping[]>([]);
  const [categoryCleanerLoading, setCategoryCleanerLoading] = useState(false);
  const [currentColumnForCategoryClean, setCurrentColumnForCategoryClean] = useState<string | null>(
    null
  );
  const [outlierRows, setOutlierRows] = useState<Set<number>>(new Set());
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const statsLoadAttempted = useRef(false);

  // Clipboard store
  const {
    copy: copyToClipboard,
    cut: cutToClipboard,
    paste: pasteFromClipboard,
    clear: clearClipboard,
    hasData: clipboardHasData,
    isCut: clipboardIsCut,
    getCutOrigin,
  } = useClipboardStore();

  // Prefetch state management
  const [prefetchedData, setPrefetchedData] = useState<RowType[]>([]);
  const isPrefetchingRef = useRef(false);
  const prefetchedRowRangeRef = useRef<{ start: number; end: number } | null>(null);

  const { session } = useAuth();
  const idTokenRef = useRef(session?.sessionJwt || null);
  const [columnHeaderOverrides, setColumnHeaderOverrides] = useState<Record<string, string>>({});
  const [columnMetadata, setColumnMetadata] = useState<ColumnMetadataMap>({});

  // Update token ref when it changes
  useEffect(() => {
    idTokenRef.current = session?.sessionJwt || null;
  }, [session?.sessionJwt]);

  // Get sheetId from tabData if available
  const sheetId = tabData?.sheetId;

  // Use sheet state hook when sheetId is provided (real-time collaboration mode)
  const {
    state: sheetState,
    version: sheetVersion,
    isConnected: isSheetConnected,
    isLoading: isSheetLoading,
    error: sheetError,
    applyOperation: applySheetOperation,
  } = useSheetState({
    sheetId: sheetId || '',
    enabled: !!sheetId,
  });

  // Memoize the decoded file path
  const decodedFilePath = useMemo(
    () => (filePath ? decodeURIComponent(filePath) : null),
    [filePath]
  );

  useEffect(() => {
    uuidDatasetGridCacheRef.current.clear();
  }, [decodedFilePath]);

  // Reset stats when file path changes
  useEffect(() => {
    if (filePath) {
      setLocalColumnStats(undefined);
      statsLoadAttempted.current = false;
    }
  }, [filePath]);

  /** Tab props may omit stats; `/api/analysis/analyze-file` fills `localColumnStats`. */
  const mergedColumnStats = useMemo(
    (): Record<string, ColumnSummary> => ({
      ...(columnStats ?? {}),
      ...(localColumnStats ?? {}),
    }),
    [columnStats, localColumnStats]
  );

  // Check if this is a project file (selected from a multi-file project)
  // Only skip fetchMoreRows for project files, not for projects themselves
  const isProjectFile = useMemo(() => {
    return tabData?.isProjectFile === true;
  }, [tabData?.isProjectFile]);

  const isFileMode = !!filePath;

  // Initialize data based on mode
  const [data, setData] = useState<RowType[]>(() => {
    if (isFileMode && initialData.length > 0) {
      // File mode with data: Initialize with provided data
      return initialData.map((row, index) => ({
        id: `row-${index}`,
        ...Object.fromEntries(
          Object.entries(row).map(([key, value]) => [
            key,
            typeof value === 'string' ? value.replace(/^"|"$/g, '').trim() : value,
          ])
        ),
      }));
    }
    if (waitingForDatasetRows) {
      // Dataset-backed tab: wait for fetch/hydrate instead of showing blank placeholder rows
      return [];
    }
    // Empty file or spreadsheet mode: Initialize with blank rows
    return Array(INITIAL_EMPTY_ROWS)
      .fill(null)
      .map((_, index) => ({
        id: `row-${index}`,
      }));
  });

  // Track if we've initialized from sheet state to avoid overwriting local edits
  const sheetStateInitializedRef = useRef(false);
  const lastSheetStateVersionRef = useRef<number>(0);

  // Sync sheet state to local data when sheet state is first available (real-time mode)
  // Only sync on initial load or when version increases significantly (server updates)
  // Don't sync on every change to avoid overwriting local edits
  useEffect(() => {
    if (
      sheetState &&
      sheetState.data &&
      Array.isArray(sheetState.data) &&
      sheetState.version > lastSheetStateVersionRef.current
    ) {
      // Only sync if:
      // 1. We haven't initialized yet (first load), OR
      // 2. Version jumped significantly (likely a server-side update, not our own edit)
      const versionDiff = sheetState.version - lastSheetStateVersionRef.current;
      const shouldSync =
        !sheetStateInitializedRef.current || (versionDiff > 1 && sheetState.data.length > 0);

      if (shouldSync && sheetState.data.length > 0) {
        // Convert sheet state data array to RowType format
        const sheetRows: RowType[] = sheetState.data.map(
          (row: Record<string, any>, index: number) => ({
            id: `row-${index}`,
            ...row,
          })
        );
        setData(sheetRows);
        sheetStateInitializedRef.current = true;
        lastSheetStateVersionRef.current = sheetState.version;
      } else {
        // Just update the version ref to track it
        lastSheetStateVersionRef.current = sheetState.version;
      }
    }
  }, [sheetState]);

  // Reset initialization flag when sheetId changes
  useEffect(() => {
    sheetStateInitializedRef.current = false;
    lastSheetStateVersionRef.current = 0;
  }, [sheetId]);

  // Track previous data length to prevent infinite loops (must be after data state declaration)
  const previousDataLengthRef = useRef(data.length);

  const { tabs, activeTabId, updateTab } = useTabsStore();
  const activeTab = tabs.find(tab => tab.id === activeTabId);
  const projectFileSystem = useProjectStore(s => s.fileSystem);
  const currentProjectId = useProjectStore(s => s.currentProject?.id);

  /** tensr-api dataset id — explicit on tab, else file in project, else path when it is a dataset. */
  const gridDatasetId = useMemo(() => {
    const explicit = tabData?.datasetId ?? activeTab?.data?.datasetId;
    if (explicit) return explicit;

    const pathId = getDatasetIdFromPath(decodedFilePath ?? undefined);
    if (pathId && currentProjectId && pathId === currentProjectId) {
      const fileEntry = projectFileSystem.find(f => f.fileId);
      return fileEntry?.fileId ?? null;
    }
    return pathId;
  }, [
    tabData?.datasetId,
    activeTab?.data?.datasetId,
    decodedFilePath,
    currentProjectId,
    projectFileSystem,
  ]);

  const refreshColumnHeadersFromSchema = useCallback(async () => {
    if (!gridDatasetId || !idTokenRef.current) return;
    const res = await fetch(tensrApiUrl(`/datasets/${gridDatasetId}/schema`), {
      headers: { Authorization: `Bearer ${idTokenRef.current}` },
    });
    if (handleUnauthorizedResponse(res)) return;
    if (!res.ok) return;
    const json = (await res.json()) as {
      schema?: { name: string; label?: string | null }[];
    };
    const map: Record<string, string> = {};
    for (const col of json.schema || []) {
      map[col.name] = String(col.label || col.name);
    }
    setColumnHeaderOverrides(map);
  }, [gridDatasetId]);

  useEffect(() => {
    void refreshColumnHeadersFromSchema();
  }, [refreshColumnHeadersFromSchema]);

  useEffect(() => {
    if (!gridDatasetId || !idTokenRef.current) {
      setColumnMetadata({});
      return;
    }
    let cancelled = false;
    void fetchDatasetColumnMetadata(gridDatasetId, idTokenRef.current)
      .then(meta => {
        if (!cancelled) setColumnMetadata(meta);
      })
      .catch(() => {
        if (!cancelled) setColumnMetadata({});
      });
    return () => {
      cancelled = true;
    };
  }, [gridDatasetId]);

  const handleMeasurementLevelChange = useCallback(
    async (columnId: string, level: MeasurementLevel) => {
      if (!gridDatasetId || !idTokenRef.current) return;

      const previous = columnMetadata[columnId];
      setColumnMetadata(prev => ({
        ...prev,
        [columnId]: { ...(prev[columnId] ?? { name: columnId }), name: columnId, measure: level },
      }));

      try {
        const updated = await patchColumnMetadata(
          gridDatasetId,
          columnId,
          { measure: level },
          idTokenRef.current
        );
        setColumnMetadata(updated);
      } catch (err) {
        setColumnMetadata(prev => {
          if (previous) {
            return { ...prev, [columnId]: previous };
          }
          const { [columnId]: _removed, ...rest } = prev;
          return rest;
        });
        toast({
          title: 'Could not save measurement level',
          description: err instanceof Error ? err.message : 'Please try again.',
          variant: 'destructive',
        });
      }
    },
    [columnMetadata, gridDatasetId]
  );

  useEffect(() => {
    if (!activeTab?.data || activeTab.data.datasetId || !gridDatasetId) return;
    updateTab(activeTab.id, {
      data: { ...activeTab.data, datasetId: gridDatasetId },
    });
  }, [activeTab, gridDatasetId, updateTab]);

  const isFullyLoadedInMemory = useMemo(
    () => !!totalRowCount && data.length >= totalRowCount,
    [totalRowCount, data.length]
  );

  /** Centered spinner only while the grid has no rows yet (initial open / hydrate / sort reset). */
  const showInitialGridLoader = useMemo(() => {
    if (data.length > 0) return false;
    if (isFileMode) {
      return !!totalRowCount && isLoading;
    }
    // Real-time sheet tabs: wait for WS snapshot before first paint.
    return !!sheetId && isSheetLoading;
  }, [data.length, isFileMode, totalRowCount, isLoading, sheetId, isSheetLoading]);

  const hasUsableColumnStats = useMemo(() => {
    const merged = { ...(columnStats ?? {}), ...(localColumnStats ?? {}) };
    return Object.values(merged).some(
      s =>
        s?.numeric_stats ||
        s?.categorical_stats ||
        (s?.data_type && s.data_type !== 'object' && s.data_type !== 'string')
    );
  }, [columnStats, localColumnStats]);

  const columnSampleValues = useMemo(() => {
    const samples: Record<string, unknown[]> = {};
    for (const col of initialColumns) {
      if (!col.id || col.id === 'select') continue;
      samples[col.id] = [];
    }
    for (const row of data.slice(0, 80)) {
      for (const col of initialColumns) {
        if (!col.id || col.id === 'select') continue;
        const v = (row as Record<string, unknown>)[col.id];
        if (v !== undefined && v !== '') {
          samples[col.id]?.push(v);
        }
      }
    }
    return samples;
  }, [data, initialColumns]);

  const loadColumnStats = useCallback(async () => {
    const statsPath = gridDatasetId ?? decodedFilePath;
    if (!statsPath || statsLoadAttempted.current || isProjectFile || hasUsableColumnStats) {
      return;
    }

    try {
      setIsLoadingStats(true);
      statsLoadAttempted.current = true;

      const response = await fetch(tensrApiUrl('/api/analysis/analyze-file'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idTokenRef.current}`,
        },
        body: JSON.stringify({
          path: statsPath,
        }),
      });

      if (!response.ok) {
        throw new Error(`Error analyzing file: ${response.statusText}`);
      }

      const stats = await response.json();

      if (!stats || typeof stats !== 'object') {
        throw new Error('Invalid statistics data received');
      }

      setLocalColumnStats(stats);

      if (tabId) {
        const tab = useTabsStore.getState().tabs.find(t => t.id === tabId);
        if (tab?.data) {
          updateTab(tabId, {
            data: {
              ...tab.data,
              columnStats: {
                ...(tab.data.columnStats ?? {}),
                ...stats,
              },
            },
          });
        }
      }
    } catch {
      statsLoadAttempted.current = false;
    } finally {
      setIsLoadingStats(false);
    }
  }, [decodedFilePath, gridDatasetId, isProjectFile, hasUsableColumnStats, tabId, updateTab]);

  useEffect(() => {
    const statsPath = gridDatasetId ?? decodedFilePath;
    if (statsPath && !hasUsableColumnStats && !isLoadingStats && !isProjectFile) {
      loadColumnStats();
    }
  }, [
    decodedFilePath,
    gridDatasetId,
    hasUsableColumnStats,
    isLoadingStats,
    isProjectFile,
    loadColumnStats,
  ]);

  useEffect(() => {
    const statsPath = gridDatasetId ?? decodedFilePath;
    if (showStats && statsPath && !localColumnStats && !isLoadingStats && !isProjectFile) {
      statsLoadAttempted.current = false;
      loadColumnStats();
    }
  }, [
    showStats,
    decodedFilePath,
    gridDatasetId,
    localColumnStats,
    isLoadingStats,
    isProjectFile,
    loadColumnStats,
  ]);

  const [sorting, setSorting] = useState<SortingState>([]);
  const sortingRef = useRef<SortingState>([]);
  useEffect(() => {
    sortingRef.current = sorting;
  }, [sorting]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(
    activeTab?.data?.columnFilters || []
  );

  useEffect(() => {
    dataLengthRef.current = data.length;
    if (totalRowCount && data.length >= totalRowCount) {
      lastLoadedRowRef.current = totalRowCount;
    }
  }, [data.length, totalRowCount]);

  // If tab has preview rows but local grid was cleared (sort/filter race), restore once.
  useEffect(() => {
    if (!isFileMode || initialData.length === 0 || data.length > 0) return;
    if (columnFilters.length > 0 || sorting.length > 0 || loadingRef.current) return;

    setData(
      initialData.map((row, index) => ({
        id: `row-${index}`,
        ...Object.fromEntries(
          Object.entries(row).map(([key, value]) => [
            key,
            typeof value === 'string' ? value.replace(/^"|"$/g, '').trim() : value,
          ])
        ),
      }))
    );
    lastLoadedRowRef.current = initialData.length;
  }, [isFileMode, initialData, data.length, columnFilters.length, sorting.length]);

  const [columnSizing, setColumnSizing] = useState({});
  const [extraColumnsCount, setExtraColumnsCount] = useState(EXTRA_COLUMNS);
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    const vis: VisibilityState = {};
    const tabVis = activeTab?.columnVisibility;
    for (const col of initialColumns) {
      if (!col.id) continue;
      if (tabVis?.[col.id] === false) vis[col.id] = false;
    }
    return vis;
  });

  useEffect(() => {
    const vis: VisibilityState = {};
    const tabVis = activeTab?.columnVisibility;
    for (const col of initialColumns) {
      if (!col.id) continue;
      if (tabVis?.[col.id] === false) vis[col.id] = false;
    }
    setColumnVisibility(vis);
  }, [activeTabId, activeTab?.columnVisibility, initialColumns]);

  const handleColumnVisibilityChange = useCallback(
    (updater: VisibilityState | ((old: VisibilityState) => VisibilityState)) => {
      setColumnVisibility(prev => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        if (activeTab && tabId) {
          const tabVis: Record<string, boolean> = { ...(activeTab.columnVisibility ?? {}) };
          for (const col of initialColumns) {
            if (!col.id) continue;
            tabVis[col.id] = next[col.id] !== false;
          }
          updateTab(activeTab.id, { columnVisibility: tabVis });
        }
        return next;
      });
    },
    [activeTab, tabId, initialColumns, updateTab]
  );

  const displayColumns = useMemo(
    () =>
      initialColumns.map(col => ({
        ...col,
        header: (col.id && columnHeaderOverrides[col.id]) || col.header || col.id,
      })),
    [initialColumns, columnHeaderOverrides]
  );

  const columns = useMemo(
    () =>
      createColumns({
        initialColumns: displayColumns,
        extraColumnsCount,
        setData: setData as React.Dispatch<React.SetStateAction<Record<string, any>[]>>,
        DEFAULT_COLUMN_WIDTH,
      } as CreateColumnsProps),
    [displayColumns, extraColumnsCount]
  );

  const fetchMoreRows = useCallback(async () => {
    if (!decodedFilePath) {
      return;
    }

    if (isProjectFile) {
      return;
    }

    if (totalRowCount && dataLengthRef.current >= totalRowCount) {
      lastLoadedRowRef.current = totalRowCount;
      return;
    }
    if (lastLoadedRowRef.current >= (totalRowCount || 0)) {
      return;
    }

    const startRow = lastLoadedRowRef.current;
    const batchEnd = startRow + ROWS_PER_BATCH;
    const catchUpEnd = pendingLoadEndRef.current;
    pendingLoadEndRef.current = 0;
    const endRow = Math.min(
      Math.max(batchEnd, catchUpEnd > startRow ? catchUpEnd : batchEnd),
      totalRowCount || 0
    );
    const requestedCatchUpEnd = catchUpEnd;

    if (startRow >= endRow) {
      return;
    }

    if (loadingRef.current) {
      return;
    }

    loadingRef.current = true;
    setIsLoading(true);
    const fetchGeneration = loadGenerationRef.current;

    try {
      // Check if we have prefetched data for this range
      if (
        prefetchedData.length > 0 &&
        prefetchedRowRangeRef.current &&
        prefetchedRowRangeRef.current.start === startRow &&
        prefetchedRowRangeRef.current.end === endRow
      ) {
        if (fetchGeneration !== loadGenerationRef.current) return;
        setData(prevData =>
          mergeRowPage(prevData, startRow, prefetchedData, totalRowCount || prevData.length)
        );
        setPrefetchedData([]);
        prefetchedRowRangeRef.current = null;

        lastLoadedRowRef.current = Math.min(endRow, totalRowCount || endRow);

        // Start prefetching the next page
        setTimeout(() => prefetchNextPage(), 0);
        return;
      }

      // Convert TanStack Table sorting state to backend format
      const activeSorting = sortingRef.current;
      const sortConfig: SortConfig[] | undefined =
        activeSorting.length > 0
          ? activeSorting.map(sort => ({
              column: sort.id,
              desc: sort.desc,
            }))
          : undefined;

      const filterConfig = columnFilters.map(filter => {
        const filterValue = (filter.value as { operator?: string; value?: any }) || {};
        const operator = filterValue.operator || '';
        // Always convert value to string
        const stringValue = String(filterValue.value || '');

        return {
          column: filter.id,
          operator,
          value: stringValue,
        };
      });

      // Prefer tensr-api dataset preview (fast, cached) when we know the dataset id.
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const isProjectPath = decodedFilePath ? uuidRegex.test(decodedFilePath) : false;

      let response: Response | undefined;
      let data: { data?: unknown[][] };

      if (gridDatasetId) {
        const dsPage = await fetchDatasetGridSliceForSpreadsheet(
          gridDatasetId,
          idTokenRef.current,
          startRow,
          endRow,
          uuidDatasetGridCacheRef.current,
          sortConfig
        );
        if (dsPage) {
          data = dsPage;
        } else if (isProjectPath && decodedFilePath) {
          const projectResponse = await fetch(
            `${getTensrApiBaseUrl()}/projects/${decodedFilePath}`,
            {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${idTokenRef.current}`,
              },
            }
          );

          if (!projectResponse.ok) {
            throw new Error(`Failed to get project details: ${projectResponse.status}`);
          }

          const projectData = await projectResponse.json();
          const firstFile = projectData.fileGroups?.data?.[0];
          if (!firstFile) {
            throw new Error('No files found in project');
          }

          response = await fetch(`${getTensrApiBaseUrl()}/api/files/fetch-page`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idTokenRef.current}`,
            },
            body: JSON.stringify({
              path: firstFile.path,
              start_row: startRow,
              end_row: endRow,
              sort_config: sortConfig,
              filter_config: filterConfig,
              project_id: decodedFilePath,
              file_id: firstFile.fileId,
            }),
          });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch data: ${response.status} ${errorText}`);
          }
          data = await response.json();
        } else {
          throw new Error('Could not load dataset grid slice');
        }
      } else {
        const isProjectFilePath =
          decodedFilePath.includes('/users/') && decodedFilePath.includes('/projects/');

        let requestBody: Record<string, unknown> = {
          path: decodedFilePath,
          start_row: startRow,
          end_row: endRow,
          sort_config: sortConfig,
          filter_config: filterConfig,
        };

        if (isProjectFilePath) {
          const pathParts = decodedFilePath.split('/');
          const usersIndex = pathParts.indexOf('users');
          const projectsIndex = pathParts.indexOf('projects');

          if (usersIndex !== -1 && projectsIndex !== -1 && projectsIndex > usersIndex) {
            const projectId = pathParts[projectsIndex + 1];
            const fileId = pathParts[projectsIndex + 3];

            requestBody = {
              ...requestBody,
              project_id: projectId,
              file_id: fileId,
            };
          }
        }

        response = await fetch(`${getTensrApiBaseUrl()}/api/files/fetch-page`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idTokenRef.current}`,
          },
          body: JSON.stringify(requestBody),
        });
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch data: ${response.status} ${errorText}`);
        }
        data = await response.json();
      }

      if (startRow >= (totalRowCount || 0)) {
        setData(prevData => [
          ...prevData,
          ...Array(ROWS_PER_BATCH)
            .fill(null)
            .map((_, index) => ({
              id: `empty-${prevData.length + index}`,
            })),
        ]);
      } else {
        // Column-major pages: legacy fetch-page or tensr-api dataset preview slice
        const processedData = data?.data;

        if (processedData && processedData[0]) {
          const newRows = rowsFromColumnMajorPage(
            processedData as unknown[][],
            initialColumns as any,
            startRow
          );

          if (fetchGeneration !== loadGenerationRef.current) return;

          setData(prevData =>
            mergeRowPage(prevData, startRow, newRows, totalRowCount || prevData.length)
          );
        }
      }

      lastLoadedRowRef.current = Math.min(endRow, totalRowCount || endRow);

      if (endRow < (totalRowCount || 0)) {
        setTimeout(() => {
          if (!isPrefetchingRef.current) {
            prefetchNextPage();
          }
        }, 0);
      }
    } catch (error) {
      console.error('[Pagination] load rows failed', error);
    } finally {
      setIsLoading(false);
      loadingRef.current = false;
      if (
        requestedCatchUpEnd > lastLoadedRowRef.current &&
        requestedCatchUpEnd <= (totalRowCount || 0)
      ) {
        pendingLoadEndRef.current = requestedCatchUpEnd;
        queueMicrotask(() => {
          if (!loadingRef.current) void fetchMoreRows();
        });
      }
    }
  }, [decodedFilePath, gridDatasetId, initialColumns, totalRowCount, columnFilters, isProjectFile]);

  const ensureRowsLoaded = useCallback(
    (throughIndex: number) => {
      if (!isFileMode || isProjectFile || !totalRowCount) return;
      if (dataLengthRef.current >= totalRowCount) {
        lastLoadedRowRef.current = totalRowCount;
        return;
      }
      if (lastLoadedRowRef.current >= totalRowCount) return;

      const targetEnd = Math.min(throughIndex + LOAD_AHEAD_ROWS, totalRowCount);
      if (dataLengthRef.current >= targetEnd || lastLoadedRowRef.current >= targetEnd) return;

      pendingLoadEndRef.current = Math.max(pendingLoadEndRef.current, targetEnd);

      if (loadingRef.current) return;

      void fetchMoreRows();
    },
    [isFileMode, isProjectFile, totalRowCount, fetchMoreRows]
  );

  // Prefetch function - loads data in background without showing loading state
  const prefetchNextPage = useCallback(async () => {
    if (!decodedFilePath || isPrefetchingRef.current || isProjectFile) {
      return;
    }
    if (totalRowCount && dataLengthRef.current >= totalRowCount) {
      return;
    }

    const nextStartRow = lastLoadedRowRef.current;
    const nextEndRow = Math.min(nextStartRow + ROWS_PER_BATCH, totalRowCount || 0);

    // Don't prefetch if we've already prefetched this range or if no more data
    if (
      nextStartRow >= (totalRowCount || 0) ||
      (prefetchedRowRangeRef.current &&
        prefetchedRowRangeRef.current.start === nextStartRow &&
        prefetchedRowRangeRef.current.end === nextEndRow)
    ) {
      return;
    }

    try {
      isPrefetchingRef.current = true;

      // Convert TanStack Table sorting state to backend format
      const activeSorting = sortingRef.current;
      const sortConfig: SortConfig[] | undefined =
        activeSorting.length > 0
          ? activeSorting.map(sort => ({
              column: sort.id,
              desc: sort.desc,
            }))
          : undefined;

      const filterConfig = columnFilters.map(filter => {
        const filterValue = (filter.value as { operator?: string; value?: any }) || {};
        const operator = filterValue.operator || '';
        const stringValue = String(filterValue.value || '');

        return {
          column: filter.id,
          operator,
          value: stringValue,
        };
      });

      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const isProjectPath = decodedFilePath ? uuidRegex.test(decodedFilePath) : false;

      let data: { data?: unknown[][] } | undefined;

      if (gridDatasetId) {
        const dsPage = await fetchDatasetGridSliceForSpreadsheet(
          gridDatasetId,
          idTokenRef.current,
          nextStartRow,
          nextEndRow,
          uuidDatasetGridCacheRef.current,
          sortConfig
        );
        if (dsPage) {
          data = dsPage;
        } else if (isProjectPath && decodedFilePath) {
          const projectResponse = await fetch(
            `${getTensrApiBaseUrl()}/projects/${decodedFilePath}`,
            {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${idTokenRef.current}`,
              },
            }
          );

          if (!projectResponse.ok) {
            return;
          }

          const projectData = await projectResponse.json();
          const firstFile = projectData.fileGroups?.data?.[0];
          if (!firstFile) {
            return;
          }

          const pageRes = await fetch(`${getTensrApiBaseUrl()}/api/files/fetch-page`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idTokenRef.current}`,
            },
            body: JSON.stringify({
              path: firstFile.path,
              start_row: nextStartRow,
              end_row: nextEndRow,
              sort_config: sortConfig,
              filter_config: filterConfig,
              project_id: decodedFilePath,
              file_id: firstFile.fileId,
            }),
          });

          if (!pageRes.ok) {
            return;
          }

          data = await pageRes.json();
        }
      } else {
        const isProjectFilePath =
          decodedFilePath.includes('/users/') && decodedFilePath.includes('/projects/');

        let requestBody: Record<string, unknown> = {
          path: decodedFilePath,
          start_row: nextStartRow,
          end_row: nextEndRow,
          sort_config: sortConfig,
          filter_config: filterConfig,
        };

        if (isProjectFilePath) {
          const pathParts = decodedFilePath.split('/');
          const usersIndex = pathParts.indexOf('users');
          const projectsIndex = pathParts.indexOf('projects');

          if (usersIndex !== -1 && projectsIndex !== -1 && projectsIndex > usersIndex) {
            const projectId = pathParts[projectsIndex + 1];
            const fileId = pathParts[projectsIndex + 3];

            requestBody = {
              ...requestBody,
              project_id: projectId,
              file_id: fileId,
            };
          }
        }

        const pageRes = await fetch(`${getTensrApiBaseUrl()}/api/files/fetch-page`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idTokenRef.current}`,
          },
          body: JSON.stringify(requestBody),
        });

        if (!pageRes.ok) {
          return;
        }

        data = await pageRes.json();
      }

      const processedData = data?.data;

      if (processedData && processedData[0]) {
        const newRows = rowsFromColumnMajorPage(
          processedData as unknown[][],
          initialColumns as any,
          nextStartRow
        );

        setPrefetchedData(newRows);
        prefetchedRowRangeRef.current = { start: nextStartRow, end: nextEndRow };
      }
    } catch {
      // Prefetch is best-effort
    } finally {
      isPrefetchingRef.current = false;
    }
  }, [decodedFilePath, gridDatasetId, initialColumns, totalRowCount, columnFilters, isProjectFile]);

  // Initial data loading - consolidated into single effect with proper guards
  const initialLoadDoneRef = useRef(false);
  useEffect(() => {
    if (!isProjectFile && decodedFilePath && !initialLoadDoneRef.current && !loadingRef.current) {
      const datasetId = gridDatasetId;
      const smallDataset =
        totalRowCount && totalRowCount <= SMALL_DATASET_EAGER_LOAD && !!datasetId;

      // Small UUID datasets: full-hydrate effect loads everything; skip paginated fetch.
      if (smallDataset && dataLengthRef.current < (totalRowCount || 0)) {
        initialLoadDoneRef.current = true;
        return;
      }

      const needsMoreData =
        totalRowCount &&
        totalRowCount > initialData.length &&
        dataLengthRef.current < totalRowCount &&
        lastLoadedRowRef.current < totalRowCount;

      if (needsMoreData) {
        initialLoadDoneRef.current = true;
        const timer = setTimeout(() => {
          if (!loadingRef.current && totalRowCount && dataLengthRef.current < totalRowCount) {
            if (totalRowCount <= SMALL_DATASET_EAGER_LOAD) {
              pendingLoadEndRef.current = totalRowCount;
            }
            fetchMoreRows();
          }
        }, INITIAL_PREFETCH_DELAY);
        return () => clearTimeout(timer);
      } else {
        initialLoadDoneRef.current = true;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decodedFilePath, isProjectFile, totalRowCount, initialData.length]);

  useEffect(() => {
    if (totalRowCount && data.length > totalRowCount) {
      setData(prev => prev.slice(0, totalRowCount));
    }
  }, [data.length, totalRowCount]);

  /** Hydrate full in-memory grid for small dataset-backed tabs (instant scroll, no void). */
  const fullHydrateStartedRef = useRef(false);
  useEffect(() => {
    fullHydrateStartedRef.current = false;
  }, [decodedFilePath]);

  useEffect(() => {
    if (fullHydrateStartedRef.current || isProjectFile || !decodedFilePath || !totalRowCount) {
      return;
    }
    const datasetId = gridDatasetId;
    if (!datasetId || totalRowCount > SMALL_DATASET_EAGER_LOAD) return;
    if (data.length >= totalRowCount || initialData.length >= totalRowCount) {
      lastLoadedRowRef.current = totalRowCount;
      return;
    }

    fullHydrateStartedRef.current = true;
    loadGenerationRef.current += 1;
    const hydrateGeneration = loadGenerationRef.current;
    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const hydrateSortConfig: SortConfig[] | undefined =
          sortingRef.current.length > 0
            ? sortingRef.current.map(sort => ({
                column: sort.id,
                desc: sort.desc,
              }))
            : undefined;
        const page = await fetchDatasetGridSliceForSpreadsheet(
          datasetId,
          idTokenRef.current,
          0,
          totalRowCount,
          uuidDatasetGridCacheRef.current,
          hydrateSortConfig
        );
        if (cancelled || hydrateGeneration !== loadGenerationRef.current || !page?.data?.[0]) {
          if (!cancelled && hydrateGeneration === loadGenerationRef.current) {
            fullHydrateStartedRef.current = false;
            pendingLoadEndRef.current = totalRowCount;
            void fetchMoreRows();
          }
          return;
        }

        const allRows = rowsFromColumnMajorPage(page.data as unknown[][], initialColumns as any, 0);
        if (allRows.length === 0) {
          if (hydrateGeneration === loadGenerationRef.current) {
            fullHydrateStartedRef.current = false;
            pendingLoadEndRef.current = totalRowCount;
            void fetchMoreRows();
          }
          return;
        }
        if (hydrateGeneration !== loadGenerationRef.current) return;
        setData(allRows.slice(0, totalRowCount));
        lastLoadedRowRef.current = totalRowCount;
      } catch (err) {
        console.error('[Spreadsheet] full dataset hydrate failed', err);
        fullHydrateStartedRef.current = false;
        pendingLoadEndRef.current = totalRowCount;
        void fetchMoreRows();
      } finally {
        if (!cancelled && hydrateGeneration === loadGenerationRef.current) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      setIsLoading(false);
    };
  }, [gridDatasetId, isProjectFile, totalRowCount, data.length, initialColumns, fetchMoreRows]);

  // Reset initial load flag when file path changes
  useEffect(() => {
    initialLoadDoneRef.current = false;
  }, [decodedFilePath]);

  const handleSortingChange: OnChangeFn<SortingState> = useCallback(
    async updaterOrValue => {
      const newSorting =
        typeof updaterOrValue === 'function' ? updaterOrValue(sortingRef.current) : updaterOrValue;
      sortingRef.current = newSorting;

      loadGenerationRef.current += 1;
      setPrefetchedData([]);
      prefetchedRowRangeRef.current = null;

      setSorting(newSorting);

      if (!decodedFilePath) {
        if (newSorting.length > 0) {
          const sortConfig = newSorting.map(sort => ({
            column: sort.id,
            desc: sort.desc,
          }));
          setData(prev => sortSpreadsheetRows(prev, sortConfig));
        }
        return;
      }

      // Reset the data and pagination state when sort changes
      setData([]);
      lastLoadedRowRef.current = 0;

      // Refetch data with new sorting
      await fetchMoreRows();
    },
    [decodedFilePath, fetchMoreRows]
  );

  const fetchFilteredData = useCallback(
    (newFilters: ColumnFiltersState) => {
      // Directly set column filters
      setColumnFilters(newFilters);

      // Reset data and pagination
      setData([]);
      lastLoadedRowRef.current = 0;
      // Clear prefetched data since filters changed
      setPrefetchedData([]);
      prefetchedRowRangeRef.current = null;

      // Use a callback to ensure we're working with the latest state
      const fetchData = async () => {
        try {
          // Capture the filters immediately after setting state
          const currentFilters = newFilters;

          const startRow = 0;
          const endRow = ROWS_PER_BATCH;

          const filterConfig = currentFilters.map(filter => {
            const filterValue = (filter.value as { operator?: string; value?: any }) || {};
            return {
              column: filter.id,
              operator: filterValue.operator || '',
              value: String(filterValue.value || ''),
            };
          });

          // Determine if this is a project file by checking if filePath contains project structure
          const isProjectFile =
            decodedFilePath &&
            decodedFilePath.includes('/users/') &&
            decodedFilePath.includes('/projects/');

          let requestBody: any = {
            path: decodedFilePath,
            start_row: 0,
            end_row: 100,
          };

          // If it's a project file, extract project context
          if (isProjectFile && decodedFilePath) {
            const pathParts = decodedFilePath.split('/');
            const usersIndex = pathParts.indexOf('users');
            const projectsIndex = pathParts.indexOf('projects');

            if (usersIndex !== -1 && projectsIndex !== -1 && projectsIndex > usersIndex) {
              const userId = pathParts[usersIndex + 1];
              const projectId = pathParts[projectsIndex + 1];
              const fileId = pathParts[projectsIndex + 3]; // files/{fileId}/{fileName}

              requestBody = {
                ...requestBody,
                project_id: projectId,
                file_id: fileId,
              };
            }
          }

          const response = await fetch(`${getTensrApiBaseUrl()}/api/files/fetch-page`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idTokenRef.current}`,
            },
            body: JSON.stringify(requestBody),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error('Error response:', errorText);
            throw new Error(`Failed to fetch data: ${response.status} ${errorText}`);
          }

          const data = await response.json();

          // Process the response
          if (data.data && data.data[0]) {
            const newRows = data.data[0].map((_: any, rowIndex: string | number) => {
              const row: RowType = { id: `row-${rowIndex}` };
              initialColumns.forEach((col, colIndex) => {
                if (col.id) {
                  row[col.id] = data.data[colIndex][rowIndex];
                }
              });
              return row;
            });

            // Filter updates are non-urgent - use transition
            startTransition(() => {
              setData(newRows);
              lastLoadedRowRef.current = newRows.length;
            });
          }
        } catch (error) {
          console.error('Failed to fetch filtered data:', error);
        }
      };

      // Execute the fetch
      fetchData();
    },
    [decodedFilePath, initialColumns]
  );

  const isDatasetWorkspace = useMemo(() => !!gridDatasetId, [gridDatasetId]);

  const tableData = useMemo(() => {
    let rows: RowType[] =
      !isDatasetWorkspace || !columnFilters.length
        ? data
        : applyClientColumnFilters(
            data as RowType[],
            columnFilters as { id: string; value: { operator: string; value: unknown } }[]
          );
    if (totalRowCount && rows.length > totalRowCount) {
      rows = rows.slice(0, totalRowCount);
    }
    return rows;
  }, [data, columnFilters, isDatasetWorkspace, totalRowCount]);

  const heatmapColumns =
    (tabData as any)?.heatmapColumns ?? (activeTab?.data as any)?.heatmapColumns ?? {};
  const freezeUpToColumnId =
    (tabData as any)?.freezeUpToColumnId ?? (activeTab?.data as any)?.freezeUpToColumnId ?? null;

  const visibleLeafColumnIds = useMemo(() => {
    const vis = columnVisibility;
    const ids = [
      'select',
      ...initialColumns.filter(c => c.id && vis[c.id] !== false).map(c => c.id as string),
    ];
    return ids;
  }, [initialColumns, columnVisibility]);

  const columnPinning = useMemo((): ColumnPinningState => {
    if (!freezeUpToColumnId) return { left: [], right: [] };
    const idx = visibleLeafColumnIds.indexOf(freezeUpToColumnId);
    if (idx < 0) return { left: [], right: [] };
    return { left: visibleLeafColumnIds.slice(0, idx + 1), right: [] };
  }, [freezeUpToColumnId, visibleLeafColumnIds]);

  const heatmapScales = useMemo(() => {
    const scales: Record<string, ReturnType<typeof computeColumnHeatmapScale>> = {};
    for (const [colId, enabled] of Object.entries(heatmapColumns)) {
      if (!enabled) continue;
      scales[colId] = computeColumnHeatmapScale(tableData as Record<string, unknown>[], colId);
    }
    return scales;
  }, [heatmapColumns, tableData]);

  const table = useReactTable({
    data: tableData,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      columnSizing,
      columnPinning,
    },
    onRowSelectionChange: setRowSelection,
    onSortingChange: handleSortingChange,
    onColumnFiltersChange: filtersOrUpdater => {
      const newFilters =
        typeof filtersOrUpdater === 'function' ? filtersOrUpdater(columnFilters) : filtersOrUpdater;

      setColumnFilters(newFilters);
      // Update tab store with new filters
      if (activeTab) {
        updateTab(activeTab.id, {
          data: {
            ...activeTab.data,
            columnFilters: newFilters as any,
          },
        });
      }
    },
    onColumnVisibilityChange: handleColumnVisibilityChange,
    onColumnSizingChange: setColumnSizing,
    columnResizeMode: 'onChange',
    defaultColumn: {
      minSize: 56,
      maxSize: 800,
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    autoResetPageIndex: false,
    enableMultiSort: true,
    manualSorting: true,
    manualFiltering: true,
    enableRowSelection: true,
    enableColumnPinning: true,
  });

  const { rows } = table.getRowModel();

  const totalTableWidth = useMemo(
    () =>
      table
        .getVisibleLeafColumns()
        .reduce((sum, col) => sum + (col.getSize() || DEFAULT_COLUMN_WIDTH), 0),
    [table, columnSizing, columnVisibility]
  );

  // ─── Agent / chat driven controls ───────────────────────────────────────
  // The agent panel dispatches window CustomEvents so chat commands like
  // "sort by X desc", "hide column Y", "show hidden columns" can drive the
  // grid without needing direct refs into the spreadsheet.
  useEffect(() => {
    const onSort = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | { columnId?: string; direction?: 'asc' | 'desc' }
        | undefined;
      if (!detail?.columnId) return;
      const col = table.getColumn(detail.columnId);
      if (!col) return;
      const desc = detail.direction === 'desc';

      // Always update the sort state so headers show the indicator.
      setSorting([{ id: detail.columnId, desc }]);

      // Client-side sort the currently loaded rows. This is what makes the
      // sort visible for in-memory dataset tabs (where there's no backend
      // refetch); for paginated/file-backed tabs the loaded window is also
      // sorted, and the user's next interaction will refetch via the normal
      // `handleSortingChange` path if needed.
      setData(prev => {
        const colId = detail.columnId!;
        const next = [...prev].sort((a, b) => {
          const av = (a as Record<string, unknown>)[colId];
          const bv = (b as Record<string, unknown>)[colId];
          if (av == null && bv == null) return 0;
          if (av == null) return desc ? 1 : -1;
          if (bv == null) return desc ? -1 : 1;
          if (typeof av === 'number' && typeof bv === 'number') {
            return desc ? bv - av : av - bv;
          }
          const an = Number(av);
          const bn = Number(bv);
          if (!Number.isNaN(an) && !Number.isNaN(bn) && av !== '' && bv !== '') {
            return desc ? bn - an : an - bn;
          }
          const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
          return desc ? -cmp : cmp;
        });
        return next;
      });
    };
    const onClearSort = () => setSorting([]);
    const onHideColumn = (e: Event) => {
      const detail = (e as CustomEvent).detail as { columnId?: string } | undefined;
      if (!detail?.columnId) return;
      const col = table.getColumn(detail.columnId);
      if (!col) return;
      col.toggleVisibility(false);
      toast({
        title: 'Column hidden',
        description: 'Use the column menu or say "show hidden columns" to restore.',
      });
    };
    const onShowHidden = () => {
      const hidden = table.getAllLeafColumns().filter(c => c.getCanHide() && !c.getIsVisible());
      hidden.forEach(c => c.toggleVisibility(true));
      if (hidden.length > 0) {
        toast({
          title: `Restored ${hidden.length} hidden column${hidden.length === 1 ? '' : 's'}`,
        });
      }
    };

    const onApplyFilters = (e: Event) => {
      const detail = (e as CustomEvent<{ filters?: TabColumnFilterPayload[] }>).detail;
      const filters = (detail?.filters ?? []) as ColumnFiltersState;
      setColumnFilters(filters);
      if (!getDatasetIdFromPath(activeTab?.data?.filePath)) {
        fetchFilteredData(filters);
      }
    };

    const onClearFilters = () => {
      setColumnFilters([]);
      if (!getDatasetIdFromPath(activeTab?.data?.filePath)) {
        setData([]);
        lastLoadedRowRef.current = 0;
        setPrefetchedData([]);
        prefetchedRowRangeRef.current = null;
        fetchMoreRows();
      }
    };

    window.addEventListener(SPREADSHEET_EVENTS.SORT, onSort as EventListener);
    window.addEventListener(SPREADSHEET_EVENTS.CLEAR_SORT, onClearSort as EventListener);
    window.addEventListener(SPREADSHEET_EVENTS.HIDE_COLUMN, onHideColumn as EventListener);
    window.addEventListener(SPREADSHEET_EVENTS.SHOW_HIDDEN_COLUMNS, onShowHidden as EventListener);
    window.addEventListener(SPREADSHEET_EVENTS.APPLY_FILTERS, onApplyFilters as EventListener);
    window.addEventListener(SPREADSHEET_EVENTS.CLEAR_FILTERS, onClearFilters as EventListener);
    return () => {
      window.removeEventListener(SPREADSHEET_EVENTS.SORT, onSort as EventListener);
      window.removeEventListener(SPREADSHEET_EVENTS.CLEAR_SORT, onClearSort as EventListener);
      window.removeEventListener(SPREADSHEET_EVENTS.HIDE_COLUMN, onHideColumn as EventListener);
      window.removeEventListener(
        SPREADSHEET_EVENTS.SHOW_HIDDEN_COLUMNS,
        onShowHidden as EventListener
      );
      window.removeEventListener(SPREADSHEET_EVENTS.APPLY_FILTERS, onApplyFilters as EventListener);
      window.removeEventListener(SPREADSHEET_EVENTS.CLEAR_FILTERS, onClearFilters as EventListener);
    };
  }, [table, activeTab?.data?.filePath, fetchFilteredData, fetchMoreRows]);

  // Full scroll height in file mode so unloaded rows render empty grid placeholders.
  const virtualizationCount = useMemo(() => {
    if (isFileMode && totalRowCount) {
      return totalRowCount;
    }
    return rows.length;
  }, [isFileMode, totalRowCount, rows.length]);

  // data.length = rows fetched so far; tableData may be smaller if client filters applied
  const loadedRowCount = data.length;
  const hasUnloadedRows = isFileMode && !!totalRowCount && loadedRowCount < virtualizationCount;

  const gridColumns = table.getAllColumns();

  /**
   * Pre-compute per-column metadata once per render instead of O(n) inside
   * each cell render (initialColumns.find per cell = O(cols²) per scroll).
   */
  const colMetaById = useMemo(() => new Map(initialColumns.map(c => [c.id, c])), [initialColumns]);

  const colIsNumericById = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const col of initialColumns) {
      if (!col.id) continue;
      map.set(
        col.id,
        resolveColumnIsNumeric(
          col.id,
          mergedColumnStats,
          (col as any).type as string | undefined,
          undefined,
          columnSampleValues[col.id]
        )
      );
    }
    return map;
  }, [initialColumns, mergedColumnStats, columnSampleValues]);

  /** Single clipboard check per render — not once per cell (was ×30 per row). */
  const clipboardHasDataNow = clipboardHasData();

  const [, startTransition] = useTransition();

  const rowVirtualizer = useVirtualizer({
    count: virtualizationCount,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: useCallback(() => ROW_HEIGHT_PX, []),
    overscan: hasUnloadedRows ? VIRTUAL_OVERSCAN_LOADING : VIRTUAL_OVERSCAN_LOADED,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const virtualStartIndex = virtualItems.length ? virtualItems[0]!.index : -1;
  const virtualEndIndex = virtualItems.length ? virtualItems[virtualItems.length - 1]!.index : -1;

  useLayoutEffect(() => {
    if (!isFileMode || isProjectFile || virtualEndIndex < 0 || isFullyLoadedInMemory) return;
    const throughIndex = Math.max(virtualEndIndex, virtualStartIndex);
    ensureRowsLoaded(throughIndex);
  }, [
    virtualStartIndex,
    virtualEndIndex,
    isFileMode,
    isProjectFile,
    isFullyLoadedInMemory,
    ensureRowsLoaded,
  ]);

  const cellRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const tabUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Selection management helpers
  const getVisibleColumns = useCallback(() => {
    return table.getAllColumns().filter(col => col.getIsVisible() && col.id !== 'select');
  }, [table]);

  const updateSelection = useCallback(
    (position: CellPosition, extendSelection: boolean = false) => {
      if (extendSelection && selectionAnchor) {
        // Extending selection from anchor
        setSelectionMode('extending');
        setCellSelection({
          start: selectionAnchor,
          end: position,
        });
        setFocusedCell(position);
      } else {
        // New single cell selection
        setSelectionMode('single');
        setSelectionAnchor(position);
        setFocusedCell(position);
        setCellSelection(null);
      }
    },
    [selectionAnchor]
  );

  const clearSelection = useCallback(() => {
    setSelectionMode('single');
    setCellSelection(null);
    setSelectionAnchor(null);
  }, []);

  const isCellSelected = useCallback(
    (rowIndex: number, columnId: string): boolean => {
      if (!cellSelection) return false;
      const visibleColumns = getVisibleColumns().map(col => col.id);
      return isCellInRange({ rowIndex, columnId }, cellSelection, visibleColumns);
    },
    [cellSelection, getVisibleColumns]
  );

  // Mouse drag selection handlers
  const isDraggingRef = useRef(false);
  const dragStartCellRef = useRef<CellPosition | null>(null);

  const handleCellMouseDown = useCallback(
    (e: React.MouseEvent, rowIndex: number, columnId: string) => {
      // Don't start drag if clicking on input or if it's a right click
      if (e.button !== 0 || (e.target as HTMLElement).tagName === 'INPUT') {
        return;
      }

      const cell: CellPosition = { rowIndex, columnId };

      if (e.shiftKey && selectionAnchor) {
        // Shift+Click: Extend selection from anchor
        setSelectionMode('extending');
        setCellSelection({
          start: selectionAnchor,
          end: cell,
        });
        setFocusedCell(cell);
      } else {
        // Regular click: Start new selection
        isDraggingRef.current = true;
        dragStartCellRef.current = cell;
        setSelectionAnchor(cell);
        setFocusedCell(cell);
        setCellSelection(null);
        setSelectionMode('single');
      }
    },
    [selectionAnchor]
  );

  const handleCellMouseEnter = useCallback(
    (e: React.MouseEvent, rowIndex: number, columnId: string) => {
      if (!isDraggingRef.current || !dragStartCellRef.current) return;

      const cell: CellPosition = { rowIndex, columnId };
      setSelectionMode('extending');
      setCellSelection({
        start: dragStartCellRef.current,
        end: cell,
      });
      setFocusedCell(cell);
    },
    []
  );

  // Handle mouse up to end drag
  useEffect(() => {
    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        if (dragStartCellRef.current && cellSelection) {
          // Selection is complete
          setSelectionMode('range');
        }
        dragStartCellRef.current = null;
      }
    };

    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [cellSelection]);

  // Ensure the focused cell is in view - optimized to use refs instead of DOM queries
  useEffect(() => {
    if (!focusedCell || !tableContainerRef.current) return;

    // Use refs instead of expensive DOM queries
    const cellRef = cellRefs.current.get(`${focusedCell.rowIndex}-${focusedCell.columnId}`);
    if (!cellRef) return;

    const container = tableContainerRef.current;

    // Use requestAnimationFrame to batch DOM reads/writes
    requestAnimationFrame(() => {
      // Get container dimensions
      const containerRect = container.getBoundingClientRect();
      const cellRect = cellRef.getBoundingClientRect();

      // Calculate if the cell is outside the visible area
      const isAbove = cellRect.top < containerRect.top;
      const isBelow = cellRect.bottom > containerRect.bottom;
      const isLeft = cellRect.left < containerRect.left;
      const isRight = cellRect.right > containerRect.right;

      // Only scroll if the cell is not fully visible
      if (isAbove || isBelow || isLeft || isRight) {
        container.scrollBy({
          top: isAbove
            ? cellRect.top - containerRect.top
            : isBelow
              ? cellRect.bottom - containerRect.bottom
              : 0,
          left: isLeft
            ? cellRect.left - containerRect.left
            : isRight
              ? cellRect.right - containerRect.right
              : 0,
          behavior: 'auto',
        });
      }

      // Focus the cell
      cellRef.focus();
    });
  }, [focusedCell]);

  const addEmptyRows = useCallback(() => {
    setIsLoading(true);
    requestAnimationFrame(() => {
      setData(prevData => [
        ...prevData,
        ...Array(ROWS_PER_BATCH)
          .fill(null)
          .map((_, index) => ({
            id: `row-${prevData.length + index}`,
          })),
      ]);
      setIsLoading(false);
    });
  }, []);

  const addExtraColumns = useCallback(() => {
    setExtraColumnsCount(prev => prev + EXTRA_COLUMNS);
  }, []);

  // Debounced scroll handler to prevent excessive fetch triggers
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (totalRowCount && dataLengthRef.current >= totalRowCount) {
        return;
      }

      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      scrollTimeoutRef.current = setTimeout(() => {
        const target = e.target as HTMLDivElement;
        const { scrollHeight, scrollTop, clientHeight, scrollWidth, scrollLeft, clientWidth } =
          target;

        // Skip if we don't have valid dimensions
        if (scrollHeight === 0 || clientHeight === 0) {
          return;
        }

        const allRowsLoaded = !!totalRowCount && dataLengthRef.current >= totalRowCount;

        // Vertical scroll check
        const verticalScrollPercentage = (scrollTop + clientHeight) / scrollHeight;

        // Prefetch trigger - start prefetching at 30% scroll
        if (
          !allRowsLoaded &&
          verticalScrollPercentage > PREFETCH_THRESHOLD &&
          !isPrefetchingRef.current
        ) {
          if (isFileMode && lastLoadedRowRef.current < (totalRowCount || 0)) {
            prefetchNextPage();
          }
        }

        if (allRowsLoaded) {
          const horizontalScrollPercentage = (scrollLeft + clientWidth) / scrollWidth;
          if (horizontalScrollPercentage > SCROLL_PERCENTAGE_THRESHOLD) {
            addExtraColumns();
          }
          return;
        }

        // Load trigger - use a more intelligent approach
        // Instead of percentage, check if we're near the bottom of currently loaded data
        const rowsPerPage = Math.max(1, Math.floor(clientHeight / ROW_HEIGHT_PX));
        const currentLoadedRows = lastLoadedRowRef.current;
        const virtualScrollPosition = Math.floor(scrollTop / ROW_HEIGHT_PX);

        // Load more data when we're within 3 viewports of the end of loaded data
        const shouldLoadMore = virtualScrollPosition + rowsPerPage * 3 >= currentLoadedRows;

        // Only trigger if not already loading and we haven't loaded all rows
        if (
          shouldLoadMore &&
          !isLoading &&
          !loadingRef.current &&
          isFileMode &&
          lastLoadedRowRef.current < (totalRowCount || 0)
        ) {
          // Double-check we're not already loading to prevent duplicate calls
          if (!loadingRef.current) {
            loadingRef.current = true; // Set immediately to prevent race conditions
            fetchMoreRows().finally(() => {
              loadingRef.current = false;
            });
          }
        } else if (shouldLoadMore && lastLoadedRowRef.current >= (totalRowCount || 0)) {
          // Only add empty rows if we've loaded all data
          addEmptyRows();
        }

        // Also check if we're scrolling to unloaded rows and trigger fetch
        // This handles fast scrolling past loaded data
        if (
          isFileMode &&
          virtualScrollPosition >= currentLoadedRows - 50 &&
          !isLoading &&
          !loadingRef.current &&
          lastLoadedRowRef.current < (totalRowCount || 0)
        ) {
          if (!loadingRef.current) {
            loadingRef.current = true;
            fetchMoreRows().finally(() => {
              loadingRef.current = false;
            });
          }
        }

        // Fallback to percentage-based loading for edge cases
        // Only use this if the row-based calculation didn't trigger
        if (
          !shouldLoadMore &&
          verticalScrollPercentage > SCROLL_PERCENTAGE_THRESHOLD &&
          !isLoading &&
          !loadingRef.current &&
          isFileMode &&
          lastLoadedRowRef.current < (totalRowCount || 0)
        ) {
          // Double-check we're not already loading
          if (!loadingRef.current) {
            loadingRef.current = true;
            fetchMoreRows().finally(() => {
              loadingRef.current = false;
            });
          }
        } else if (
          !shouldLoadMore &&
          verticalScrollPercentage > SCROLL_PERCENTAGE_THRESHOLD &&
          lastLoadedRowRef.current >= (totalRowCount || 0)
        ) {
          // Only add empty rows if we've loaded all data
          addEmptyRows();
        }

        // Horizontal scroll check
        const horizontalScrollPercentage = (scrollLeft + clientWidth) / scrollWidth;
        if (horizontalScrollPercentage > SCROLL_PERCENTAGE_THRESHOLD) {
          addExtraColumns();
        }
      }, 32);
    },
    [isLoading, isFileMode, fetchMoreRows, addEmptyRows, totalRowCount, prefetchNextPage]
  );

  // Cleanup scroll timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange(rowSelection);
    }
  }, [rowSelection, onSelectionChange]);

  useEffect(() => {
    if (!onSheetStatusChange) return;

    const dataColumns = table.getAllColumns().filter(col => col.id !== 'select');
    const visibleColumns = getVisibleColumns().length;
    const totalColumns = dataColumns.length;

    let cellRef: string | null = null;
    if (focusedCell) {
      const column = table.getColumn(focusedCell.columnId);
      const header = column?.columnDef.header;
      const label =
        typeof header === 'string'
          ? header
          : typeof header === 'function'
            ? focusedCell.columnId
            : focusedCell.columnId;
      cellRef = `${label}${focusedCell.rowIndex + 1}`;
    }

    let selectionCount: number | null = null;
    let selectionSum: number | null = null;
    let selectionAvg: number | null = null;
    if (cellSelection) {
      const visibleColumnIds = getVisibleColumns().map(c => c.id);
      const cells = getCellsInRange(cellSelection, visibleColumnIds);
      const nums: number[] = [];
      for (const cell of cells) {
        const row = data[cell.rowIndex];
        if (!row) continue;
        const raw = row[cell.columnId];
        if (raw == null || raw === '') continue;
        const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/,/g, ''));
        if (Number.isFinite(n)) nums.push(n);
      }
      if (nums.length) {
        selectionCount = nums.length;
        selectionSum = nums.reduce((a, b) => a + b, 0);
        selectionAvg = selectionSum / nums.length;
      } else if (cells.length) {
        selectionCount = cells.length;
      }
    }

    onSheetStatusChange({
      visibleColumns,
      totalColumns,
      cellRef,
      selectionCount,
      selectionSum,
      selectionAvg,
    });
  }, [
    focusedCell,
    cellSelection,
    data,
    columnVisibility,
    table,
    getVisibleColumns,
    onSheetStatusChange,
  ]);

  const saveSpreadsheetState = useCallback(
    _.debounce(() => {
      if (!tabId || !activeTab) return;

      // Update initialColumns directly to ensure they have proper header values
      if (activeTab.data && activeTab.data.initialColumns) {
        const updatedColumns = activeTab.data.initialColumns.map((col: Column) => {
          // Find the matching column in the current table
          const tableColumn = table.getColumn(col.id);
          if (tableColumn && tableColumn.columnDef.header) {
            // Ensure header is a string
            const headerValue =
              typeof tableColumn.columnDef.header === 'string'
                ? tableColumn.columnDef.header
                : `Column ${col.id.replace(/\D/g, '')}`;

            return {
              ...col,
              header: headerValue,
            };
          }
          return col;
        });

        // Update tab with correct columns
        updateTab(tabId, {
          data: {
            ...activeTab.data,
            initialColumns: updatedColumns,
          },
        });
      }
    }, 500),
    [tabId, activeTab, table, updateTab]
  );

  const handleHeaderEdit = useCallback(
    (columnId: string, value: string) => {
      // Update column header to be a string
      table.getAllColumns().forEach(column => {
        if (column.id === columnId) {
          // Ensure header is set as a string
          column.columnDef.header = value;
        }
      });

      // Immediately update the actual initialColumns in the tab data
      if (tabId && activeTab?.data?.initialColumns) {
        const updatedColumns = activeTab.data.initialColumns.map((col: Column) => {
          if (col.id === columnId) {
            return {
              ...col,
              header: value,
            };
          }
          return col;
        });

        // Update the tab data with new columns
        updateTab(tabId, {
          data: {
            ...activeTab.data,
            initialColumns: updatedColumns,
          },
          isDirty: true,
        });
      }

      // Also save spreadsheet state for consistency
      saveSpreadsheetState();
    },
    [table, tabId, activeTab, updateTab, saveSpreadsheetState]
  );

  useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange(rowSelection);
    }
  }, [rowSelection, onSelectionChange]);

  // Reset extra columns when initial columns change
  useEffect(() => {
    setExtraColumnsCount(EXTRA_COLUMNS);
  }, [initialColumns]);

  const { wsReady, currentSession, ws } = useSession();

  useEffect(() => {
    // When joining a session, send a tab registration message
    if (wsReady && currentSession && ws) {
      ws.send(
        JSON.stringify({
          type: 'register_tab',
          sessionId: currentSession.id,
          tabId,
          filePath: decodedFilePath,
        })
      );
    }
  }, [wsReady, currentSession, ws, tabId, decodedFilePath]);

  // Only measure virtualization when data length actually changes, not on every render
  // DO NOT trigger fetchMoreRows here - that causes infinite loops
  // Let the scroll handler manage pagination instead
  useEffect(() => {
    const currentDataLength = data.length;
    const previousLength = previousDataLengthRef.current;

    // Only proceed if data length actually changed
    if (currentDataLength !== previousLength) {
      previousDataLengthRef.current = currentDataLength;

      // Force virtualization recalculation only
      // Don't trigger fetchMoreRows here - the scroll handler will do that
      rowVirtualizer.measure();
    }
  }, [data.length, rowVirtualizer]);

  // Update the message handler to be more forgiving with tabIds
  useEffect(() => {
    if (!ws) {
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);

        // Handle cell updates for any tab viewing the same file
        if (message.type === 'cell_update' && currentSession) {
          // Apply the update if we're not the sender
          // WebSocket updates are non-urgent - use transition to keep UI responsive
          if (message.userId !== wsService.userId) {
            startTransition(() => {
              setData(prevData => {
                const newData = [...prevData];
                if (!newData[message.rowIndex]) {
                  newData[message.rowIndex] = { id: `row-${message.rowIndex}` };
                }
                newData[message.rowIndex] = {
                  ...newData[message.rowIndex],
                  [message.columnId]: message.value,
                };
                return newData;
              });
            });
          }
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    };

    ws.addEventListener('message', handleMessage);

    // Request sync when connecting
    if (wsReady && currentSession?.id && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'sync_request',
          sessionId: currentSession.id,
          tabId,
          userId: wsService.userId,
        })
      );
    }

    return () => {
      ws.removeEventListener('message', handleMessage);
    };
  }, [ws, wsReady, currentSession, tabId]);

  // Handle keyboard shortcuts for sorting
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!focusedCell) return;

      // Get the current column
      const column = table.getColumn(focusedCell.columnId);
      if (!column) return;

      // Command + Arrow Up/Down for sorting
      if (e.metaKey && !e.shiftKey && !e.altKey) {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          column.toggleSorting(false);
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          column.toggleSorting(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedCell, table]);

  // Update the handleCellEdit function - optimized to avoid expensive operations
  const handleCellEdit = useCallback(
    async (rowIndex: number, columnId: string, value: any) => {
      // If the columnId has [object Object] in it, use the numeric part instead
      const useColumnId = /object Object/.test(columnId)
        ? columnId.replace(/\[object Object\](_duplicated_)?/, '')
        : columnId;

      // If sheetId is available, use sheet operations for real-time collaboration
      if (sheetId && applySheetOperation && sheetState) {
        try {
          const currentValue = data[rowIndex]?.[useColumnId];
          const op = {
            kind: 'update_cell' as const,
            row: rowIndex,
            column: useColumnId,
            oldValue: currentValue,
            newValue: value,
          };
          const success = await applySheetOperation(op);
          // If operation succeeded, still update local state for immediate UI feedback
          // The sheet state will sync back via WebSocket, but we want immediate updates
          if (success) {
            // Update local state for immediate feedback
            setData(prevData => {
              const newData = [...prevData];
              if (!newData[rowIndex]) {
                newData[rowIndex] = { id: `row-${rowIndex}` };
              }
              newData[rowIndex] = {
                ...newData[rowIndex],
                [useColumnId]: value,
              };
              return newData;
            });
            // Still update tab data
            if (tabId && activeTab?.data) {
              if (tabUpdateTimeoutRef.current) {
                clearTimeout(tabUpdateTimeoutRef.current);
              }
              tabUpdateTimeoutRef.current = setTimeout(() => {
                setData(currentData => {
                  const rowToUpdate = currentData[rowIndex];
                  if (rowToUpdate && activeTab?.data) {
                    const updatedRow = { ...rowToUpdate, [useColumnId]: value };
                    updateTab(tabId, {
                      data: {
                        ...activeTab.data,
                        initialData: activeTab.data.initialData
                          ? activeTab.data.initialData.map((row, idx) =>
                              idx === rowIndex ? updatedRow : row
                            )
                          : [updatedRow],
                      },
                      isDirty: true,
                    });
                  }
                  return currentData;
                });
              }, 300);
            }
            return;
          }
        } catch (error) {
          console.error('Failed to apply sheet operation:', error);
          // Fall through to local update as fallback
        }
      }

      // Update local state immediately with the cleaned column ID
      setData(prevData => {
        const newData = [...prevData];
        if (!newData[rowIndex]) {
          newData[rowIndex] = { id: `row-${rowIndex}` };
        }
        newData[rowIndex] = {
          ...newData[rowIndex],
          [useColumnId]: value,
        };
        return newData;
      });

      // Mark tab as dirty and update tab data - optimized to avoid mapping all data on every edit
      // Use a debounced update to batch multiple edits
      if (tabId && activeTab?.data) {
        // Clear any pending update
        if (tabUpdateTimeoutRef.current) {
          clearTimeout(tabUpdateTimeoutRef.current);
        }

        // Debounce tab updates to batch multiple cell edits
        tabUpdateTimeoutRef.current = setTimeout(() => {
          // Get current data from state at the time of update
          setData(currentData => {
            const rowToUpdate = currentData[rowIndex];
            if (rowToUpdate && activeTab?.data) {
              const updatedRow = { ...rowToUpdate, [useColumnId]: value };

              // Update tab with minimal data change - only update the specific row
              updateTab(tabId, {
                data: {
                  ...activeTab.data,
                  initialData: activeTab.data.initialData
                    ? activeTab.data.initialData.map((row, idx) =>
                        idx === rowIndex ? updatedRow : row
                      )
                    : [updatedRow],
                },
                isDirty: true,
              });
            }
            return currentData; // Return unchanged to avoid re-render
          });
        }, 300); // 300ms debounce for tab updates
      }

      // Send update via WebSocket service if connected
      if (wsReady && currentSession) {
        wsService.sendCellUpdate(tabId, rowIndex, useColumnId, value);
      }
    },
    [
      tabId,
      activeTab,
      updateTab,
      wsReady,
      currentSession,
      sheetId,
      applySheetOperation,
      sheetState,
      data,
    ]
  );

  // Clipboard handlers
  const handleCopy = useCallback(() => {
    if (!focusedCell) return;

    const visibleColumns = getVisibleColumns();
    const visibleColumnIds = visibleColumns.map(col => col.id);

    // If there's a range selection, copy the entire range
    if (cellSelection) {
      const cells = getCellsInRange(cellSelection, visibleColumnIds);
      const startRow = Math.min(cellSelection.start.rowIndex, cellSelection.end.rowIndex);
      const endRow = Math.max(cellSelection.start.rowIndex, cellSelection.end.rowIndex);
      const startColIndex = visibleColumnIds.indexOf(cellSelection.start.columnId);
      const endColIndex = visibleColumnIds.indexOf(cellSelection.end.columnId);
      const minColIndex = Math.min(startColIndex, endColIndex);
      const maxColIndex = Math.max(startColIndex, endColIndex);

      const rowCount = endRow - startRow + 1;
      const columnCount = maxColIndex - minColIndex + 1;
      const clipboardData: string[][] = [];

      for (let rowOffset = 0; rowOffset < rowCount; rowOffset++) {
        const row: string[] = [];
        for (let colOffset = 0; colOffset < columnCount; colOffset++) {
          const rowIndex = startRow + rowOffset;
          const columnId = visibleColumnIds[minColIndex + colOffset];
          const value = data[rowIndex]?.[columnId] ?? '';
          row.push(String(value));
        }
        clipboardData.push(row);
      }

      copyToClipboard({
        type: 'cells',
        data: clipboardData,
        rowCount,
        columnCount,
      });
    } else {
      // Single cell copy
      const cellValue = data[focusedCell.rowIndex]?.[focusedCell.columnId] ?? '';
      copyToClipboard({
        type: 'cells',
        data: [[String(cellValue)]],
        rowCount: 1,
        columnCount: 1,
      });
    }
  }, [focusedCell, cellSelection, data, getVisibleColumns, copyToClipboard]);

  const handleCut = useCallback(() => {
    if (!focusedCell) return;

    const visibleColumns = getVisibleColumns();
    const visibleColumnIds = visibleColumns.map(col => col.id);

    // If there's a range selection, cut the entire range
    if (cellSelection) {
      const cells = getCellsInRange(cellSelection, visibleColumnIds);
      const startRow = Math.min(cellSelection.start.rowIndex, cellSelection.end.rowIndex);
      const endRow = Math.max(cellSelection.start.rowIndex, cellSelection.end.rowIndex);
      const startColIndex = visibleColumnIds.indexOf(cellSelection.start.columnId);
      const endColIndex = visibleColumnIds.indexOf(cellSelection.end.columnId);
      const minColIndex = Math.min(startColIndex, endColIndex);
      const maxColIndex = Math.max(startColIndex, endColIndex);

      const rowCount = endRow - startRow + 1;
      const columnCount = maxColIndex - minColIndex + 1;
      const clipboardData: string[][] = [];

      for (let rowOffset = 0; rowOffset < rowCount; rowOffset++) {
        const row: string[] = [];
        for (let colOffset = 0; colOffset < columnCount; colOffset++) {
          const rowIndex = startRow + rowOffset;
          const columnId = visibleColumnIds[minColIndex + colOffset];
          const value = data[rowIndex]?.[columnId] ?? '';
          row.push(String(value));
        }
        clipboardData.push(row);
      }

      cutToClipboard(
        {
          type: 'cells',
          data: clipboardData,
          rowCount,
          columnCount,
        },
        cellSelection.start
      );
    } else {
      // Single cell cut
      const cellValue = data[focusedCell.rowIndex]?.[focusedCell.columnId] ?? '';
      cutToClipboard(
        {
          type: 'cells',
          data: [[String(cellValue)]],
          rowCount: 1,
          columnCount: 1,
        },
        focusedCell
      );
    }
  }, [focusedCell, cellSelection, data, getVisibleColumns, cutToClipboard]);

  const handlePaste = useCallback(() => {
    if (!focusedCell) return;

    const clipboardData = pasteFromClipboard();
    if (!clipboardData || clipboardData.type !== 'cells') return;

    const visibleColumns = getVisibleColumns();
    const startColumnIndex = visibleColumns.findIndex(col => col.id === focusedCell.columnId);
    if (startColumnIndex === -1) return;

    // Handle paste - update cells starting from focused cell
    setData(prevData => {
      const newData = [...prevData];

      for (let rowOffset = 0; rowOffset < clipboardData.rowCount; rowOffset++) {
        const targetRowIndex = focusedCell.rowIndex + rowOffset;
        if (targetRowIndex >= newData.length) {
          // Add new rows if needed
          newData.push({ id: `row-${targetRowIndex}` });
        }

        for (let colOffset = 0; colOffset < clipboardData.columnCount; colOffset++) {
          const targetColumnIndex = startColumnIndex + colOffset;
          if (targetColumnIndex >= visibleColumns.length) break;

          const targetColumnId = visibleColumns[targetColumnIndex].id;
          const value = clipboardData.data[rowOffset]?.[colOffset] ?? '';

          if (!newData[targetRowIndex]) {
            newData[targetRowIndex] = { id: `row-${targetRowIndex}` };
          }

          newData[targetRowIndex] = {
            ...newData[targetRowIndex],
            [targetColumnId]: value,
          };
        }
      }

      return newData;
    });

    // Update tab data after paste
    if (tabId && activeTab?.data) {
      // Debounce tab update for paste
      if (tabUpdateTimeoutRef.current) {
        clearTimeout(tabUpdateTimeoutRef.current);
      }

      tabUpdateTimeoutRef.current = setTimeout(() => {
        setData(currentData => {
          if (activeTab?.data) {
            updateTab(tabId, {
              data: {
                ...activeTab.data,
                initialData: currentData,
              },
              isDirty: true,
            });
          }
          return currentData;
        });
      }, 300);
    }

    // If this was a cut operation, clear the source cells after paste
    if (clipboardIsCut()) {
      const cutOrigin = getCutOrigin();
      if (
        cutOrigin &&
        !(
          cutOrigin.rowIndex === focusedCell.rowIndex && cutOrigin.columnId === focusedCell.columnId
        )
      ) {
        // Clear the original cells that were cut (if pasting to different location)
        setData(prevData => {
          const newData = [...prevData];
          if (newData[cutOrigin.rowIndex]) {
            newData[cutOrigin.rowIndex] = {
              ...newData[cutOrigin.rowIndex],
              [cutOrigin.columnId]: '',
            };
          }
          return newData;
        });
      }
      clearClipboard();
    }
  }, [
    focusedCell,
    getVisibleColumns,
    pasteFromClipboard,
    clipboardIsCut,
    clearClipboard,
    getCutOrigin,
    tabId,
    activeTab,
    updateTab,
  ]);

  const handleDelete = useCallback(() => {
    if (!focusedCell) return;

    handleCellEdit(focusedCell.rowIndex, focusedCell.columnId, '');
  }, [focusedCell, handleCellEdit]);

  const handleSelectRow = useCallback(
    (rowIndex: number) => {
      setRowSelection({ [rowIndex]: true });
      const visibleColumns = getVisibleColumns();
      const firstDataColumn = visibleColumns.find(col => col.id !== 'select');
      if (firstDataColumn) {
        setFocusedCell({ rowIndex, columnId: firstDataColumn.id });
      }
    },
    [getVisibleColumns]
  );

  const handleCellContextMenu = useCallback(
    (rowIndex: number, columnId: string) => {
      setCtxMenuRowIndex(rowIndex);
      setCtxMenuColumnId(columnId);
      if (columnId === 'select') {
        handleSelectRow(rowIndex);
      } else {
        setFocusedCell({ rowIndex, columnId });
      }
    },
    [handleSelectRow]
  );

  const handleFill = useCallback(
    async (cells: CellPosition[], values: (string | number)[]) => {
      setData(prevData => {
        const newData = [...prevData];
        cells.forEach((cell, index) => {
          if (!newData[cell.rowIndex]) {
            newData[cell.rowIndex] = { id: `row-${cell.rowIndex}` };
          }
          newData[cell.rowIndex] = {
            ...newData[cell.rowIndex],
            [cell.columnId]: values[index] ?? '',
          };
          // Fire-and-forget async call for sheet operations
          handleCellEdit(cell.rowIndex, cell.columnId, values[index] ?? '').catch(err =>
            console.error('Error in handleCellEdit during fill:', err)
          );
        });
        return newData;
      });

      // Update tab data after fill
      if (tabId && activeTab?.data) {
        if (tabUpdateTimeoutRef.current) {
          clearTimeout(tabUpdateTimeoutRef.current);
        }
        tabUpdateTimeoutRef.current = setTimeout(() => {
          setData(currentData => {
            if (activeTab?.data) {
              updateTab(tabId, {
                data: {
                  ...activeTab.data,
                  initialData: currentData,
                },
                isDirty: true,
              });
            }
            return currentData;
          });
        }, 300);
      }
    },
    [tabId, activeTab, updateTab, handleCellEdit]
  );

  // Column action handler
  const handleColumnAction = useCallback(
    async (action: string, columnId: string) => {
      const datasetId = gridDatasetId || tabId;
      const stats = mergedColumnStats[columnId];
      const column = initialColumns.find(col => col.id === columnId);
      const columnType = stats?.data_type || (column as any)?.type || 'unknown';

      switch (action) {
        case 'show-insight':
          // Set selected column - this will trigger Inspector pane if available
          setSelectedColumnId(columnId);
          break;
        case 'suggest-transformations':
          setCurrentColumnForTransformation(columnId);
          setTransformationLoading(true);
          setTransformationModalOpen(true);
          try {
            const response = await apiClient.ai.suggestTransformations({
              datasetId,
              columnId,
              columnType,
              stats,
              teachingMode: activeTab?.data?.teachingMode || false,
            } as any);
            setTransformations(response.transformations || []);
          } catch (error) {
            console.error('Failed to get transformations', error);
            setTransformations([]);
          } finally {
            setTransformationLoading(false);
          }
          break;
        case 'clean-categories':
          setCurrentColumnForCategoryClean(columnId);
          setCategoryCleanerLoading(true);
          setCategoryCleanerOpen(true);
          try {
            // Get unique values from the column
            const uniqueValues = Array.from(
              new Set(
                data
                  .map(row => row[columnId])
                  .filter(val => val !== null && val !== undefined && val !== '')
              )
            ).map(String);

            const response = await apiClient.ai.cleanCategories({
              datasetId,
              columnId,
              uniqueValues,
            });
            setCategoryMappings(response.mapping || []);
          } catch (error) {
            console.error('Failed to clean categories', error);
            setCategoryMappings([]);
          } finally {
            setCategoryCleanerLoading(false);
          }
          break;
        case 'detect-outliers':
          try {
            const response = await apiClient.ai.detectOutliers({
              datasetId,
              columnId,
              stats,
            });

            // Mark outlier rows (we'd need to check actual values against bounds)
            // Highlight outliers - this is a simplified version
            // In a full implementation, we'd iterate through data and mark rows
          } catch (error) {
            console.error('Failed to detect outliers', error);
          }
          break;
        case 'check-relationships':
          // Set selected column and open relationships tab in Inspector
          setSelectedColumnId(columnId);
          break;

        case 'filter':
          onRequestShowFilters?.();
          requestAnimationFrame(() => {
            window.dispatchEvent(
              new CustomEvent(SPREADSHEET_EVENTS.FILTER_FOCUS, {
                detail: { columnId, showFilters: true },
              })
            );
          });
          break;

        case 'toggle-heatmap': {
          if (!activeTab?.data) break;
          const prev = activeTab.data.heatmapColumns ?? {};
          updateTab(activeTab.id, {
            data: {
              ...activeTab.data,
              heatmapColumns: {
                ...prev,
                [columnId]: !prev[columnId],
              },
            },
          });
          break;
        }

        case 'copy-column': {
          const values = (tableData as Record<string, unknown>[]).map(row => {
            const v = row[columnId];
            return v === null || v === undefined ? '' : String(v);
          });
          try {
            await navigator.clipboard.writeText(values.join('\n'));
            toast({ title: 'Column copied', description: `${values.length} values copied.` });
          } catch {
            toast({
              title: 'Copy failed',
              description: 'Could not access the clipboard.',
              variant: 'destructive',
            });
          }
          break;
        }

        case 'toggle-freeze-column': {
          if (!activeTab?.data) break;
          const next = activeTab.data.freezeUpToColumnId === columnId ? null : columnId;
          updateTab(activeTab.id, {
            data: {
              ...activeTab.data,
              freezeUpToColumnId: next,
            },
          });
          break;
        }

        case 'hide-column':
          // Visibility was already toggled in the dropdown; surface a toast so users
          // know how to recover (and don't think the column was deleted).
          toast({
            title: 'Column hidden',
            description: `"${column?.header || columnId}" was hidden. Use "Show hidden columns" in any column header to bring it back.`,
          });
          break;

        case 'show-hidden-columns': {
          const hiddenCols = table
            .getAllLeafColumns()
            .filter(c => c.id !== 'select' && !c.getIsVisible());
          if (hiddenCols.length === 0) {
            toast({ title: 'No hidden columns' });
            break;
          }
          for (const c of hiddenCols) c.toggleVisibility(true);
          toast({
            title: 'Showed hidden columns',
            description: `${hiddenCols.length} column${hiddenCols.length === 1 ? '' : 's'} restored.`,
          });
          break;
        }

        case 'group-by':
        case 'aggregate-by':
          // No bespoke grouping UI yet — open the Aggregate / Compute Variable
          // dialog which is the closest available flow.
          useAnalysisSetupStore.getState().openDialog('Aggregate Data');
          break;

        case 'delete-column': {
          if (!activeTab || !activeTab.data) {
            toast({ title: "Can't delete", description: 'No active tab.' });
            break;
          }
          const cols = activeTab.data.initialColumns ?? [];
          const target = cols.find(c => c.id === columnId);
          if (!target) {
            toast({ title: "Can't delete", description: 'Column not found.' });
            break;
          }
          if (cols.length <= 1) {
            toast({
              title: "Can't delete the last column",
              description: 'A dataset needs at least one column.',
            });
            break;
          }

          recordTabSnapshot(activeTab.id, `Delete column ${target.header}`);

          const nextCols = cols.filter(c => c.id !== columnId);
          const nextRows = (activeTab.data.initialData ?? []).map(row => {
            const { [columnId]: _drop, ...rest } = row;
            return rest;
          });
          updateTab(activeTab.id, {
            data: {
              ...activeTab.data,
              initialColumns: nextCols,
              initialData: nextRows,
              totalColumns: nextCols.length,
            },
            isDirty: true,
          });

          const liveNote = activeTab.data?.sheetId
            ? ' (live-collab tab — applied locally, not broadcast)'
            : '';
          toast({
            title: `Deleted column "${target.header}"`,
            description: `Press ⌘Z to undo.${liveNote}`,
          });
          break;
        }

        default:
          break;
      }
    },
    [
      filePath,
      tabId,
      tableData,
      mergedColumnStats,
      initialColumns,
      data,
      activeTab,
      table,
      onRequestShowFilters,
      updateTab,
    ]
  );

  const headerComponentProps = {
    table,
    showStats,
    columnStats: mergedColumnStats,
    initialColumns,
    columnSampleValues,
    onHeaderEdit: handleHeaderEdit,
    isLoadingStats,
    onColumnAction: handleColumnAction,
    datasetId: gridDatasetId || tabId,
    metadataDatasetId: gridDatasetId,
    columnMetadata,
    onMeasurementLevelChange: handleMeasurementLevelChange,
    heatmapColumns,
    freezeUpToColumnId,
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for clipboard shortcuts (only when not in input field)
      const isInputFocused =
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA';
      const isModifierKey = e.metaKey || e.ctrlKey;

      if (isModifierKey && !isInputFocused && focusedCell) {
        if (e.key === 'c' || e.key === 'C') {
          e.preventDefault();
          handleCopy();
          return;
        }
        if (e.key === 'x' || e.key === 'X') {
          e.preventDefault();
          handleCut();
          return;
        }
        if (e.key === 'v' || e.key === 'V') {
          e.preventDefault();
          handlePaste();
          return;
        }
      }

      // Delete key
      if (e.key === 'Delete' && !isInputFocused && focusedCell) {
        e.preventDefault();
        handleDelete();
        return;
      }

      // Handle Excel-style selection shortcuts
      if (focusedCell && !isInputFocused) {
        // Ctrl/Cmd + Space: Select entire column
        if (isModifierKey && e.key === ' ') {
          e.preventDefault();
          const visibleColumns = table
            .getAllColumns()
            .filter(col => col.getIsVisible() && col.id !== 'select');
          const currentColIndex = visibleColumns.findIndex(col => col.id === focusedCell.columnId);
          if (currentColIndex !== -1) {
            setSelectionAnchor({ rowIndex: 0, columnId: focusedCell.columnId });
            setCellSelection({
              start: { rowIndex: 0, columnId: focusedCell.columnId },
              end: { rowIndex: rows.length - 1, columnId: focusedCell.columnId },
            });
            setSelectionMode('range');
          }
          return;
        }

        // Shift + Space: Select entire row
        if (e.shiftKey && e.key === ' ' && !isModifierKey) {
          e.preventDefault();
          const visibleColumns = table
            .getAllColumns()
            .filter(col => col.getIsVisible() && col.id !== 'select');
          if (visibleColumns.length > 0) {
            setSelectionAnchor({ rowIndex: focusedCell.rowIndex, columnId: visibleColumns[0].id });
            setCellSelection({
              start: { rowIndex: focusedCell.rowIndex, columnId: visibleColumns[0].id },
              end: {
                rowIndex: focusedCell.rowIndex,
                columnId: visibleColumns[visibleColumns.length - 1].id,
              },
            });
            setSelectionMode('range');
          }
          return;
        }

        // Ctrl/Cmd + A: Select all cells
        if (isModifierKey && (e.key === 'a' || e.key === 'A')) {
          e.preventDefault();
          const visibleColumns = table
            .getAllColumns()
            .filter(col => col.getIsVisible() && col.id !== 'select');
          if (visibleColumns.length > 0 && rows.length > 0) {
            setSelectionAnchor({ rowIndex: 0, columnId: visibleColumns[0].id });
            setCellSelection({
              start: { rowIndex: 0, columnId: visibleColumns[0].id },
              end: {
                rowIndex: rows.length - 1,
                columnId: visibleColumns[visibleColumns.length - 1].id,
              },
            });
            setSelectionMode('range');
          }
          return;
        }

        // Ctrl/Cmd + Enter: Fill selected range with current value
        if (isModifierKey && e.key === 'Enter') {
          e.preventDefault();
          if (cellSelection && focusedCell) {
            const visibleColumns = getVisibleColumns().map(col => col.id);
            const cells = getCellsInRange(cellSelection, visibleColumns);
            const value = data[focusedCell.rowIndex]?.[focusedCell.columnId] ?? '';
            setData(prevData => {
              const newData = [...prevData];
              cells.forEach(cell => {
                if (!newData[cell.rowIndex]) {
                  newData[cell.rowIndex] = { id: `row-${cell.rowIndex}` };
                }
                newData[cell.rowIndex] = {
                  ...newData[cell.rowIndex],
                  [cell.columnId]: value,
                };
                // Fire-and-forget async call for sheet operations
                handleCellEdit(cell.rowIndex, cell.columnId, value).catch(err =>
                  console.error('Error in handleCellEdit during fill range:', err)
                );
              });
              return newData;
            });
          }
          return;
        }

        // Ctrl/Cmd + D: Fill down (copy from cell above)
        if (isModifierKey && (e.key === 'd' || e.key === 'D')) {
          e.preventDefault();
          if (focusedCell && focusedCell.rowIndex > 0) {
            const value = data[focusedCell.rowIndex - 1]?.[focusedCell.columnId] ?? '';
            handleCellEdit(focusedCell.rowIndex, focusedCell.columnId, value).catch(err =>
              console.error('Error in handleCellEdit during fill down:', err)
            );
          }
          return;
        }

        // Ctrl/Cmd + R: Fill right (copy from cell left)
        if (isModifierKey && (e.key === 'r' || e.key === 'R')) {
          e.preventDefault();
          if (focusedCell) {
            const visibleColumns = getVisibleColumns();
            const currentColIndex = visibleColumns.findIndex(
              col => col.id === focusedCell.columnId
            );
            if (currentColIndex > 0) {
              const leftColumnId = visibleColumns[currentColIndex - 1].id;
              const value = data[focusedCell.rowIndex]?.[leftColumnId] ?? '';
              handleCellEdit(focusedCell.rowIndex, focusedCell.columnId, value).catch(err =>
                console.error('Error in handleCellEdit during fill right:', err)
              );
            }
          }
          return;
        }
      }

      if (focusedCell) {
        handleKeyboardNavigation({
          e,
          focusedCell,
          table,
          rows,
          onPositionChange: newPosition => {
            updateSelection(newPosition, e.shiftKey);
            requestAnimationFrame(() => {
              const cellRef = cellRefs.current.get(
                `${newPosition.rowIndex}-${newPosition.columnId}`
              );
              if (cellRef) cellRef.focus();
            });
          },
          onRangeChange: range => {
            setCellSelection(range);
            if (range) {
              setSelectionMode('range');
            } else {
              setSelectionMode('single');
            }
          },
          selectionMode,
          selectionAnchor,
          extendSelection: e.shiftKey,
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [
    focusedCell,
    table,
    rows.length,
    handleCopy,
    handleCut,
    handlePaste,
    handleDelete,
    handleCellEdit,
    cellSelection,
    selectionMode,
    selectionAnchor,
    updateSelection,
    getVisibleColumns,
    data,
    rows,
  ]);

  useEffect(() => {
    return () => {
      saveSpreadsheetState.cancel();
      // Cleanup tab update timeout on unmount
      if (tabUpdateTimeoutRef.current) {
        clearTimeout(tabUpdateTimeoutRef.current);
      }
    };
  }, [saveSpreadsheetState]);

  // Sync filters from tab store when they change externally (e.g., agent panel).
  useEffect(() => {
    if (!activeTab?.data) return;
    const tabFilters = activeTab.data.columnFilters ?? [];
    const currentFiltersStr = JSON.stringify(columnFilters);
    const tabFiltersStr = JSON.stringify(tabFilters);
    if (tabFiltersStr === currentFiltersStr) return;

    setColumnFilters(tabFilters);
    if (!getDatasetIdFromPath(activeTab.data.filePath)) {
      if (tabFilters.length > 0) {
        fetchFilteredData(tabFilters);
      } else {
        setData([]);
        lastLoadedRowRef.current = 0;
        setPrefetchedData([]);
        prefetchedRowRangeRef.current = null;
        fetchMoreRows();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab?.data?.columnFilters]);

  return (
    <div
      className="flex h-full flex-col overflow-hidden"
      style={{
        // Ensure parent has constrained height for flex children
        minHeight: 0,
        height: '100%',
      }}
    >
      {showFilters && (
        <div className="border-b border-border bg-background">
          <Filters
            table={table}
            onClearFilters={() => {
              setColumnFilters([]);
              setData([]);
              lastLoadedRowRef.current = 0;
              // Clear prefetched data since filters were cleared
              setPrefetchedData([]);
              prefetchedRowRangeRef.current = null;
              fetchMoreRows();
            }}
            onCloseFilters={() => onCloseFilters?.()}
            onFetchFilteredData={fetchFilteredData}
          />
        </div>
      )}
      <div
        ref={tableContainerRef}
        onScroll={handleScroll}
        className="relative min-h-0 flex-1 overflow-auto"
        style={{
          width: '100%',
          position: 'relative',
          padding: 0,
          margin: 0,
        }}
      >
        {showInitialGridLoader ? (
          <div
            className="absolute inset-0 z-20 flex items-center justify-center bg-background"
            aria-busy="true"
            aria-live="polite"
            role="status"
          >
            <Loading />
          </div>
        ) : null}
        {/*
          Outer wrapper: sticky header + tall scroll-space div.
          The scroll-space div holds the full virtual height so the scrollbar
          is correct. Inside it the <table> body rows are in normal flow but
          shifted via translateY (official TanStack table virtualizer pattern).
          The background on the scroll-space div shows row/column grid lines
          even during fast-scroll before React can paint new rows.
        */}
        <table
          className="w-full border-collapse text-xs"
          style={{
            tableLayout: 'fixed',
            display: 'block',
            width: `${totalTableWidth}px`,
            minWidth: `${totalTableWidth}px`,
            padding: 0,
            margin: 0,
          }}
        >
          <TableHeader
            className="bg-muted/40"
            style={{
              display: 'block',
              position: 'sticky',
              top: 0,
              zIndex: 2,
            }}
          >
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow
                key={headerGroup.id}
                className="!border-none hover:bg-transparent"
                style={{
                  display: 'flex',
                  width: `${totalTableWidth}px`,
                  minWidth: `${totalTableWidth}px`,
                }}
              >
                {headerGroup.headers.map(header => (
                  <TableHead
                    key={header.id}
                    className={cn(
                      'sticky top-0 flex items-stretch whitespace-nowrap border-r border-b border-border/70 bg-muted/40 p-0 last:border-r-0',
                      header.id === 'select' && 'border-border'
                    )}
                    style={{
                      width: header.getSize() || 150,
                      minWidth: header.getSize() || 150,
                      flexShrink: 0,
                      height: showStats ? '250px' : '32px',
                      padding: 0,
                      ...(header.column.getIsPinned()
                        ? {
                            position: 'sticky',
                            left: header.column.getStart(header.column.getIsPinned() as 'left'),
                            zIndex: 4,
                          }
                        : {}),
                    }}
                  >
                    <HeaderComponent header={header} {...headerComponentProps} />
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          {/* Tall scroll-space div: creates the full virtual scroll height.
                Background shows grid lines during fast scroll before React re-paints. */}
          {/* Single shared ContextMenu for all rows — eliminates per-row Radix portals
                which were blocking the main thread for 400-600ms on every scroll. */}
          <ContextMenu>
            <ContextMenuTrigger asChild>
              <TableBody
                style={{
                  display: 'block',
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  position: 'relative',
                  width: '100%',
                }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow, index) => {
                  const rowIndex = virtualRow.index;
                  const placeholderColumns = gridColumns;
                  const isUnloadedRow =
                    hasUnloadedRows && rowIndex >= loadedRowCount && rowIndex < virtualizationCount;

                  // Per-row translateY offset for the TanStack table virtualizer pattern:
                  // rows are in normal flow so we subtract their natural stacked offset.
                  const translateY = virtualRow.start - index * virtualRow.size;

                  if (isUnloadedRow) {
                    return (
                      <VirtualSheetPlaceholderRow
                        key={`placeholder-${rowIndex}`}
                        rowIndex={rowIndex}
                        translateY={translateY}
                        columns={placeholderColumns}
                        rowHeightPx={ROW_HEIGHT_PX}
                      />
                    );
                  }

                  const row = rows[rowIndex];
                  if (!row) return null;

                  const isRowSelected = row.getIsSelected();
                  const isFocused = focusedCell?.rowIndex === rowIndex;

                  return (
                    <TableRow
                      key={row.id}
                      data-index={rowIndex}
                      className={cn(
                        isRowSelected && 'bg-primary/5',
                        highlightedRows.has(rowIndex) &&
                          'border-l-4 border-l-primary bg-primary/10',
                        selectedRowId === `row-${rowIndex}` && 'bg-primary/5',
                        '!border-b-0 hover:bg-transparent'
                      )}
                      style={{
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${translateY}px)`,
                        display: 'flex',
                        width: `${totalTableWidth}px`,
                        minWidth: `${totalTableWidth}px`,
                        borderBottom: 'none',
                        boxSizing: 'border-box',
                        backgroundColor: 'var(--background)',
                      }}
                    >
                      {row.getVisibleCells().map(cell => {
                        const columnId = cell.column.id;
                        const cellKey = `${rowIndex}-${columnId}`;
                        const isCellFocused = isFocused && focusedCell?.columnId === columnId;
                        const cellIsSelected = isCellSelected(rowIndex, columnId);
                        const colMeta = colMetaById.get(columnId);
                        const isNumericColumn = colIsNumericById.get(columnId) ?? false;

                        let heatmapBackgroundColor: string | undefined;
                        if (heatmapColumns[columnId] && columnId !== 'select') {
                          const scale = heatmapScales[columnId];
                          const n = parseNumericCellValue(cell.getValue());
                          if (scale && n !== null) {
                            heatmapBackgroundColor = heatmapBackgroundForValue(n, scale);
                          }
                        }

                        return (
                          <MemoizedTableCell
                            key={cell.id}
                            cell={cell}
                            rowIndex={rowIndex}
                            columnId={columnId}
                            cellKey={cellKey}
                            isCellFocused={isCellFocused}
                            isCellSelected={cellIsSelected}
                            isNumericColumn={isNumericColumn}
                            heatmapBackgroundColor={heatmapBackgroundColor}
                            cellRefs={cellRefs}
                            handleCellEdit={handleCellEdit}
                            setFocusedCell={setFocusedCell}
                            onMouseDown={handleCellMouseDown}
                            onMouseEnter={handleCellMouseEnter}
                            onCopy={handleCopy}
                            onCut={handleCut}
                            onPaste={handlePaste}
                            onDelete={handleDelete}
                            clipboardHasData={clipboardHasDataNow}
                            onSelectRow={handleSelectRow}
                            onCellContextMenu={handleCellContextMenu}
                          />
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </ContextMenuTrigger>
            {/* Single ContextMenuContent — reads ctxMenuRowIndex / ctxMenuColumnId on right-click */}
            <ContextMenuContent>
              {(() => {
                const ri = ctxMenuRowIndex;
                const ctxRow = ri !== null ? rows[ri] : null;
                if (!ctxRow || ri === null) return null;
                const rowData = ctxRow.original as Record<string, any>;
                const datasetId = gridDatasetId || tabId;
                const isRowGutter = ctxMenuColumnId === 'select';
                return (
                  <>
                    {(onInsertRow || onDeleteRows) && (
                      <>
                        {onInsertRow && (
                          <>
                            <ContextMenuItem onClick={() => onInsertRow(ri, 'above')}>
                              Insert row above
                            </ContextMenuItem>
                            <ContextMenuItem onClick={() => onInsertRow(ri, 'below')}>
                              Insert row below
                            </ContextMenuItem>
                          </>
                        )}
                        {onDeleteRows && (
                          <ContextMenuItem variant="destructive" onClick={() => onDeleteRows([ri])}>
                            Delete row
                          </ContextMenuItem>
                        )}
                        <ContextMenuSeparator />
                      </>
                    )}
                    <ContextMenuItem
                      onClick={async () => {
                        try {
                          setSelectedRowId(`row-${ri}`);
                          setSelectedRowData(rowData);
                          const response = await apiClient.ai.rowInsight({
                            datasetId,
                            rowId: `row-${ri}`,
                            rowData,
                            teachingMode: activeTab?.data?.teachingMode || false,
                          } as any);
                          setRowInsight(response);
                        } catch (error) {
                          console.error('Failed to get row insight', error);
                        }
                      }}
                    >
                      Why is this row unusual?
                    </ContextMenuItem>
                    <ContextMenuItem
                      onClick={async () => {
                        try {
                          setSelectedRowId(`row-${ri}`);
                          setSelectedRowData(rowData);
                          const response = await apiClient.ai.rowInsight({
                            datasetId,
                            rowId: `row-${ri}`,
                            rowData,
                            mode: 'similar',
                            teachingMode: activeTab?.data?.teachingMode || false,
                          } as any);
                          setRowInsight(response);
                          if (response?.similarRows && Array.isArray(response.similarRows)) {
                            setHighlightedRows(new Set(response.similarRows));
                          }
                        } catch (error) {
                          console.error('Failed to get similar rows insight', error);
                        }
                      }}
                    >
                      Show similar rows
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      onClick={async () => {
                        try {
                          setSelectedRowId(`row-${ri}`);
                          setSelectedRowData(rowData);
                          setCurrentRowIndexForFix(ri);
                          setRowFixLoading(true);
                          setRowFixModalOpen(true);
                          const response = await apiClient.ai.fixRow({
                            datasetId,
                            rowId: `row-${ri}`,
                            rowData,
                            columnStats: mergedColumnStats,
                            teachingMode: activeTab?.data?.teachingMode || false,
                          } as any);
                          setRowFixIssues(response.issues || []);
                          setRowFixSummary(response.summary || '');
                        } catch (error) {
                          console.error('Failed to get row fixes', error);
                          setRowFixIssues([]);
                          setRowFixSummary('Failed to analyze row issues.');
                        } finally {
                          setRowFixLoading(false);
                        }
                      }}
                    >
                      Fix row issues
                    </ContextMenuItem>
                    {!isRowGutter && (
                      <>
                        <ContextMenuSeparator />
                        <ContextMenuItem onClick={handleCopy}>
                          <Copy className="mr-2 h-4 w-4" />
                          Copy
                          <ContextMenuShortcut>⌘C</ContextMenuShortcut>
                        </ContextMenuItem>
                        <ContextMenuItem onClick={handleCut}>
                          <Scissors className="mr-2 h-4 w-4" />
                          Cut
                          <ContextMenuShortcut>⌘X</ContextMenuShortcut>
                        </ContextMenuItem>
                        <ContextMenuItem onClick={handlePaste} disabled={!clipboardHasDataNow}>
                          <Clipboard className="mr-2 h-4 w-4" />
                          Paste
                          <ContextMenuShortcut>⌘V</ContextMenuShortcut>
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem onClick={handleDelete} variant="destructive">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                          <ContextMenuShortcut>Del</ContextMenuShortcut>
                        </ContextMenuItem>
                      </>
                    )}
                  </>
                );
              })()}
            </ContextMenuContent>
          </ContextMenu>
        </table>
        {/* Fill Handle - shown when cells are selected */}
        {focusedCell && (
          <FillHandle
            selection={
              cellSelection || {
                start: focusedCell,
                end: focusedCell,
              }
            }
            visibleColumns={getVisibleColumns().map(col => col.id)}
            data={data}
            onFill={handleFill}
          />
        )}
      </div>

      {/* Row Fix Modal */}
      <RowFixModal
        open={rowFixModalOpen}
        onOpenChange={setRowFixModalOpen}
        issues={rowFixIssues}
        summary={rowFixSummary}
        isLoading={rowFixLoading}
        onApply={async (selectedFixes: RowFixIssue[]) => {
          if (currentRowIndexForFix === null) return;

          // Apply the fixes to the row
          setData(prevData => {
            const newData = [...prevData];

            selectedFixes.forEach(fix => {
              if (!newData[currentRowIndexForFix]) {
                newData[currentRowIndexForFix] = { id: `row-${currentRowIndexForFix}` };
              }
              newData[currentRowIndexForFix] = {
                ...newData[currentRowIndexForFix],
                [fix.columnId]: fix.suggestedValue,
              };
              // Also trigger cell edit for each fix (fire-and-forget for sheet operations)
              handleCellEdit(currentRowIndexForFix, fix.columnId, fix.suggestedValue).catch(err =>
                console.error('Error in handleCellEdit during row fix:', err)
              );
            });

            return newData;
          });

          // Update tab data
          if (tabId && activeTab?.data) {
            if (tabUpdateTimeoutRef.current) {
              clearTimeout(tabUpdateTimeoutRef.current);
            }

            tabUpdateTimeoutRef.current = setTimeout(() => {
              setData(currentData => {
                if (activeTab?.data && currentRowIndexForFix !== null) {
                  updateTab(tabId, {
                    data: {
                      ...activeTab.data,
                      initialData: currentData,
                    },
                    isDirty: true,
                  });
                }
                return currentData;
              });
            }, 300);
          }

          setRowFixModalOpen(false);
          setCurrentRowIndexForFix(null);
        }}
      />

      {/* Transformation Modal */}
      <TransformationModal
        open={transformationModalOpen}
        onOpenChange={setTransformationModalOpen}
        transformations={transformations}
        isLoading={transformationLoading}
        onApply={async (selectedTransformations: Transformation[]) => {
          if (
            !selectedTransformations.length ||
            !currentColumnForTransformation ||
            !activeTab?.data
          )
            return;

          try {
            const datasetId = gridDatasetId || tabId;
            const sourceColumnId = currentColumnForTransformation;

            // For each transformation, create a new column
            for (const transformation of selectedTransformations) {
              // Use the new-column endpoint to create columns from formulas
              try {
                const datasetSchema = {
                  columns: initialColumns.map((col: any) => ({
                    id: col.id,
                    name: col.header || col.id,
                    type: col.type || 'numeric',
                  })),
                };

                const newColumnResponse = await apiClient.ai.newColumn({
                  datasetSchema,
                  instruction: `Create a new column named "${transformation.name}" with formula: ${transformation.formula} based on column "${sourceColumnId}"`,
                });

                // Evaluate the formula for each row
                const newColumnData: any[] = [];
                const sourceColumnData = data.map(row => row[sourceColumnId]);

                // Simple formula evaluator for common transformations
                for (let i = 0; i < data.length; i++) {
                  const sourceValue = sourceColumnData[i];
                  let newValue: any = null;

                  if (sourceValue !== null && sourceValue !== undefined && sourceValue !== '') {
                    const numValue =
                      typeof sourceValue === 'number'
                        ? sourceValue
                        : parseFloat(String(sourceValue));

                    if (!isNaN(numValue)) {
                      switch (transformation.type) {
                        case 'log':
                          newValue = numValue > 0 ? Math.log(numValue) : null;
                          break;
                        case 'zscore':
                          // Calculate z-score (would need column stats)
                          const stats = mergedColumnStats[sourceColumnId]?.numeric_stats;
                          if (
                            stats &&
                            stats.mean !== undefined &&
                            stats.std_dev !== undefined &&
                            stats.std_dev > 0
                          ) {
                            newValue = (numValue - stats.mean) / stats.std_dev;
                          }
                          break;
                        case 'standardize':
                          const stats2 = mergedColumnStats[sourceColumnId]?.numeric_stats;
                          if (
                            stats2 &&
                            stats2.mean !== undefined &&
                            stats2.std_dev !== undefined &&
                            stats2.std_dev > 0
                          ) {
                            newValue = (numValue - stats2.mean) / stats2.std_dev;
                          }
                          break;
                        case 'normalize':
                          const stats3 = mergedColumnStats[sourceColumnId]?.numeric_stats;
                          if (
                            stats3 &&
                            stats3.min !== undefined &&
                            stats3.max !== undefined &&
                            stats3.max !== stats3.min
                          ) {
                            newValue = (numValue - stats3.min) / (stats3.max - stats3.min);
                          }
                          break;
                        default:
                          newValue = numValue;
                      }
                    }
                  }
                  newColumnData.push(newValue);
                }

                // Create new column definition
                const newColumn = {
                  id: transformation.name,
                  accessor: transformation.name,
                  header: transformation.name,
                  width: 150,
                  type: 'number',
                };

                // Update columns - need to update initialColumns ref
                const updatedColumns = [...initialColumns, newColumn];

                // Update data and tab atomically
                setData(prevData => {
                  const updatedData = prevData.map((row, idx) => ({
                    ...row,
                    [transformation.name]: newColumnData[idx],
                  }));

                  // Update tab data after data update
                  if (tabId && activeTab?.data) {
                    setTimeout(() => {
                      updateTab(tabId, {
                        data: {
                          ...activeTab.data,
                          initialData: updatedData,
                          initialColumns: updatedColumns as any,
                          totalColumns: (activeTab.data?.totalColumns || 0) + 1,
                        },
                        isDirty: true,
                      });
                    }, 0);
                  }

                  return updatedData;
                });
              } catch (error) {
                console.error(
                  `Failed to create column for transformation ${transformation.name}`,
                  error
                );
              }
            }
          } catch (error) {
            console.error('Failed to apply transformations', error);
          } finally {
            setTransformationModalOpen(false);
            setCurrentColumnForTransformation(null);
          }
        }}
      />

      {/* Category Cleaner Modal */}
      <CategoryCleaner
        open={categoryCleanerOpen}
        onOpenChange={setCategoryCleanerOpen}
        mappings={categoryMappings}
        isLoading={categoryCleanerLoading}
        onApply={async (mappings: CategoryMapping[]) => {
          if (currentColumnForCategoryClean === null) return;

          // Apply category mappings
          setData(prevData => {
            const newData = prevData.map(row => {
              const newRow = { ...row };
              mappings.forEach(mapping => {
                if (mapping.from.includes(String(newRow[currentColumnForCategoryClean]))) {
                  newRow[currentColumnForCategoryClean] = mapping.to;
                  // Fire-and-forget async call for sheet operations
                  handleCellEdit(
                    data.indexOf(row),
                    currentColumnForCategoryClean,
                    mapping.to
                  ).catch(err =>
                    console.error('Error in handleCellEdit during category clean:', err)
                  );
                }
              });
              return newRow;
            });
            return newData;
          });

          // Update tab data
          if (tabId && activeTab?.data) {
            if (tabUpdateTimeoutRef.current) {
              clearTimeout(tabUpdateTimeoutRef.current);
            }

            tabUpdateTimeoutRef.current = setTimeout(() => {
              setData(currentData => {
                if (activeTab?.data) {
                  updateTab(tabId, {
                    data: {
                      ...activeTab.data,
                      initialData: currentData,
                    },
                    isDirty: true,
                  });
                }
                return currentData;
              });
            }, 300);
          }

          setCategoryCleanerOpen(false);
          setCurrentColumnForCategoryClean(null);
        }}
      />
    </div>
  );
}

export default Spreadsheet;
