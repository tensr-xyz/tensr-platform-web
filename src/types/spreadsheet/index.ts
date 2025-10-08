import { ColumnDef } from '@tanstack/react-table';
import { ColumnSummary } from '@/types/file';

export interface CellPosition {
  rowIndex: number;
  columnId: string;
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
  onSelectionChange?: (selection: Record<string, boolean>) => void;
  tabData?: { isProjectFile?: boolean };
}

export interface SortConfig {
  column: string;
  desc: boolean;
}
