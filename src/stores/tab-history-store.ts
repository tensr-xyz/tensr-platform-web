/**
 * Per-tab undo/redo stacks for spreadsheet-style mutations.
 *
 * Callers `push` a snapshot of the parts of `Tab` they're about to mutate
 * BEFORE performing the mutation. `undo` / `redo` then apply the inverse via
 * the regular `useTabsStore.updateTab` so the existing render path picks it
 * up.
 *
 * Keep the snapshot shape narrow: we only track `name`, `isDirty`, and the
 * subset of `TabData` that data-editing flows touch (columns, rows, column
 * stats, totals). Everything else (analysis report payloads, plugins, etc.)
 * is unaffected.
 */

import { create } from 'zustand';
import type { Column, TabData } from '@/stores/tabs-store';

const MAX_STACK = 50;

export type TabSnapshot = {
  name?: string;
  isDirty?: boolean;
  data?: {
    initialColumns?: Column[];
    initialData?: Record<string, unknown>[];
    columnStats?: Record<string, unknown>;
    totalColumns?: number;
    totalRows?: number;
  };
  label?: string;
};

type Stacks = {
  past: TabSnapshot[];
  future: TabSnapshot[];
};

type TabHistoryState = {
  byTab: Record<string, Stacks>;
  push: (tabId: string, snapshot: TabSnapshot) => void;
  popPast: (tabId: string) => TabSnapshot | null;
  popFuture: (tabId: string) => TabSnapshot | null;
  pushFuture: (tabId: string, snapshot: TabSnapshot) => void;
  pushPast: (tabId: string, snapshot: TabSnapshot) => void;
  clear: (tabId: string) => void;
  canUndo: (tabId: string) => boolean;
  canRedo: (tabId: string) => boolean;
};

const emptyStacks = (): Stacks => ({ past: [], future: [] });

export const useTabHistoryStore = create<TabHistoryState>((set, get) => ({
  byTab: {},

  push: (tabId, snapshot) =>
    set(state => {
      const cur = state.byTab[tabId] ?? emptyStacks();
      const past = [...cur.past, snapshot];
      while (past.length > MAX_STACK) past.shift();
      return {
        byTab: {
          ...state.byTab,
          [tabId]: { past, future: [] },
        },
      };
    }),

  pushPast: (tabId, snapshot) =>
    set(state => {
      const cur = state.byTab[tabId] ?? emptyStacks();
      const past = [...cur.past, snapshot];
      while (past.length > MAX_STACK) past.shift();
      return {
        byTab: {
          ...state.byTab,
          [tabId]: { past, future: cur.future },
        },
      };
    }),

  pushFuture: (tabId, snapshot) =>
    set(state => {
      const cur = state.byTab[tabId] ?? emptyStacks();
      const future = [...cur.future, snapshot];
      while (future.length > MAX_STACK) future.shift();
      return {
        byTab: {
          ...state.byTab,
          [tabId]: { past: cur.past, future },
        },
      };
    }),

  popPast: tabId => {
    const cur = get().byTab[tabId];
    if (!cur || cur.past.length === 0) return null;
    const snap = cur.past[cur.past.length - 1];
    set(state => {
      const s = state.byTab[tabId] ?? emptyStacks();
      return {
        byTab: {
          ...state.byTab,
          [tabId]: { past: s.past.slice(0, -1), future: s.future },
        },
      };
    });
    return snap;
  },

  popFuture: tabId => {
    const cur = get().byTab[tabId];
    if (!cur || cur.future.length === 0) return null;
    const snap = cur.future[cur.future.length - 1];
    set(state => {
      const s = state.byTab[tabId] ?? emptyStacks();
      return {
        byTab: {
          ...state.byTab,
          [tabId]: { past: s.past, future: s.future.slice(0, -1) },
        },
      };
    });
    return snap;
  },

  clear: tabId =>
    set(state => {
      const next = { ...state.byTab };
      delete next[tabId];
      return { byTab: next };
    }),

  canUndo: tabId => (get().byTab[tabId]?.past.length ?? 0) > 0,
  canRedo: tabId => (get().byTab[tabId]?.future.length ?? 0) > 0,
}));

/** Take a fresh snapshot of the fields that may change. */
export function snapshotTab(
  tab: { name: string; isDirty: boolean; data?: TabData },
  label?: string
): TabSnapshot {
  const d = tab.data;
  return {
    name: tab.name,
    isDirty: tab.isDirty,
    label,
    data: d
      ? {
          initialColumns: d.initialColumns ? d.initialColumns.map(c => ({ ...c })) : undefined,
          initialData: d.initialData ? d.initialData.map(r => ({ ...r })) : undefined,
          columnStats: d.columnStats ? { ...d.columnStats } : undefined,
          totalColumns: d.totalColumns,
          totalRows: d.totalRows,
        }
      : undefined,
  };
}
