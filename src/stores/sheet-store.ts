import { create } from 'zustand';
import { SheetState, SheetOp } from '@/types/sheet';

interface SheetStoreState {
  sheets: Map<string, SheetState>;
  setSheet: (sheetId: string, state: SheetState) => void;
  getSheet: (sheetId: string) => SheetState | null;
  applyOperation: (sheetId: string, op: SheetOp) => void;
  removeSheet: (sheetId: string) => void;
}

export const useSheetStore = create<SheetStoreState>((set, get) => ({
  sheets: new Map(),

  setSheet: (sheetId: string, state: SheetState) => {
    set(store => {
      const newSheets = new Map(store.sheets);
      newSheets.set(sheetId, state);
      return { sheets: newSheets };
    });
  },

  getSheet: (sheetId: string) => {
    return get().sheets.get(sheetId) || null;
  },

  applyOperation: (sheetId: string, op: SheetOp) => {
    const state = get().sheets.get(sheetId);
    if (!state) return;

    let newData = [...state.data];
    let newColumns = [...state.columns];

    switch (op.kind) {
      case 'update_cell': {
        if (op.row >= 0 && op.row < newData.length) {
          newData = newData.map((row, idx) =>
            idx === op.row ? { ...row, [op.column]: op.newValue } : row
          );
        }
        break;
      }

      case 'append_rows': {
        newData = [...newData, ...op.rows];
        break;
      }

      case 'delete_row': {
        if (op.row >= 0 && op.row < newData.length) {
          newData = newData.filter((_, idx) => idx !== op.row);
        }
        break;
      }

      case 'insert_row': {
        const insertIndex = Math.min(op.index, newData.length);
        newData = [...newData.slice(0, insertIndex), op.row, ...newData.slice(insertIndex)];
        break;
      }

      case 'rename_column': {
        newColumns = newColumns.map(col => (col === op.oldName ? op.newName : col));
        newData = newData.map(row => {
          const newRow = { ...row };
          if (op.oldName in newRow) {
            newRow[op.newName] = newRow[op.oldName];
            delete newRow[op.oldName];
          }
          return newRow;
        });
        break;
      }

      case 'add_column': {
        newColumns = [...newColumns, op.name];
        newData = newData.map(row => ({
          ...row,
          [op.name]: op.defaultValue ?? null,
        }));
        break;
      }
    }

    const updatedState: SheetState = {
      ...state,
      data: newData,
      columns: newColumns,
      version: state.version + 1,
    };

    get().setSheet(sheetId, updatedState);
  },

  removeSheet: (sheetId: string) => {
    set(store => {
      const newSheets = new Map(store.sheets);
      newSheets.delete(sheetId);
      return { sheets: newSheets };
    });
  },
}));
