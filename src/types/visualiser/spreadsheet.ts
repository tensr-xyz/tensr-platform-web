// ColumnDef type available from @tanstack/react-table when needed

export interface CellPosition {
  rowIndex: number;
  columnId: string;
}

export interface SpreadsheetProps {
  initialData: Record<string, any>[];
  initialColumns: Column[];
  onChange?: (data: Record<string, any>[]) => void;
  tabId: string;
  onSelectionChange?: (selection: Record<string, boolean>) => void;
}

export interface Column {
  id: string;
  accessor: string;
  header: string;
  width: number;
  type: string;
}

export interface SortConfig {
  column: string;
  desc: boolean;
}
