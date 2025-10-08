import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { CellPosition, SortConfig, SpreadsheetProps } from '@/types/spreadsheet';
import { handleKeyboardNavigation } from '@/utils/spreadsheet';
import _ from 'lodash';
import useAuth from '@/hooks/api/use-auth';
import { Column } from '@/stores/tabs-store';

const INITIAL_EMPTY_ROWS = 200;
const ROWS_PER_BATCH = 100;
const EXTRA_COLUMNS = 10;
const DEFAULT_COLUMN_WIDTH = 150;
const SCROLL_PERCENTAGE_THRESHOLD = 0.7; // Load new data when user scrolls to 70%
const PREFETCH_THRESHOLD = 0.3; // Start prefetching when user scrolls to 30%
const INITIAL_PREFETCH_DELAY = 100; // Delay before initial prefetch (ms)

type RowType = Record<string, any> & { id: string };

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
  const { tokens } = useAuth();
  const tableContainerRef = useRef<HTMLDivElement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const loadingRef = useRef(false);
  const lastLoadedRowRef = useRef(initialData.length);
  const [localColumnStats, setLocalColumnStats] = useState<
    Record<string, ColumnSummary> | undefined
  >(undefined);
  const [focusedCell, setFocusedCell] = useState<CellPosition | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const statsLoadAttempted = useRef(false);

  // Prefetch state management
  const [prefetchedData, setPrefetchedData] = useState<RowType[]>([]);
  const isPrefetchingRef = useRef(false);
  const prefetchedRowRangeRef = useRef<{ start: number; end: number } | null>(null);

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
            Authorization: `Bearer ${tokens?.idToken}`,
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

  const { tabs, activeTabId, updateTab } = useTabsStore();
  const activeTab = tabs.find(tab => tab.id === activeTabId);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
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
    if (!decodedFilePath || loadingRef.current) {
      return;
    }

    // For project files (selected from multi-file projects), we already have all the data
    if (isProjectFile) {
      console.log('Project file data already loaded, skipping fetchMoreRows');
      return;
    }

    try {
      loadingRef.current = true;
      setIsLoading(true);

      const startRow = lastLoadedRowRef.current;
      const endRow = Math.min(startRow + ROWS_PER_BATCH, totalRowCount || 0);

      // Check if we have prefetched data for this range
      if (
        prefetchedData.length > 0 &&
        prefetchedRowRangeRef.current &&
        prefetchedRowRangeRef.current.start === startRow &&
        prefetchedRowRangeRef.current.end === endRow
      ) {
        // Use prefetched data
        setData(prevData => [...prevData, ...prefetchedData]);
        setPrefetchedData([]);
        prefetchedRowRangeRef.current = null;

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
              Authorization: `Bearer ${tokens?.idToken}`,
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
        response = await fetch(`${process.env.NEXT_PUBLIC_FARGATE_API_URL}/api/files/fetch-page`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokens?.idToken}`,
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
        response = await fetch(`${process.env.NEXT_PUBLIC_FARGATE_API_URL}/api/files/fetch-page`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokens?.idToken}`,
          },
          body: JSON.stringify(requestBody),
        });
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Failed to fetch data: ${response.status} ${errorText}`);
      }

      const data = await response.json();

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

          setData(prevData => [...prevData, ...newRows]);
        }
      }

      const newLastLoadedRow = lastLoadedRowRef.current + ROWS_PER_BATCH;
      lastLoadedRowRef.current = newLastLoadedRow;

      // Immediately start prefetching the next page after loading
      if (newLastLoadedRow < (totalRowCount || 0)) {
        setTimeout(() => {
          if (!isPrefetchingRef.current) {
            prefetchNextPage();
          }
        }, 0);

        // Also trigger another fetch if we're still close to the end
        // This ensures continuous loading without requiring more scrolling
        setTimeout(() => {
          if (!loadingRef.current && newLastLoadedRow < (totalRowCount || 0)) {
            fetchMoreRows();
          }
        }, 100);
      }
    } catch (error) {
    } finally {
      setIsLoading(false);
      loadingRef.current = false;
    }
  }, [
    decodedFilePath,
    initialColumns,
    totalRowCount,
    sorting,
    columnFilters,
    isProjectFile,
    tokens?.idToken,
  ]);

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
              Authorization: `Bearer ${tokens?.idToken}`,
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
            Authorization: `Bearer ${tokens?.idToken}`,
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
            Authorization: `Bearer ${tokens?.idToken}`,
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

        setPrefetchedData(newRows);
        prefetchedRowRangeRef.current = { start: nextStartRow, end: nextEndRow };
      }
    } catch (error) {
      console.warn('Prefetch error:', error);
    } finally {
      isPrefetchingRef.current = false;
    }
  }, [
    decodedFilePath,
    initialColumns,
    totalRowCount,
    sorting,
    columnFilters,
    isProjectFile,
    tokens?.idToken,
  ]);

  // Initial data loading and prefetch after component loads
  useEffect(() => {
    if (
      !isProjectFile &&
      decodedFilePath &&
      initialData.length > 0 &&
      lastLoadedRowRef.current < (totalRowCount || 0)
    ) {
      // Load more data immediately if we have a large dataset but only initial data
      if (
        totalRowCount &&
        totalRowCount > initialData.length &&
        lastLoadedRowRef.current < totalRowCount
      ) {
        const timer = setTimeout(() => {
          fetchMoreRows();
        }, INITIAL_PREFETCH_DELAY);
        return () => clearTimeout(timer);
      }
    }
  }, [decodedFilePath, isProjectFile, totalRowCount, initialData.length, fetchMoreRows]);

  // Additional effect to ensure data loading on mount for large datasets
  useEffect(() => {
    if (
      !isProjectFile &&
      decodedFilePath &&
      totalRowCount &&
      totalRowCount > ROWS_PER_BATCH &&
      lastLoadedRowRef.current < totalRowCount &&
      !loadingRef.current
    ) {
      // If we have a large dataset but haven't loaded much data yet, load more
      const timer = setTimeout(() => {
        if (!loadingRef.current) {
          fetchMoreRows();
        }
      }, 200); // Slightly longer delay to avoid conflicts
      return () => clearTimeout(timer);
    }
  }, [decodedFilePath, isProjectFile, totalRowCount, fetchMoreRows]);

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
                Authorization: `Bearer ${tokens?.idToken}`,
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

            setData(newRows);
            lastLoadedRowRef.current = newRows.length;
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

  const rowVirtualizer = useVirtualizer({
    count: totalRowCount || rows.length, // Use actual total row count when available
    getScrollElement: () => tableContainerRef.current,
    estimateSize: useCallback(() => 28, []),
    overscan: 20,
    measureElement: undefined,
  });

  const cellRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Ensure the focused cell is in view
  useEffect(() => {
    if (!focusedCell || !tableContainerRef.current) return;

    const container = tableContainerRef.current;
    const cellElement = container.querySelector(
      `[data-row-index="${focusedCell.rowIndex}"][data-column-id="${focusedCell.columnId}"]`
    ) as HTMLElement | null;

    if (!cellElement) return;

    // Get container dimensions
    const containerRect = container.getBoundingClientRect();
    const cellRect = cellElement.getBoundingClientRect();

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
    const cellRef = cellRefs.current.get(`${focusedCell.rowIndex}-${focusedCell.columnId}`);
    if (cellRef) {
      cellRef.focus();
    }
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

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.target as HTMLDivElement;
      const { scrollHeight, scrollTop, clientHeight, scrollWidth, scrollLeft, clientWidth } =
        target;

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

      // Load more data when we're within 2 pages of the end of loaded data
      const shouldLoadMore = virtualScrollPosition + rowsPerPage * 2 >= currentLoadedRows;

      if (shouldLoadMore && !isLoading && isFileMode) {
        if (lastLoadedRowRef.current < (totalRowCount || 0)) {
          fetchMoreRows();
        } else {
          addEmptyRows();
        }
      }

      // Fallback to percentage-based loading for edge cases
      if (verticalScrollPercentage > SCROLL_PERCENTAGE_THRESHOLD && !isLoading && !shouldLoadMore) {
        if (isFileMode) {
          if (lastLoadedRowRef.current < (totalRowCount || 0)) {
            fetchMoreRows();
          } else {
            addEmptyRows();
          }
        } else {
          addEmptyRows();
        }
      }

      // Horizontal scroll check
      const horizontalScrollPercentage = (scrollLeft + clientWidth) / scrollWidth;
      if (horizontalScrollPercentage > SCROLL_PERCENTAGE_THRESHOLD) {
        addExtraColumns();
      }
    },
    [isLoading, isFileMode, fetchMoreRows, addEmptyRows, totalRowCount, prefetchNextPage]
  );

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

  useEffect(() => {
    // Force virtualization recalculation and check if we need more data
    rowVirtualizer.measure();

    // After data loads, check if we should load more automatically
    if (isFileMode && !isLoading && tableContainerRef.current) {
      const container = tableContainerRef.current;
      const { scrollHeight, scrollTop, clientHeight } = container;
      const verticalScrollPercentage = (scrollTop + clientHeight) / scrollHeight;

      // If user is still near the bottom after new data loads, continue loading
      if (verticalScrollPercentage > 0.6 && lastLoadedRowRef.current < (totalRowCount || 0)) {
        setTimeout(() => {
          if (!loadingRef.current) {
            fetchMoreRows();
          }
        }, 200);
      }
    }
  }, [data.length, rowVirtualizer, isFileMode, isLoading, totalRowCount, fetchMoreRows]);

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
          if (message.userId !== wsService.userId) {
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

  // Update the handleCellEdit function
  const handleCellEdit = useCallback(
    (rowIndex: number, columnId: string, value: any) => {
      // If the columnId has [object Object] in it, use the numeric part instead
      const useColumnId = /object Object/.test(columnId)
        ? columnId.replace(/\[object Object\](_duplicated_)?/, '')
        : columnId;

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

      // Mark tab as dirty and update tab data properly
      if (tabId && activeTab?.data) {
        const updatedData = {
          ...activeTab.data,
          initialData: data.map((row, idx) => {
            if (idx === rowIndex) {
              return { ...row, [useColumnId]: value };
            }
            return row;
          }),
        };

        // Update the tab
        updateTab(tabId, {
          data: updatedData,
          isDirty: true,
        });
      }

      // Send update via WebSocket service if connected
      if (wsReady && currentSession) {
        wsService.sendCellUpdate(tabId, rowIndex, useColumnId, value);
      }
    },
    [data, tabId, activeTab, updateTab, wsReady, currentSession]
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
      />
    );

    WrappedHeaderComponent.displayName = 'HeaderComponentWrapper';
    return WrappedHeaderComponent;
  }, [table, showStats, columnStats, handleHeaderEdit, isLoadingStats]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (focusedCell) {
        handleKeyboardNavigation({
          e,
          focusedCell,
          table,
          rows,
          onPositionChange: newPosition => {
            setFocusedCell(newPosition);
            requestAnimationFrame(() => {
              const cellRef = cellRefs.current.get(
                `${newPosition.rowIndex}-${newPosition.columnId}`
              );
              if (cellRef) cellRef.focus();
            });
          },
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [focusedCell, table, rows.length]);

  useEffect(() => {
    return () => {
      saveSpreadsheetState.cancel();
    };
  }, [saveSpreadsheetState]);

  return (
    <div className="flex h-full flex-col">
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
        className="relative flex-1"
        style={{
          height: 'calc(100vh - 60px)',
          overflow: 'auto',
        }}
      >
        <table className="w-full border-collapse text-xs" style={{ display: 'grid' }}>
          <TableHeader
            style={{
              display: 'grid',
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

          {/* Inside the table body cell rendering */}
          <TableBody
            style={{
              display: 'grid',
              height: `${rowVirtualizer.getTotalSize()}px`,
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map(virtualRow => {
              const row = rows[virtualRow.index];
              if (!row) return null;

              return (
                <TableRow
                  key={row.id}
                  data-index={virtualRow.index}
                  className={cn(
                    row.getIsSelected() && 'bg-muted/50' // Adds a subtle background color when selected
                  )}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                    display: 'flex',
                  }}
                >
                  {row.getVisibleCells().map(cell => (
                    <TableCell
                      key={cell.id}
                      data-row-index={virtualRow.index}
                      data-column-id={cell.column.id}
                      ref={cellRef => {
                        if (cellRef) {
                          cellRefs.current.set(`${virtualRow.index}-${cell.column.id}`, cellRef);
                        }
                      }}
                      className={cn(
                        'border-r border-border last:border-r-0 tabular-nums',
                        focusedCell?.rowIndex === virtualRow.index &&
                          focusedCell?.columnId === cell.column.id &&
                          'relative z-10'
                      )}
                      style={{
                        width: cell.column.getSize() || 150,
                        minWidth: cell.column.getSize() || 150,
                        display: 'flex',
                        alignItems: 'center',
                        padding: 0,
                      }}
                    >
                      {cell.column.id === 'select' ? (
                        flexRender(cell.column.columnDef.cell, cell.getContext())
                      ) : (
                        <EditableCell
                          value={(cell.getValue() as string | number | null) || ''}
                          onEdit={(value: any) =>
                            handleCellEdit(virtualRow.index, cell.column.id, value)
                          }
                          className="h-7 w-full px-2"
                          isFocused={
                            focusedCell?.rowIndex === virtualRow.index &&
                            focusedCell?.columnId === cell.column.id
                          }
                          onFocus={() => {
                            setFocusedCell({
                              rowIndex: virtualRow.index,
                              columnId: cell.column.id,
                            });
                          }}
                        />
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </table>
      </div>
    </div>
  );
}

export default Spreadsheet;
