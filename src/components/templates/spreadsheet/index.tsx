import React, { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
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
} from '@tanstack/react-table';
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

const INITIAL_EMPTY_ROWS = 200;
const ROWS_PER_BATCH = 250;
const EXTRA_COLUMNS = 10;
const DEFAULT_COLUMN_WIDTH = 150;
const SCROLL_PERCENTAGE_THRESHOLD = 0.7; // Load new data when user scrolls to 70%
const PREFETCH_THRESHOLD = 0.3; // Start prefetching when user scrolls to 30%
const INITIAL_PREFETCH_DELAY = 100; // Delay before initial prefetch (ms)

type RowType = Record<string, any> & { id: string };

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

    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
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
            onMouseDown={e => {
              if (onMouseDown) {
                onMouseDown(e, rowIndex, columnId);
              }
            }}
            onMouseEnter={e => {
              if (onMouseEnter && e.buttons === 1) {
                // Only trigger on mouse enter if mouse button is pressed (dragging)
                onMouseEnter(e, rowIndex, columnId);
              }
            }}
            className={cn(
              'border-r border-b border-border last:border-r-0 tabular-nums',
              isCellFocused && 'relative z-10 ring-2 ring-primary ring-offset-0',
              isCellSelected && !isCellFocused && 'bg-blue-100/50 dark:bg-blue-900/20',
              isCellSelected &&
                isCellFocused &&
                'bg-blue-200 dark:bg-blue-800/30 ring-2 ring-blue-500'
            )}
            style={{
              width: columnSize,
              minWidth: columnSize,
              display: 'flex',
              alignItems: 'center',
              padding: 0,
              borderRight: '1px solid #e5e7eb',
              borderBottom: '1px solid #e5e7eb',
              boxSizing: 'border-box',
            }}
          >
            {columnId === 'select' ? (
              flexRender(cell.column.columnDef.cell, cell.getContext())
            ) : (
              <EditableCell
                value={(cellValue as string | number | null) || ''}
                onEdit={onEdit}
                className="h-7 w-full px-2"
                isFocused={isCellFocused}
                onFocus={onFocus}
              />
            )}
          </TableCell>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={onCopy}>
            <Copy className="mr-2 h-4 w-4" />
            Copy
            <ContextMenuShortcut>⌘C</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onClick={onCut}>
            <Scissors className="mr-2 h-4 w-4" />
            Cut
            <ContextMenuShortcut>⌘X</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onClick={onPaste} disabled={!clipboardHasData}>
            <Clipboard className="mr-2 h-4 w-4" />
            Paste
            <ContextMenuShortcut>⌘V</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={onDelete} variant="destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
            <ContextMenuShortcut>Del</ContextMenuShortcut>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
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

    // Only re-render if something actually changed for this specific cell
    // Return true means "props are equal, skip render", false means "props changed, render"
    // Note: onMouseDown and onMouseEnter are functions and may change on every render,
    // but they don't affect the visual appearance, so we ignore them in comparison
    return (
      !cellValueChanged && !focusChanged && !selectionChanged && !sizeChanged && !clipboardChanged
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
  onSelectionChange,
  onChange,
  columnStats,
  showMenu = true,
  tabData,
}: SpreadsheetProps) {
  // Removed tokens - using getIdToken() directly
  const tableContainerRef = useRef<HTMLDivElement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [containerHeight, setContainerHeight] = useState<number | null>(null);
  const loadingRef = useRef(false);
  const lastLoadedRowRef = useRef(initialData.length);
  const [localColumnStats, setLocalColumnStats] = useState<
    Record<string, ColumnSummary> | undefined
  >(undefined);
  const [focusedCell, setFocusedCell] = useState<CellPosition | null>(null);
  const [cellSelection, setCellSelection] = useState<CellRange | null>(null);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('single');
  const [selectionAnchor, setSelectionAnchor] = useState<CellPosition | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
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

  // Reset stats when file path changes
  useEffect(() => {
    if (filePath) {
      setLocalColumnStats(undefined);
      statsLoadAttempted.current = false;
    }
  }, [filePath]);

  // Check if this is a project file (selected from a multi-file project)
  // Only skip fetchMoreRows for project files, not for projects themselves
  const isProjectFile = useMemo(() => {
    return tabData?.isProjectFile === true;
  }, [tabData?.isProjectFile]);

  // Load statistics
  const loadColumnStats = useCallback(async () => {
    if (!showStats || !decodedFilePath || statsLoadAttempted.current) {
      return;
    }

    // For projects, we already have column stats from the processed data
    if (isProjectFile) {
      console.log('Project file data already has column stats, skipping analysis');
      return;
    }

    try {
      setIsLoadingStats(true);
      statsLoadAttempted.current = true;

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_FARGATE_API_URL}/api/analysis/analyze-file`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idTokenRef.current}`,
          },
          body: JSON.stringify({
            path: decodedFilePath,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Error analyzing file: ${response.statusText}`);
      }

      const stats = await response.json();

      if (!stats || typeof stats !== 'object') {
        throw new Error('Invalid statistics data received');
      }

      setLocalColumnStats(stats);
    } catch (error) {
    } finally {
      setIsLoadingStats(false);
    }
  }, [decodedFilePath, showStats, localColumnStats, isProjectFile]);

  // Trigger statistics loading when needed
  useEffect(() => {
    if (showStats && decodedFilePath && !localColumnStats && !isLoadingStats) {
      loadColumnStats();
    }
  }, [showStats, decodedFilePath, localColumnStats, isLoadingStats, loadColumnStats]);

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
    } else {
      // Empty file or spreadsheet mode: Initialize with blank rows
      return Array(INITIAL_EMPTY_ROWS)
        .fill(null)
        .map((_, index) => ({
          id: `row-${index}`,
        }));
    }
  });

  // Sync sheet state to local data when sheet state is available (real-time mode)
  useEffect(() => {
    if (sheetState && sheetState.data && Array.isArray(sheetState.data)) {
      // Convert sheet state data array to RowType format
      const sheetRows: RowType[] = sheetState.data.map(
        (row: Record<string, any>, index: number) => ({
          id: `row-${index}`,
          ...row,
        })
      );
      setData(sheetRows);
    }
  }, [sheetState]);

  // Track previous data length to prevent infinite loops (must be after data state declaration)
  const previousDataLengthRef = useRef(data.length);

  const { tabs, activeTabId, updateTab } = useTabsStore();
  const activeTab = tabs.find(tab => tab.id === activeTabId);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(
    activeTab?.data?.columnFilters || []
  );
  const [columnSizing, setColumnSizing] = useState({});
  const [extraColumnsCount, setExtraColumnsCount] = useState(EXTRA_COLUMNS);
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  const columns = useMemo(
    () =>
      createColumns({
        initialColumns: initialColumns,
        extraColumnsCount,
        setData: setData as React.Dispatch<React.SetStateAction<Record<string, any>[]>>,
        DEFAULT_COLUMN_WIDTH,
      } as CreateColumnsProps),
    [initialColumns, extraColumnsCount]
  );

  const fetchMoreRows = useCallback(async () => {
    // Early returns - check these BEFORE setting loading flag
    if (!decodedFilePath) {
      console.log('[Pagination Debug] fetchMoreRows early return: no decodedFilePath');
      return;
    }

    // For project files (selected from multi-file projects), we already have all the data
    if (isProjectFile) {
      console.log('Project file data already loaded, skipping fetchMoreRows');
      return;
    }

    // Guard: Don't fetch if we've already loaded all rows
    if (lastLoadedRowRef.current >= (totalRowCount || 0)) {
      console.log('[Pagination Debug] All rows loaded:', {
        lastLoadedRow: lastLoadedRowRef.current,
        totalRowCount,
      });
      return;
    }

    // Guard: Calculate and check if we have valid range to fetch
    const startRow = lastLoadedRowRef.current;
    const endRow = Math.min(startRow + ROWS_PER_BATCH, totalRowCount || 0);

    if (startRow >= endRow) {
      console.log('[Pagination Debug] Invalid range:', { startRow, endRow });
      return;
    }

    // Check loading flag AFTER all other checks - if already loading, skip
    if (loadingRef.current) {
      console.log('[Pagination Debug] fetchMoreRows already in progress, skipping');
      return;
    }

    console.log('[Pagination Debug] fetchMoreRows called', {
      startRow,
      endRow,
      lastLoadedRow: lastLoadedRowRef.current,
      totalRowCount,
      dataLength: data.length,
      rowsLength: rows.length,
    });

    // Set loading flag atomically - do this LAST after all checks pass
    loadingRef.current = true;
    setIsLoading(true);

    // Performance monitoring
    const perfStartTime = performance.now();
    let networkStartTime: number | null = null;
    let networkEndTime: number | null = null;
    let parseStartTime: number | null = null;
    let parseEndTime: number | null = null;

    try {
      // Check if we have prefetched data for this range
      if (
        prefetchedData.length > 0 &&
        prefetchedRowRangeRef.current &&
        prefetchedRowRangeRef.current.start === startRow &&
        prefetchedRowRangeRef.current.end === endRow
      ) {
        // Use prefetched data - wrap in transition for non-urgent update
        startTransition(() => {
          setData(prevData => [...prevData, ...prefetchedData]);
          setPrefetchedData([]);
          prefetchedRowRangeRef.current = null;
        });

        const newLastLoadedRow = lastLoadedRowRef.current + ROWS_PER_BATCH;
        lastLoadedRowRef.current = newLastLoadedRow;

        // Start prefetching the next page
        setTimeout(() => prefetchNextPage(), 0);
        return;
      }

      // Convert TanStack Table sorting state to backend format
      const sortConfig: SortConfig[] | undefined =
        sorting.length > 0
          ? sorting.map(sort => ({
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

      // Check if this is a project (UUID) or a file path
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const isProject = uuidRegex.test(decodedFilePath);

      let response;
      if (isProject) {
        // For projects, we need to get the actual file path from the project data
        // First, get the project details to find the file path
        const projectResponse = await fetch(
          `https://api.dev.tensr.xyz/projects/${decodedFilePath}`,
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

        // Get the first file from the project (assuming single file for now)
        const firstFile = projectData.fileGroups?.data?.[0];
        if (!firstFile) {
          throw new Error('No files found in project');
        }

        // Use file API with project context - send the file_id directly
        networkStartTime = performance.now();
        response = await fetch(`${process.env.NEXT_PUBLIC_FARGATE_API_URL}/api/files/fetch-page`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idTokenRef.current}`,
          },
          body: JSON.stringify({
            path: firstFile.path, // Send the original filename
            start_row: startRow,
            end_row: endRow,
            sort_config: sortConfig,
            filter_config: filterConfig,
            project_id: decodedFilePath,
            file_id: firstFile.fileId, // This is the key field!
          }),
        });
      } else {
        // Determine if this is a project file by checking if filePath contains project structure
        const isProjectFile =
          decodedFilePath.includes('/users/') && decodedFilePath.includes('/projects/');

        let requestBody: any = {
          path: decodedFilePath,
          start_row: startRow,
          end_row: endRow,
          sort_config: sortConfig,
          filter_config: filterConfig,
        };

        // If it's a project file, extract project context
        if (isProjectFile) {
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

        // Use file API for regular files
        networkStartTime = performance.now();
        response = await fetch(`${process.env.NEXT_PUBLIC_FARGATE_API_URL}/api/files/fetch-page`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idTokenRef.current}`,
          },
          body: JSON.stringify(requestBody),
        });
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Failed to fetch data: ${response.status} ${errorText}`);
      }

      networkEndTime = performance.now();
      parseStartTime = performance.now();
      const data = await response.json();
      parseEndTime = performance.now();

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
        // Both projects and files now use the file API, so data format is consistent
        const processedData = data.data;

        if (processedData && processedData[0]) {
          const newRows = processedData[0].map((_: any, rowIndex: number) => {
            const row: RowType = { id: `row-${startRow + rowIndex}` };
            initialColumns.forEach((col, colIndex) => {
              if (col.id) {
                row[col.id] = processedData[colIndex][rowIndex];
              }
            });
            return row;
          });

          // Use transition for non-urgent data updates to keep UI responsive
          startTransition(() => {
            setData(prevData => {
              const updated = [...prevData, ...newRows];
              console.log('[Pagination Debug] Data updated', {
                prevLength: prevData.length,
                newLength: updated.length,
                newRowsCount: newRows.length,
                lastLoadedRowBefore: lastLoadedRowRef.current,
              });
              return updated;
            });
          });
        }
      }

      const newLastLoadedRow = lastLoadedRowRef.current + ROWS_PER_BATCH;
      lastLoadedRowRef.current = newLastLoadedRow;

      // Performance logging
      const perfEndTime = performance.now();
      const totalTime = perfEndTime - perfStartTime;
      const networkTime =
        networkStartTime && networkEndTime ? networkEndTime - networkStartTime : 0;
      const parseTime = parseStartTime && parseEndTime ? parseEndTime - parseStartTime : 0;
      const processingTime = totalTime - networkTime - parseTime;

      console.log('[Performance] Data fetch metrics', {
        rowsFetched: endRow - startRow,
        networkTime: `${networkTime.toFixed(2)}ms`,
        parseTime: `${parseTime.toFixed(2)}ms`,
        processingTime: `${processingTime.toFixed(2)}ms`,
        totalTime: `${totalTime.toFixed(2)}ms`,
        rowsPerSecond: ((endRow - startRow) / (totalTime / 1000)).toFixed(0),
      });

      console.log('[Pagination Debug] lastLoadedRowRef updated', {
        newLastLoadedRow,
        totalRowCount,
        remaining: (totalRowCount || 0) - newLastLoadedRow,
      });

      // Immediately start prefetching the next page after loading
      if (newLastLoadedRow < (totalRowCount || 0)) {
        setTimeout(() => {
          if (!isPrefetchingRef.current) {
            prefetchNextPage();
          }
        }, 0);
      }
    } catch (error) {
    } finally {
      setIsLoading(false);
      loadingRef.current = false;
    }
  }, [decodedFilePath, initialColumns, totalRowCount, sorting, columnFilters, isProjectFile]);

  // Prefetch function - loads data in background without showing loading state
  const prefetchNextPage = useCallback(async () => {
    if (!decodedFilePath || isPrefetchingRef.current || isProjectFile) {
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
      const sortConfig: SortConfig[] | undefined =
        sorting.length > 0
          ? sorting.map(sort => ({
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

      // Check if this is a project (UUID) or a file path
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const isProject = uuidRegex.test(decodedFilePath);

      let response;
      if (isProject) {
        // For projects, get the project details to find the file path
        const projectResponse = await fetch(
          `https://api.dev.tensr.xyz/projects/${decodedFilePath}`,
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

        response = await fetch(`${process.env.NEXT_PUBLIC_FARGATE_API_URL}/api/files/fetch-page`, {
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
      } else {
        // Handle regular files and project files
        const isProjectFile =
          decodedFilePath.includes('/users/') && decodedFilePath.includes('/projects/');

        let requestBody: any = {
          path: decodedFilePath,
          start_row: nextStartRow,
          end_row: nextEndRow,
          sort_config: sortConfig,
          filter_config: filterConfig,
        };

        if (isProjectFile) {
          const pathParts = decodedFilePath.split('/');
          const usersIndex = pathParts.indexOf('users');
          const projectsIndex = pathParts.indexOf('projects');

          if (usersIndex !== -1 && projectsIndex !== -1 && projectsIndex > usersIndex) {
            const userId = pathParts[usersIndex + 1];
            const projectId = pathParts[projectsIndex + 1];
            const fileId = pathParts[projectsIndex + 3];

            requestBody = {
              ...requestBody,
              project_id: projectId,
              file_id: fileId,
            };
          }
        }

        response = await fetch(`${process.env.NEXT_PUBLIC_FARGATE_API_URL}/api/files/fetch-page`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idTokenRef.current}`,
          },
          body: JSON.stringify(requestBody),
        });
      }

      if (!response.ok) {
        console.warn('Prefetch failed:', response.status);
        return;
      }

      const data = await response.json();
      const processedData = data.data;

      if (processedData && processedData[0]) {
        const newRows = processedData[0].map((_: any, rowIndex: number) => {
          const row: RowType = { id: `row-${nextStartRow + rowIndex}` };
          initialColumns.forEach((col, colIndex) => {
            if (col.id) {
              row[col.id] = processedData[colIndex][rowIndex];
            }
          });
          return row;
        });

        // Prefetch updates are non-urgent - use transition
        startTransition(() => {
          setPrefetchedData(newRows);
          prefetchedRowRangeRef.current = { start: nextStartRow, end: nextEndRow };
        });
      }
    } catch (error) {
      console.warn('Prefetch error:', error);
    } finally {
      isPrefetchingRef.current = false;
    }
  }, [decodedFilePath, initialColumns, totalRowCount, sorting, columnFilters, isProjectFile]);

  // Initial data loading - consolidated into single effect with proper guards
  const initialLoadDoneRef = useRef(false);
  useEffect(() => {
    if (!isProjectFile && decodedFilePath && !initialLoadDoneRef.current && !loadingRef.current) {
      // Check if we need to load more data
      const needsMoreData =
        totalRowCount &&
        totalRowCount > initialData.length &&
        lastLoadedRowRef.current < totalRowCount;

      if (needsMoreData) {
        initialLoadDoneRef.current = true;
        const timer = setTimeout(() => {
          if (!loadingRef.current) {
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

  // Reset initial load flag when file path changes
  useEffect(() => {
    initialLoadDoneRef.current = false;
  }, [decodedFilePath]);

  const handleSortingChange: OnChangeFn<SortingState> = useCallback(
    async updaterOrValue => {
      // Reset the data and pagination state when sort changes
      setData([]);
      lastLoadedRowRef.current = 0;
      // Clear prefetched data since sorting changed
      setPrefetchedData([]);
      prefetchedRowRangeRef.current = null;

      // Update the sorting state
      const newSorting =
        typeof updaterOrValue === 'function' ? updaterOrValue(sorting) : updaterOrValue;
      setSorting(newSorting);

      // Refetch data with new sorting
      await fetchMoreRows();
    },
    [fetchMoreRows, sorting]
  );

  const fetchFilteredData = useCallback(
    (newFilters: ColumnFiltersState) => {
      console.log('Fetching filtered data with filters:', newFilters);

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

          const response = await fetch(
            `${process.env.NEXT_PUBLIC_FARGATE_API_URL}/api/files/fetch-page`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${idTokenRef.current}`,
              },
              body: JSON.stringify(requestBody),
            }
          );

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

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      columnSizing,
    },
    onRowSelectionChange: setRowSelection,
    onSortingChange: handleSortingChange,
    onColumnFiltersChange: filtersOrUpdater => {
      const newFilters =
        typeof filtersOrUpdater === 'function' ? filtersOrUpdater(columnFilters) : filtersOrUpdater;

      console.log('Table column filters change:', newFilters);
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
    onColumnVisibilityChange: setColumnVisibility,
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    autoResetPageIndex: false,
    enableMultiSort: true,
    manualSorting: true,
    manualFiltering: true,
  });

  const { rows } = table.getRowModel();

  // Virtualization count: For file mode, use totalRowCount to enable scrolling
  // The virtualizer needs to know the total height to create a scrollable area
  // It will only render the visible rows that exist in data, but needs total count for scroll calculations
  const virtualizationCount = useMemo(() => {
    // For file mode with pagination, use totalRowCount so the virtualizer creates the full scrollable height
    // The virtualizer will only render rows that exist in the data array, but the scroll area will be correct
    if (isFileMode && totalRowCount) {
      return totalRowCount;
    }
    // For spreadsheet mode, use the actual data length
    return rows.length;
  }, [isFileMode, totalRowCount, rows.length]);

  // Use React 19 useTransition for non-urgent updates (data loading)
  const [isPending, startTransition] = useTransition();

  const rowVirtualizer = useVirtualizer({
    count: virtualizationCount,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: useCallback(() => 28, []),
    overscan: 5, // Further reduced for better performance - only render what's needed
    // Enable range extractor for better performance with large datasets
    rangeExtractor: useCallback((range: { startIndex: number; endIndex: number }) => {
      const indexes: number[] = [];
      for (let i = range.startIndex; i <= range.endIndex; i++) {
        indexes.push(i);
      }
      return indexes;
    }, []),
    // Disable measurement for better performance - we know the size
    measureElement: undefined,
    // Enable horizontal scrolling optimization
    horizontal: false,
  });

  // Use ResizeObserver to measure and constrain container height
  useEffect(() => {
    if (!tableContainerRef.current) return;

    const container = tableContainerRef.current;
    const parent = container.parentElement;

    if (!parent) return;

    const updateHeight = () => {
      // Try multiple methods to get the parent's constrained height
      const parentRect = parent.getBoundingClientRect();
      const parentHeight = parentRect.height;
      const parentComputedHeight = window.getComputedStyle(parent).height;

      console.log('[ResizeObserver Debug]', {
        parentHeight,
        parentComputedHeight,
        parentRect: { top: parentRect.top, bottom: parentRect.bottom, height: parentRect.height },
        viewportHeight: window.innerHeight,
      });

      // If parent has a fixed height, use it directly
      if (
        parentComputedHeight &&
        parentComputedHeight !== 'auto' &&
        !parentComputedHeight.includes('%')
      ) {
        const heightValue = parseFloat(parentComputedHeight);
        if (!isNaN(heightValue) && heightValue > 0) {
          // Use the exact parent height to fill the container
          setContainerHeight(Math.max(100, heightValue));
          return;
        }
      }

      // Use bounding rect height if it's reasonable and less than viewport
      if (parentHeight > 0 && parentHeight < window.innerHeight && parentHeight < 2000) {
        // Use the exact parent height to fill the container
        setContainerHeight(Math.max(100, parentHeight));
      } else {
        // Fallback: use viewport height minus a reasonable offset
        const viewportHeight = window.innerHeight;
        const estimatedHeight = Math.max(100, viewportHeight - 250); // Account for headers, titlebar, etc.
        setContainerHeight(estimatedHeight);
      }
    };

    // Initial measurement
    updateHeight();

    const resizeObserver = new ResizeObserver(entries => {
      updateHeight();
    });

    // Observe both parent and container
    resizeObserver.observe(parent);
    resizeObserver.observe(container);

    // Also listen to window resize
    window.addEventListener('resize', updateHeight);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, []);

  // Debug: Log virtualizer and container dimensions
  useEffect(() => {
    if (tableContainerRef.current && rowVirtualizer) {
      const container = tableContainerRef.current;
      const totalSize = rowVirtualizer.getTotalSize();
      const virtualItems = rowVirtualizer.getVirtualItems();
      const parent = container.parentElement;

      console.log('[Scroll Debug]', {
        virtualizationCount,
        totalSize,
        virtualItemsCount: virtualItems.length,
        containerScrollHeight: container.scrollHeight,
        containerClientHeight: container.clientHeight,
        containerHeight: container.offsetHeight,
        containerHeightState: containerHeight,
        containerComputedHeight: window.getComputedStyle(container).height,
        containerComputedMaxHeight: window.getComputedStyle(container).maxHeight,
        containerComputedOverflow: window.getComputedStyle(container).overflow,
        parentHeight: parent?.offsetHeight,
        parentClientHeight: parent?.clientHeight,
        parentComputedHeight: parent ? window.getComputedStyle(parent).height : null,
        parentComputedDisplay: parent ? window.getComputedStyle(parent).display : null,
        canScroll: container.scrollHeight > container.clientHeight,
        // The critical check: container should be smaller than content
        needsConstraint: container.scrollHeight === container.clientHeight,
        rowsLength: rows.length,
        totalRowCount,
        isFileMode,
        // Check if container is actually constrained
        isConstrained: container.clientHeight < container.scrollHeight,
      });
    }
  }, [
    virtualizationCount,
    rowVirtualizer,
    rows.length,
    totalRowCount,
    isFileMode,
    containerHeight,
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
      // Clear any pending scroll handler
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Debounce scroll handling to prevent excessive calls
      scrollTimeoutRef.current = setTimeout(() => {
        const target = e.target as HTMLDivElement;
        const { scrollHeight, scrollTop, clientHeight, scrollWidth, scrollLeft, clientWidth } =
          target;

        // Skip if we don't have valid dimensions
        if (scrollHeight === 0 || clientHeight === 0) {
          return;
        }

        // Vertical scroll check
        const verticalScrollPercentage = (scrollTop + clientHeight) / scrollHeight;

        // Prefetch trigger - start prefetching at 30% scroll
        if (verticalScrollPercentage > PREFETCH_THRESHOLD && !isPrefetchingRef.current) {
          if (isFileMode && lastLoadedRowRef.current < (totalRowCount || 0)) {
            prefetchNextPage();
          }
        }

        // Load trigger - use a more intelligent approach
        // Instead of percentage, check if we're near the bottom of currently loaded data
        const rowsPerPage = Math.floor(clientHeight / 28); // Approximate rows visible
        const currentLoadedRows = lastLoadedRowRef.current;
        const virtualScrollPosition = Math.floor(scrollTop / 28); // Approximate row position

        // Load more data when we're within 3 pages of the end of loaded data (more aggressive)
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
      }, 100); // 100ms debounce
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
          // Optimistic update will be handled by sheet state sync via useEffect
          if (success) return;
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
    [tabId, activeTab, updateTab, wsReady, currentSession]
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
      const datasetId = filePath || tabId;
      const stats = columnStats?.[columnId];
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
            // For now, just log - full implementation would check all rows
            console.log('Outlier detection', response);

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
        default:
          break;
      }
    },
    [filePath, tabId, columnStats, initialColumns, data, activeTab]
  );

  const HeaderComponentWrapper = useMemo(() => {
    const WrappedHeaderComponent = ({ header }: { header: Header<any, unknown> }) => (
      <HeaderComponent
        header={header}
        table={table}
        showStats={showStats}
        columnStats={columnStats}
        onHeaderEdit={handleHeaderEdit}
        isLoadingStats={isLoadingStats}
        onColumnAction={handleColumnAction}
        datasetId={filePath || tabId}
      />
    );

    WrappedHeaderComponent.displayName = 'HeaderComponentWrapper';
    return WrappedHeaderComponent;
  }, [
    table,
    showStats,
    columnStats,
    handleHeaderEdit,
    isLoadingStats,
    handleColumnAction,
    filePath,
    tabId,
  ]);

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

  // Sync filters from tab store when they change externally (e.g., from Agent Panel)
  useEffect(() => {
    if (activeTab?.data?.columnFilters) {
      const tabFilters = activeTab.data.columnFilters;
      // Only update if filters are different to avoid infinite loops
      const currentFiltersStr = JSON.stringify(columnFilters);
      const tabFiltersStr = JSON.stringify(tabFilters);
      if (tabFiltersStr !== currentFiltersStr && tabFiltersStr !== '[]') {
        setColumnFilters(tabFilters);
        // Apply the filters to fetch filtered data
        fetchFilteredData(tabFilters);
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
        className="relative flex-1 overflow-auto"
        style={{
          // CRITICAL: Container must have a constrained height for scrolling to work
          // Use measured height if available, otherwise use viewport calculation
          height: containerHeight ? `${containerHeight}px` : 'calc(100vh - 250px)',
          maxHeight: containerHeight ? `${containerHeight}px` : 'calc(100vh - 250px)',
          minHeight: 0,
          width: '100%',
          // Ensure overflow is set for scrolling
          overflow: 'auto',
          position: 'relative',
          padding: 0,
          margin: 0,
        }}
      >
        {/* Wrapper div with total height - enables scrolling */}
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            position: 'relative',
            padding: 0,
            margin: 0,
          }}
        >
          <table
            className="w-full border-collapse text-xs"
            style={{
              tableLayout: 'fixed',
              display: 'block', // Keep original block display for custom layout
              width: '100%',
              padding: 0,
              margin: 0,
            }}
          >
            <TableHeader
              style={{
                display: 'block',
                position: 'sticky',
                top: 0,
                zIndex: 1,
                background: 'white',
              }}
            >
              {table.getHeaderGroups().map(headerGroup => (
                <TableRow
                  key={headerGroup.id}
                  className="!border-none" // Remove default border
                  style={{ display: 'flex', width: '100%' }}
                >
                  {headerGroup.headers.map(header => (
                    <TableHead
                      key={header.id}
                      className="sticky top-0 flex items-center whitespace-nowrap bg-background border-r border-b border-border last:border-r-0"
                      style={{
                        width: header.getSize() || 150,
                        minWidth: header.getSize() || 150,
                        height: showStats ? '250px' : '28px',
                        padding: 0,
                      }}
                    >
                      <HeaderComponentWrapper header={header} />
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>

            {/* Table body with virtualized rows - restore original structure */}
            <TableBody
              style={{
                display: 'block',
                height: `${rowVirtualizer.getTotalSize()}px`,
                minHeight: `${rowVirtualizer.getTotalSize()}px`,
                position: 'relative',
                width: '100%',
                boxSizing: 'border-box',
                padding: 0,
                margin: 0,
              }}
            >
              {rowVirtualizer.getVirtualItems().map(virtualRow => {
                const row = rows[virtualRow.index];
                const rowIndex = virtualRow.index;

                // If row doesn't exist yet but we're in file mode, show loading placeholder
                if (!row && isFileMode && rowIndex < (totalRowCount || 0)) {
                  // Trigger fetch if we're trying to render unloaded rows
                  // This handles fast scrolling where virtualizer tries to render rows beyond loaded data
                  // Trigger if rowIndex is >= lastLoadedRowRef (we're past loaded data) or within 30 rows of it
                  const rowsAhead = rowIndex - lastLoadedRowRef.current;
                  if (
                    rowsAhead >= -30 &&
                    !loadingRef.current &&
                    lastLoadedRowRef.current < (totalRowCount || 0)
                  ) {
                    // Trigger fetch immediately when we try to render unloaded rows
                    // Don't set loadingRef here - let fetchMoreRows handle it
                    setTimeout(() => {
                      if (!loadingRef.current && lastLoadedRowRef.current < (totalRowCount || 0)) {
                        console.log(
                          '[Pagination Debug] Triggering fetchMoreRows from placeholder',
                          {
                            rowIndex,
                            lastLoadedRow: lastLoadedRowRef.current,
                            totalRowCount,
                            rowsAhead,
                            dataLength: data.length,
                            rowsLength: rows.length,
                          }
                        );
                        // fetchMoreRows will set loadingRef.current = true internally
                        fetchMoreRows().catch(error => {
                          console.error('[Pagination Debug] fetchMoreRows error:', error);
                          loadingRef.current = false;
                        });
                      }
                    }, 0);
                  }

                  // Render loading placeholder
                  return (
                    <TableRow
                      key={`loading-${rowIndex}`}
                      data-index={rowIndex}
                      className="bg-muted/20 animate-pulse !border-b-0"
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualRow.start}px)`,
                        display: 'flex',
                        height: '28px',
                        borderBottom: 'none', // Explicitly remove border
                        boxSizing: 'border-box',
                      }}
                    >
                      {table.getAllColumns().map(column => {
                        const columnId = column.id;
                        return (
                          <TableCell
                            key={columnId}
                            className="border-r border-b border-border last:border-r-0"
                            style={{
                              width: column.getSize() || 150,
                              minWidth: column.getSize() || 150,
                              height: '28px',
                              padding: 0,
                              borderRight: '1px solid #e5e7eb',
                              borderBottom: '1px solid #e5e7eb',
                              boxSizing: 'border-box',
                            }}
                          >
                            <div className="h-full w-full bg-muted/30" />
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                }

                // If row doesn't exist and we're past total, return null
                if (!row) return null;

                const isRowSelected = row.getIsSelected();
                const isFocused = focusedCell?.rowIndex === rowIndex;

                return (
                  <ContextMenu key={row.id}>
                    <ContextMenuTrigger asChild>
                      <TableRow
                        data-index={rowIndex}
                        className={cn(
                          isRowSelected && 'bg-muted/50',
                          highlightedRows.has(rowIndex) &&
                            'bg-blue-100 dark:bg-blue-900/30 border-l-4 border-l-blue-500',
                          selectedRowId === `row-${rowIndex}` && 'ring-2 ring-primary',
                          '!border-b-0' // Override default TableRow border-b - cells have their own bottom borders
                        )}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          transform: `translateY(${virtualRow.start}px)`,
                          display: 'flex',
                          borderBottom: 'none', // Explicitly remove border
                          boxSizing: 'border-box',
                        }}
                      >
                        {row.getVisibleCells().map(cell => {
                          const columnId = cell.column.id;
                          const cellKey = `${rowIndex}-${columnId}`;
                          const isCellFocused = isFocused && focusedCell?.columnId === columnId;
                          const cellIsSelected = isCellSelected(rowIndex, columnId);

                          return (
                            <MemoizedTableCell
                              key={cell.id}
                              cell={cell}
                              rowIndex={rowIndex}
                              columnId={columnId}
                              cellKey={cellKey}
                              isCellFocused={isCellFocused}
                              isCellSelected={cellIsSelected}
                              cellRefs={cellRefs}
                              handleCellEdit={handleCellEdit}
                              setFocusedCell={setFocusedCell}
                              onMouseDown={handleCellMouseDown}
                              onMouseEnter={handleCellMouseEnter}
                              onCopy={handleCopy}
                              onCut={handleCut}
                              onPaste={handlePaste}
                              onDelete={handleDelete}
                              clipboardHasData={clipboardHasData()}
                            />
                          );
                        })}
                      </TableRow>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuItem
                        onClick={async () => {
                          try {
                            const rowData = row.original as Record<string, any>;
                            // Set selected row for Inspector pane
                            setSelectedRowId(`row-${rowIndex}`);
                            setSelectedRowData(rowData);

                            // Get dataset ID from filePath or tab data
                            const datasetId = filePath || tabId;

                            const response = await apiClient.ai.rowInsight({
                              datasetId,
                              rowId: `row-${rowIndex}`,
                              rowData,
                              teachingMode: activeTab?.data?.teachingMode || false,
                            } as any);

                            setRowInsight(response);
                            console.info('Row insight', response);
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
                            const rowData = row.original as Record<string, any>;
                            // Set selected row for Inspector pane
                            setSelectedRowId(`row-${rowIndex}`);
                            setSelectedRowData(rowData);

                            const datasetId = filePath || tabId;
                            const response = await apiClient.ai.rowInsight({
                              datasetId,
                              rowId: `row-${rowIndex}`,
                              rowData,
                              mode: 'similar',
                              teachingMode: activeTab?.data?.teachingMode || false,
                            } as any);

                            setRowInsight(response);

                            // Highlight similar rows if response includes row indices
                            if (response?.similarRows && Array.isArray(response.similarRows)) {
                              setHighlightedRows(new Set(response.similarRows));
                            }

                            console.info('Similar rows', response);
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
                            const rowData = row.original as Record<string, any>;
                            setSelectedRowId(`row-${rowIndex}`);
                            setSelectedRowData(rowData);
                            setCurrentRowIndexForFix(rowIndex);
                            setRowFixLoading(true);
                            setRowFixModalOpen(true);

                            const datasetId = filePath || tabId;
                            const response = await apiClient.ai.fixRow({
                              datasetId,
                              rowId: `row-${rowIndex}`,
                              rowData,
                              columnStats: columnStats,
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
                    </ContextMenuContent>
                  </ContextMenu>
                );
              })}
            </TableBody>
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
            const datasetId = filePath || tabId;
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
                          const stats = columnStats?.[sourceColumnId]?.numeric_stats;
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
                          const stats2 = columnStats?.[sourceColumnId]?.numeric_stats;
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
                          const stats3 = columnStats?.[sourceColumnId]?.numeric_stats;
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
