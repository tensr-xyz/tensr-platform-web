'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  SortingState,
  useReactTable,
  getCoreRowModel,
  flexRender,
  Header,
} from '@tanstack/react-table';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  EditableCell,
} from '@/components/templates/visualiser/molecules/table';
import {
  createColumns,
  CreateColumnsProps,
} from '@/components/templates/visualiser/templates/spreadsheet/columns';
import { HeaderComponent } from '@/components/templates/visualiser/templates/spreadsheet/header';
import { cn } from '@/utils';
import { CellPosition, SpreadsheetProps } from '@/types/visualiser/spreadsheet';
import { handleKeyboardNavigation } from '@/utils/visualiser/spreadsheet';

const INITIAL_EMPTY_ROWS = 200;
const EXTRA_COLUMNS = 10;
const DEFAULT_COLUMN_WIDTH = 150;

type RowType = Record<string, any> & { id: string };

const MemoizedTableCell = React.memo<{
  cell: any;
  rowIndex: number;
  columnId: string;
  cellKey: string;
  isCellFocused: boolean;
  cellRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  handleCellEdit: (rowIndex: number, columnId: string, value: any) => void;
  setFocusedCell: (position: { rowIndex: number; columnId: string }) => void;
}>(
  ({
    cell,
    rowIndex,
    columnId,
    cellKey,
    isCellFocused,
    cellRefs,
    handleCellEdit,
    setFocusedCell,
  }) => {
    const onEdit = useCallback(
      (value: any) => {
        handleCellEdit(rowIndex, columnId, value);
      },
      [rowIndex, columnId, handleCellEdit]
    );

    const onFocus = useCallback(() => {
      setFocusedCell({ rowIndex, columnId });
    }, [rowIndex, columnId, setFocusedCell]);

    const cellValue = cell.getValue();
    const columnSize = cell.column.getSize() || 150;

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
        className={cn(
          'border-r border-b border-border last:border-r-0 tabular-nums',
          isCellFocused && 'relative z-10'
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
          <div className="h-7 w-full px-2">
            <EditableCell
              value={cellValue ?? ''}
              onEdit={onEdit}
              className="h-7"
              isFocused={isCellFocused}
              onFocus={onFocus}
            />
          </div>
        )}
      </TableCell>
    );
  },
  (prevProps, nextProps) => {
    const cellValueChanged = prevProps.cell.getValue() !== nextProps.cell.getValue();
    const focusChanged = prevProps.isCellFocused !== nextProps.isCellFocused;
    const sizeChanged = prevProps.cell.column.getSize() !== nextProps.cell.column.getSize();
    return !cellValueChanged && !focusChanged && !sizeChanged;
  }
);

MemoizedTableCell.displayName = 'MemoizedTableCell';

export function Spreadsheet({
  initialData,
  initialColumns,
  onChange,
  tabId: _tabId,
  onSelectionChange,
}: SpreadsheetProps) {
  const tableContainerRef = useRef<HTMLDivElement | null>(null);
  const [containerHeight, setContainerHeight] = useState<number | null>(null);
  const [focusedCell, setFocusedCell] = useState<CellPosition | null>(null);
  const [rowSelection, setRowSelection] = useState({});
  const [columnSizing, setColumnSizing] = useState({});
  const [extraColumnsCount] = useState(EXTRA_COLUMNS);

  const [data, setData] = useState<RowType[]>(() => {
    if (initialData.length > 0) {
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
      return Array(INITIAL_EMPTY_ROWS)
        .fill(null)
        .map((_, index) => ({
          id: `row-${index}`,
        }));
    }
  });

  const [sorting, setSorting] = useState<SortingState>([]);

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

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      rowSelection,
      columnSizing,
    },
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    enableMultiSort: true,
  });

  const { rows } = table.getRowModel();

  const [, startTransition] = useTransition();

  // Calculate total table width from column sizes
  const totalTableWidth = useMemo(() => {
    const width = table.getAllColumns().reduce((sum, col) => {
      return sum + (col.getSize() || DEFAULT_COLUMN_WIDTH);
    }, 0);
    // Ensure minimum width to enable horizontal scrolling
    return Math.max(width, 1000);
  }, [table]);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: useCallback(() => 28, []),
    overscan: 5,
  });

  useEffect(() => {
    if (!tableContainerRef.current) return;

    const container = tableContainerRef.current;
    const parent = container.parentElement;

    if (!parent) return;

    const updateHeight = () => {
      const parentRect = parent.getBoundingClientRect();
      const parentHeight = parentRect.height;
      const parentComputedHeight = window.getComputedStyle(parent).height;

      if (
        parentComputedHeight &&
        parentComputedHeight !== 'auto' &&
        !parentComputedHeight.includes('%')
      ) {
        const heightValue = parseFloat(parentComputedHeight);
        if (!isNaN(heightValue) && heightValue > 0) {
          setContainerHeight(Math.max(100, heightValue));
          return;
        }
      }

      if (parentHeight > 0 && parentHeight < window.innerHeight && parentHeight < 2000) {
        setContainerHeight(Math.max(100, parentHeight));
      } else {
        const viewportHeight = window.innerHeight;
        const estimatedHeight = Math.max(100, viewportHeight - 250);
        setContainerHeight(estimatedHeight);
      }
    };

    updateHeight();

    const resizeObserver = new ResizeObserver(() => {
      updateHeight();
    });

    resizeObserver.observe(parent);
    resizeObserver.observe(container);

    window.addEventListener('resize', updateHeight);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, []);

  const cellRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (!focusedCell || !tableContainerRef.current) return;

    const cellRef = cellRefs.current.get(`${focusedCell.rowIndex}-${focusedCell.columnId}`);
    if (!cellRef) return;

    const container = tableContainerRef.current;

    requestAnimationFrame(() => {
      const containerRect = container.getBoundingClientRect();
      const cellRect = cellRef.getBoundingClientRect();

      const isAbove = cellRect.top < containerRect.top;
      const isBelow = cellRect.bottom > containerRect.bottom;
      const isLeft = cellRect.left < containerRect.left;
      const isRight = cellRect.right > containerRect.right;

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

      cellRef.focus();
    });
  }, [focusedCell]);

  const handleCellEdit = useCallback(
    (rowIndex: number, columnId: string, value: any) => {
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

      if (onChange) {
        startTransition(() => {
          setData(currentData => {
            onChange(
              currentData.map(row => {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { id, ...rest } = row;
                return rest;
              })
            );
            return currentData;
          });
        });
      }
    },
    [onChange]
  );

  useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange(rowSelection);
    }
  }, [rowSelection, onSelectionChange]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedCell, table]);

  return (
    <div
      className="flex h-full flex-col overflow-hidden"
      style={{
        minHeight: 0,
        height: '100%',
      }}
    >
      <div
        ref={tableContainerRef}
        className="relative flex-1 overflow-auto"
        style={{
          height: containerHeight ? `${containerHeight}px` : 'calc(100vh - 250px)',
          maxHeight: containerHeight ? `${containerHeight}px` : 'calc(100vh - 250px)',
          minHeight: 0,
          width: '100%',
          overflow: 'auto',
          position: 'relative',
          padding: 0,
          margin: 0,
        }}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: `${totalTableWidth}px`,
            minWidth: `${totalTableWidth}px`,
            position: 'relative',
            padding: 0,
            margin: 0,
          }}
        >
          <table
            className="border-collapse text-xs"
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
                  className="!border-none"
                  style={{
                    display: 'flex',
                    width: `${totalTableWidth}px`,
                    minWidth: `${totalTableWidth}px`,
                  }}
                >
                  {headerGroup.headers.map(header => (
                    <TableHead
                      key={header.id}
                      className="sticky top-0 flex items-center whitespace-nowrap bg-background border-r border-b border-border last:border-r-0"
                      style={{
                        width: header.getSize() || 150,
                        minWidth: header.getSize() || 150,
                        height: '28px',
                        padding: 0,
                      }}
                    >
                      <HeaderComponent header={header} />
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>

            <TableBody
              style={{
                display: 'block',
                height: `${rowVirtualizer.getTotalSize()}px`,
                minHeight: `${rowVirtualizer.getTotalSize()}px`,
                position: 'relative',
                width: `${totalTableWidth}px`,
                minWidth: `${totalTableWidth}px`,
                boxSizing: 'border-box',
                padding: 0,
                margin: 0,
              }}
            >
              {rowVirtualizer.getVirtualItems().map(virtualRow => {
                const row = rows[virtualRow.index];
                const rowIndex = virtualRow.index;

                if (!row) return null;

                const isFocused = focusedCell?.rowIndex === rowIndex;

                return (
                  <TableRow
                    key={row.id}
                    data-index={rowIndex}
                    className={cn('!border-b-0')}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: `${totalTableWidth}px`,
                      minWidth: `${totalTableWidth}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                      display: 'flex',
                      borderBottom: 'none',
                      boxSizing: 'border-box',
                    }}
                  >
                    {row.getVisibleCells().map(cell => {
                      const columnId = cell.column.id;
                      const cellKey = `${rowIndex}-${columnId}`;
                      const isCellFocused = isFocused && focusedCell?.columnId === columnId;

                      return (
                        <MemoizedTableCell
                          key={cell.id}
                          cell={cell}
                          rowIndex={rowIndex}
                          columnId={columnId}
                          cellKey={cellKey}
                          isCellFocused={isCellFocused}
                          cellRefs={cellRefs}
                          handleCellEdit={handleCellEdit}
                          setFocusedCell={setFocusedCell}
                        />
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Spreadsheet;
