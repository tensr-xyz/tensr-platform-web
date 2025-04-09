import { CellPosition } from '@/types/spreadsheet';
import { Table } from '@tanstack/react-table';

interface HandleKeyboardNavigationParams {
  e: KeyboardEvent;
  focusedCell: CellPosition | null;
  table: Table<any>;
  rows: any[];
  onPositionChange: (position: CellPosition) => void;
}

export function handleKeyboardNavigation({
  e,
  focusedCell,
  table,
  rows,
  onPositionChange,
}: HandleKeyboardNavigationParams): void {
  if (!focusedCell) return;

  const allColumns = table.getAllColumns();
  const visibleColumns = allColumns.filter(col => col.getIsVisible() && col.id !== 'select');
  const currentColumnIndex = visibleColumns.findIndex(col => col.id === focusedCell.columnId);

  let newPosition: CellPosition | null = null;

  switch (e.key) {
    case 'ArrowUp':
      if (focusedCell.rowIndex > 0) {
        newPosition = {
          rowIndex: focusedCell.rowIndex - 1,
          columnId: focusedCell.columnId,
        };
        e.preventDefault();
      }
      break;

    case 'ArrowDown':
      const nextRow = focusedCell.rowIndex + 1;
      if (nextRow < rows.length) {
        newPosition = {
          rowIndex: nextRow,
          columnId: focusedCell.columnId,
        };
        e.preventDefault();
      }
      break;

    case 'ArrowLeft':
      if (currentColumnIndex > 0) {
        newPosition = {
          rowIndex: focusedCell.rowIndex,
          columnId: visibleColumns[currentColumnIndex - 1].id,
        };
        e.preventDefault();
      }
      break;

    case 'ArrowRight':
      if (currentColumnIndex < visibleColumns.length - 1) {
        newPosition = {
          rowIndex: focusedCell.rowIndex,
          columnId: visibleColumns[currentColumnIndex + 1].id,
        };
        e.preventDefault();
      }
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
