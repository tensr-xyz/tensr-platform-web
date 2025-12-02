import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface ClipboardData {
  type: 'cells';
  data: Array<Array<string | number | null>>;
  rowCount: number;
  columnCount: number;
}

interface ClipboardState {
  data: ClipboardData | null;
  cutMode: boolean; // If true, cells were cut (will be deleted on paste)
  cutOrigin: { rowIndex: number; columnId: string } | null;
}

interface ClipboardActions {
  copy: (data: ClipboardData) => void;
  cut: (data: ClipboardData, origin: { rowIndex: number; columnId: string }) => void;
  paste: () => ClipboardData | null;
  clear: () => void;
  hasData: () => boolean;
  isCut: () => boolean;
  getCutOrigin: () => { rowIndex: number; columnId: string } | null;
}

type ClipboardStore = ClipboardState & ClipboardActions;

export const useClipboardStore = create<ClipboardStore>()(
  devtools(
    (set, get) => ({
      data: null,
      cutMode: false,
      cutOrigin: null,

      copy: (clipboardData: ClipboardData) => {
        set({
          data: clipboardData,
          cutMode: false,
          cutOrigin: null,
        });
      },

      cut: (clipboardData: ClipboardData, origin: { rowIndex: number; columnId: string }) => {
        set({
          data: clipboardData,
          cutMode: true,
          cutOrigin: origin,
        });
      },

      paste: () => {
        const { data } = get();
        return data;
      },

      clear: () => {
        set({
          data: null,
          cutMode: false,
          cutOrigin: null,
        });
      },

      hasData: () => {
        return get().data !== null;
      },

      isCut: () => {
        return get().cutMode;
      },
      
      getCutOrigin: () => {
        return get().cutOrigin;
      },
    }),
    { name: 'ClipboardStore' }
  )
);

