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
} from '@tanstack/react-table';
import {
  EditableCell,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/molecules/table';
import { createColumns } from '@/components/templates/spreadsheet/columns.tsx';
import { HeaderComponent } from '@/components/templates/spreadsheet/header.tsx';
import { useSession, wsService } from '@/hooks/ui/use-session';
import { cn } from '@/utils';
import { useTabs } from '@/contexts/tabs-context';
import { ColumnSummary } from '@/types/file';
import Filters from '@/components/templates/spreadsheet/filters.tsx';
import { PageResponse } from '@/types/project';
import { CellPosition, SortConfig, SpreadsheetProps } from '@/types/spreadsheet';
import { handleKeyboardNavigation } from '@/utils/spreadsheet';

const INITIAL_EMPTY_ROWS = 200;
const ROWS_PER_BATCH = 100;
const EXTRA_COLUMNS = 10;
const DEFAULT_COLUMN_WIDTH = 150;
const SCROLL_PERCENTAGE_THRESHOLD = 0.5;

export function Spreadsheet({
  initialData,
  initialColumns,
  showStats = false,
  filePath,
  totalRowCount,
  tabId,
  showFilters = false,
  onCloseFilters,
}: SpreadsheetProps) {
  const tableContainerRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  const loadingRef = useRef(false);
  const lastLoadedRowRef = useRef(initialData.length);
  const [columnStats, setColumnStats] = useState<Record<string, ColumnSummary> | null>(null);
  const [focusedCell, setFocusedCell] = useState<CellPosition | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const statsLoadAttempted = useRef(false);

  // Memoize the decoded file path
  const decodedFilePath = useMemo(
    () => (filePath ? decodeURIComponent(filePath) : null),
    [filePath]
  );

  // Reset stats when file path changes
  useEffect(() => {
    if (filePath) {
      setColumnStats(null);
      statsLoadAttempted.current = false;
    }
  }, [filePath]);

  // Load statistics
  const loadColumnStats = useCallback(async () => {
    if (!showStats || !decodedFilePath || statsLoadAttempted.current) {
      return;
    }

    try {
      setIsLoadingStats(true);
      statsLoadAttempted.current = true;

      const stats = {}
      // const stats = await invoke('analyse_csv', {
      //   request: {
      //     path: decodedFilePath,
      //   },
      // });

      if (!stats || typeof stats !== 'object') {
        throw new Error('Invalid statistics data received');
      }

      setColumnStats(stats);
    } catch (error) {
    } finally {
      setIsLoadingStats(false);
    }
  }, [decodedFilePath, showStats, columnStats]);

  // Trigger statistics loading when needed
  useEffect(() => {
    if (showStats && decodedFilePath && !columnStats && !isLoadingStats) {
      loadColumnStats();
    }
  }, [showStats, decodedFilePath, columnStats, isLoadingStats, loadColumnStats]);

  const isFileMode = !!filePath;

  // Initialize data based on mode
  const [data, setData] = useState(() => {
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

  const { state } = useTabs();
  const activeTab = state.tabs.find(tab => tab.id === state.activeTabId);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnSizing, setColumnSizing] = useState({});
  const [extraColumnsCount, setExtraColumnsCount] = useState(EXTRA_COLUMNS);
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    activeTab?.data?.columnVisibility || {}
  );

  useEffect(() => {
    if (activeTab?.data?.columnVisibility) {
      setColumnVisibility(activeTab.data.columnVisibility);
    }
  }, [activeTab?.data?.columnVisibility]);

  const columns = useMemo(
    () =>
      createColumns({
        initialColumns,
        extraColumnsCount,
        setData,
        DEFAULT_COLUMN_WIDTH,
      }),
    [initialColumns, extraColumnsCount]
  );

  const fetchMoreRows = useCallback(async () => {
    if (!decodedFilePath || loadingRef.current) {
      return;
    }

    try {
      loadingRef.current = true;
      setIsLoading(true);

      const startRow = lastLoadedRowRef.current;
      const endRow = Math.min(startRow + ROWS_PER_BATCH, totalRowCount);

      // Convert TanStack Table sorting state to backend format
      const sortConfig: SortConfig[] | undefined =
        sorting.length > 0
          ? sorting.map(sort => ({
              column: sort.id,
              desc: sort.desc,
            }))
          : undefined;

      const filterConfig = columnFilters.map(filter => {
        const { operator, value } = filter.value || {};

        // Always convert value to string
        const stringValue = String(value);

        return {
          column: filter.id,
          operator,
          value: stringValue,
        };
      });

      const response = await invoke<PageResponse>('fetch_csv_page', {
        request: {
          path: decodedFilePath,
          start_row: startRow,
          end_row: endRow,
          sort: sortConfig,
          filters: filterConfig,
        },
      });

      if (startRow >= totalRowCount) {
        setData(prevData => [
          ...prevData,
          ...Array(ROWS_PER_BATCH)
            .fill(null)
            .map((_, index) => ({
              id: `empty-${prevData.length + index}`,
            })),
        ]);
      } else {
        const newRows = response.data[0].map((_, rowIndex) => {
          const row = { id: `row-${startRow + rowIndex}` };
          initialColumns.forEach((col, colIndex) => {
            row[col.id] = response.data[colIndex][rowIndex];
          });
          return row;
        });

        setData(prevData => [...prevData, ...newRows]);
      }

      const newLastLoadedRow = lastLoadedRowRef.current + ROWS_PER_BATCH;
      lastLoadedRowRef.current = newLastLoadedRow;
    } catch (error) {
    } finally {
      setIsLoading(false);
      loadingRef.current = false;
    }
  }, [decodedFilePath, initialColumns, totalRowCount, sorting, columnFilters]);

  const handleSortingChange = useCallback(
    async (newSorting: SortingState) => {
      // Reset the data and pagination state when sort changes
      setData([]);
      lastLoadedRowRef.current = 0;

      // Update the sorting state
      setSorting(newSorting);

      // Refetch data with new sorting
      await fetchMoreRows();
    },
    [fetchMoreRows]
  );

  const fetchFilteredData = useCallback(
    (newFilters: ColumnFiltersState) => {
      console.log('Fetching filtered data with filters:', newFilters);

      // Directly set column filters
      setColumnFilters(newFilters);

      // Reset data and pagination
      setData([]);
      lastLoadedRowRef.current = 0;

      // Use a callback to ensure we're working with the latest state
      const fetchData = async () => {
        try {
          // Capture the filters immediately after setting state
          const currentFilters = newFilters;

          const startRow = 0;
          const endRow = ROWS_PER_BATCH;

          const filterConfig = currentFilters.map(filter => {
            const { operator, value } = filter.value || {};
            return {
              column: filter.id,
              operator,
              value: String(value),
            };
          });

          const response = {}
          // const response = await invoke<PageResponse>('fetch_csv_page', {
          //   request: {
          //     path: decodedFilePath,
          //     start_row: startRow,
          //     end_row: endRow,
          //     filters: filterConfig,
          //   },
          // });

          // Process the response
          if (response.data && response.data[0]) {
            const newRows = response.data[0].map((_, rowIndex) => {
              const row = { id: `row-${rowIndex}` };
              initialColumns.forEach((col, colIndex) => {
                row[col.id] = response.data[colIndex][rowIndex];
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
    count: rows.length + ROWS_PER_BATCH, // Always show extra rows
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
    );

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
      if (verticalScrollPercentage > SCROLL_PERCENTAGE_THRESHOLD && !isLoading) {
        if (isFileMode) {
          if (lastLoadedRowRef.current < totalRowCount) {
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
    [isLoading, isFileMode, fetchMoreRows, addEmptyRows, totalRowCount]
  );

  const handleHeaderEdit = useCallback(
    (columnId: string, value: string) => {
      table.getAllColumns().forEach(column => {
        if (column.id === columnId && column.columnDef.header) {
          // @ts-ignore - We know this is safe since we're checking for header existence
          column.columnDef.header = value;
        }
      });
    },
    [table]
  );

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
      // Update local state immediately
      setData(prevData => {
        const newData = [...prevData];
        if (!newData[rowIndex]) {
          newData[rowIndex] = { id: `row-${rowIndex}` };
        }
        newData[rowIndex] = {
          ...newData[rowIndex],
          [columnId]: value,
        };
        return newData;
      });

      // Send update via WebSocket service if connected
      if (wsReady && currentSession) {
        wsService.sendCellUpdate(tabId, rowIndex, columnId, value);
      }
    },
    [wsReady, currentSession, tabId]
  );

  const HeaderComponentWrapper = useMemo(
    () =>
      ({ header }: { header: Header<any, unknown> }) => (
        <HeaderComponent
          header={header}
          table={table}
          showStats={showStats}
          columnStats={columnStats}
          onHeaderEdit={handleHeaderEdit}
          isLoadingStats={isLoadingStats}
        />
      ),
    [table, showStats, columnStats, handleHeaderEdit]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      handleKeyboardNavigation({
        e,
        focusedCell,
        table,
        rows,
        onPositionChange: newPosition => {
          setFocusedCell(newPosition);
          requestAnimationFrame(() => {
            const cellRef = cellRefs.current.get(`${newPosition.rowIndex}-${newPosition.columnId}`);
            if (cellRef) cellRef.focus();
          });
        },
      });
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [focusedCell, table, rows.length]);

  return (
    <div className="flex h-full flex-col">
      {showFilters && (
        <div className="border-b bg-background">
          <Filters
            table={table}
            onClearFilters={() => {
              setColumnFilters([]);
              setData([]);
              lastLoadedRowRef.current = 0;
              fetchMoreRows();
            }}
            onCloseFilters={() => onCloseFilters?.()}
            onFetchFilteredData={fetchFilteredData} // New prop
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
                        'border-r border-border last:border-r-0 border-b tabular-nums',
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
                          value={cell.getValue() ?? ''}
                          onEdit={value => handleCellEdit(virtualRow.index, cell.column.id, value)}
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
