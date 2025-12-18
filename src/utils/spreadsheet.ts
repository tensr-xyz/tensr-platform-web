import { CellPosition, CellRange, SelectionMode } from '@/types/spreadsheet';
import { Table } from '@tanstack/react-table';

interface HandleKeyboardNavigationParams {
  e: KeyboardEvent;
  focusedCell: CellPosition | null;
  table: Table<any>;
  rows: any[];
  onPositionChange: (position: CellPosition) => void;
  onRangeChange?: (range: CellRange | null) => void;
  selectionMode?: SelectionMode;
  selectionAnchor?: CellPosition | null;
  extendSelection?: boolean;
}

export function handleKeyboardNavigation({
  e,
  focusedCell,
  table,
  rows,
  onPositionChange,
  onRangeChange,
  selectionMode = 'single',
  selectionAnchor,
  extendSelection = false,
}: HandleKeyboardNavigationParams): void {
  if (!focusedCell) return;

  const allColumns = table.getAllColumns();
  const visibleColumns = allColumns.filter(col => col.getIsVisible() && col.id !== 'select');
  const currentColumnIndex = visibleColumns.findIndex(col => col.id === focusedCell.columnId);
  const isModifierKey = e.metaKey || e.ctrlKey;
  const isShiftKey = e.shiftKey;
  const shouldExtendSelection = isShiftKey || extendSelection;

  let newPosition: CellPosition | null = null;
  let shouldUpdateRange = false;

  switch (e.key) {
    case 'ArrowUp':
      if (isModifierKey) {
        // Ctrl/Cmd + Arrow Up: Jump to top of data region
        newPosition = jumpToEdge('up', focusedCell, visibleColumns, rows, table);
      } else if (focusedCell.rowIndex > 0) {
        newPosition = {
          rowIndex: focusedCell.rowIndex - 1,
          columnId: focusedCell.columnId,
        };
      }
      if (newPosition) {
        shouldUpdateRange = shouldExtendSelection;
        e.preventDefault();
      }
      break;

    case 'ArrowDown':
      if (isModifierKey) {
        // Ctrl/Cmd + Arrow Down: Jump to bottom of data region
        newPosition = jumpToEdge('down', focusedCell, visibleColumns, rows, table);
      } else {
        const nextRow = focusedCell.rowIndex + 1;
        if (nextRow < rows.length) {
          newPosition = {
            rowIndex: nextRow,
            columnId: focusedCell.columnId,
          };
        }
      }
      if (newPosition) {
        shouldUpdateRange = shouldExtendSelection;
        e.preventDefault();
      }
      break;

    case 'ArrowLeft':
      if (isModifierKey) {
        // Ctrl/Cmd + Arrow Left: Jump to left edge of data region
        newPosition = jumpToEdge('left', focusedCell, visibleColumns, rows, table);
      } else if (currentColumnIndex > 0) {
        newPosition = {
          rowIndex: focusedCell.rowIndex,
          columnId: visibleColumns[currentColumnIndex - 1].id,
        };
      }
      if (newPosition) {
        shouldUpdateRange = shouldExtendSelection;
        e.preventDefault();
      }
      break;

    case 'ArrowRight':
      if (isModifierKey) {
        // Ctrl/Cmd + Arrow Right: Jump to right edge of data region
        newPosition = jumpToEdge('right', focusedCell, visibleColumns, rows, table);
      } else if (currentColumnIndex < visibleColumns.length - 1) {
        newPosition = {
          rowIndex: focusedCell.rowIndex,
          columnId: visibleColumns[currentColumnIndex + 1].id,
        };
      }
      if (newPosition) {
        shouldUpdateRange = shouldExtendSelection;
        e.preventDefault();
      }
      break;

    case 'Home':
      if (isModifierKey) {
        // Ctrl/Cmd + Home: Jump to first cell (A1)
        newPosition = {
          rowIndex: 0,
          columnId: visibleColumns[0]?.id || focusedCell.columnId,
        };
        shouldUpdateRange = isShiftKey;
        e.preventDefault();
      } else {
        // Home: Jump to start of row
        newPosition = {
          rowIndex: focusedCell.rowIndex,
          columnId: visibleColumns[0]?.id || focusedCell.columnId,
        };
        shouldUpdateRange = isShiftKey;
        e.preventDefault();
      }
      break;

    case 'End':
      if (isModifierKey) {
        // Ctrl/Cmd + End: Jump to last cell with data
        const lastRow = rows.length - 1;
        const lastCol = visibleColumns[visibleColumns.length - 1]?.id || focusedCell.columnId;
        newPosition = {
          rowIndex: lastRow,
          columnId: lastCol,
        };
        shouldUpdateRange = isShiftKey;
        e.preventDefault();
      } else {
        // End: Jump to end of row
        const lastCol = visibleColumns[visibleColumns.length - 1]?.id || focusedCell.columnId;
        newPosition = {
          rowIndex: focusedCell.rowIndex,
          columnId: lastCol,
        };
        shouldUpdateRange = isShiftKey;
        e.preventDefault();
      }
      break;

    case 'PageUp':
      // Page Up: Move up by viewport height (approximate)
      const pageUpRow = Math.max(0, focusedCell.rowIndex - 20);
      newPosition = {
        rowIndex: pageUpRow,
        columnId: focusedCell.columnId,
      };
      shouldUpdateRange = isShiftKey;
      e.preventDefault();
      break;

    case 'PageDown':
      // Page Down: Move down by viewport height (approximate)
      const pageDownRow = Math.min(rows.length - 1, focusedCell.rowIndex + 20);
      newPosition = {
        rowIndex: pageDownRow,
        columnId: focusedCell.columnId,
      };
      shouldUpdateRange = isShiftKey;
      e.preventDefault();
      break;

    case 'Tab':
      e.preventDefault();
      e.stopPropagation();
      newPosition = handleTabNavigation(
        e.shiftKey,
        currentColumnIndex,
        focusedCell,
        visibleColumns,
        rows
      );
      break;
  }

  if (newPosition) {
    onPositionChange(newPosition);

    // Update range selection if Shift is held or extending
    if (shouldUpdateRange && onRangeChange && selectionAnchor) {
      onRangeChange({
        start: selectionAnchor,
        end: newPosition,
      });
    } else if (!shouldUpdateRange && onRangeChange) {
      // Clear range selection when moving without Shift
      onRangeChange(null);
    }
  }
}

/**
 * Jumps to the edge of the data region in the specified direction
 */
function jumpToEdge(
  direction: 'up' | 'down' | 'left' | 'right',
  currentCell: CellPosition,
  visibleColumns: any[],
  rows: any[],
  table: Table<any>
): CellPosition | null {
  const data = table.getRowModel().rows;
  const currentRowIndex = currentCell.rowIndex;
  const currentColIndex = visibleColumns.findIndex(col => col.id === currentCell.columnId);

  switch (direction) {
    case 'up':
      // Find first row with data in current column
      for (let i = currentRowIndex - 1; i >= 0; i--) {
        const row = data[i];
        if (row && row.original && row.original[currentCell.columnId]) {
          return { rowIndex: i, columnId: currentCell.columnId };
        }
      }
      return { rowIndex: 0, columnId: currentCell.columnId };

    case 'down':
      // Find last row with data in current column
      for (let i = currentRowIndex + 1; i < rows.length; i++) {
        const row = data[i];
        if (row && row.original && row.original[currentCell.columnId]) {
          continue;
        } else if (i > currentRowIndex + 1) {
          return { rowIndex: i - 1, columnId: currentCell.columnId };
        }
      }
      return { rowIndex: rows.length - 1, columnId: currentCell.columnId };

    case 'left':
      // Find first column with data in current row
      if (currentRowIndex < data.length) {
        const row = data[currentRowIndex];
        for (let i = currentColIndex - 1; i >= 0; i--) {
          const colId = visibleColumns[i].id;
          if (row && row.original && row.original[colId]) {
            return { rowIndex: currentRowIndex, columnId: colId };
          }
        }
      }
      return currentColIndex > 0
        ? { rowIndex: currentRowIndex, columnId: visibleColumns[0].id }
        : null;

    case 'right':
      // Find last column with data in current row
      if (currentRowIndex < data.length) {
        const row = data[currentRowIndex];
        for (let i = currentColIndex + 1; i < visibleColumns.length; i++) {
          const colId = visibleColumns[i].id;
          if (row && row.original && row.original[colId]) {
            continue;
          } else if (i > currentColIndex + 1) {
            return { rowIndex: currentRowIndex, columnId: visibleColumns[i - 1].id };
          }
        }
      }
      return currentColIndex < visibleColumns.length - 1
        ? { rowIndex: currentRowIndex, columnId: visibleColumns[visibleColumns.length - 1].id }
        : null;
  }
}

function handleTabNavigation(
  isShiftKey: boolean,
  currentColumnIndex: number,
  focusedCell: CellPosition,
  visibleColumns: any[],
  rows: any[]
): CellPosition | null {
  if (isShiftKey) {
    if (currentColumnIndex > 0) {
      return {
        rowIndex: focusedCell.rowIndex,
        columnId: visibleColumns[currentColumnIndex - 1].id,
      };
    } else if (focusedCell.rowIndex > 0) {
      return {
        rowIndex: focusedCell.rowIndex - 1,
        columnId: visibleColumns[visibleColumns.length - 1].id,
      };
    }
  } else {
    if (currentColumnIndex < visibleColumns.length - 1) {
      return {
        rowIndex: focusedCell.rowIndex,
        columnId: visibleColumns[currentColumnIndex + 1].id,
      };
    } else if (focusedCell.rowIndex < rows.length - 1) {
      return {
        rowIndex: focusedCell.rowIndex + 1,
        columnId: visibleColumns[0].id,
      };
    }
  }
  return null;
}
