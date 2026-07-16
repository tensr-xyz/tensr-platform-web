import { ColumnDef } from '@tanstack/react-table';
import { ColumnSummary } from '@/types/file';

export interface CellPosition {
  rowIndex: number;
  columnId: string;
}

export interface CellRange {
  start: CellPosition;
  end: CellPosition;
}

export type SelectionMode = 'single' | 'range' | 'extending';

export interface SheetStatusSnapshot {
  visibleColumns: number;
  totalColumns: number;
  cellRef: string | null;
  /** Selection aggregates for Excel-style status bar (D2). */
  selectionCount?: number | null;
  selectionSum?: number | null;
  selectionAvg?: number | null;
}

export interface SpreadsheetProps {
  initialData: Record<string, any>[];
  initialColumns: ColumnDef<any>[];
  columnStats?: Record<string, ColumnSummary>;
  showMenu?: boolean;
  showStats?: boolean;
  onChange?: (data: Record<string, any>[]) => void;
  filePath?: string;
  totalRowCount: number;
  tabId: string;
  showFilters?: boolean;
  onCloseFilters?: () => void;
  /** Reveal the filter row (e.g. from the column header dropdown "Filter…"). */
  onRequestShowFilters?: () => void;
  onSelectionChange?: (selection: Record<string, boolean>) => void;
  onSheetStatusChange?: (status: SheetStatusSnapshot) => void;
  tabData?: { isProjectFile?: boolean; sheetId?: string; datasetId?: string };
  /** Row operations (e.g. context menu); indices are 0-based sheet row indices. */
  onInsertRow?: (rowIndex: number, placement: 'above' | 'below') => void;
  onDeleteRows?: (rowIndices: number[]) => void;
}

export interface SortConfig {
  column: string;
  desc: boolean;
}
