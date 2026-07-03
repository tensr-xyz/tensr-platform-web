/**
 * High-level undo/redo for tabs. Coordinates `useTabsStore` (live state) with
 * `useTabHistoryStore` (per-tab snapshot stacks).
 *
 * Mutating callers should:
 *   1. take a snapshot of the current tab (`snapshotTab`),
 *   2. push it via `commitTabChange` BEFORE making the change,
 *   3. then mutate via `useTabsStore.getState().updateTab(...)` as normal.
 */

import { useTabsStore, type Tab, type TabData } from '@/stores/tabs-store';
import { snapshotTab, useTabHistoryStore, type TabSnapshot } from '@/stores/tab-history-store';

function applySnapshot(tabId: string, snap: TabSnapshot) {
  const updates: Partial<Tab> = {};
  if (snap.name !== undefined) updates.name = snap.name;
  if (snap.isDirty !== undefined) updates.isDirty = snap.isDirty;

  if (snap.data) {
    const tab = useTabsStore.getState().tabs.find(t => t.id === tabId);
    const currentData = tab?.data ?? {};
    const nextData: TabData = { ...currentData };
    if (snap.data.initialColumns !== undefined)
      nextData.initialColumns = snap.data.initialColumns.map(c => ({ ...c }));
    if (snap.data.initialData !== undefined)
      nextData.initialData = snap.data.initialData.map(r => ({ ...r }));
    if (snap.data.columnStats !== undefined) nextData.columnStats = { ...snap.data.columnStats };
    if (snap.data.totalColumns !== undefined) nextData.totalColumns = snap.data.totalColumns;
    if (snap.data.totalRows !== undefined) nextData.totalRows = snap.data.totalRows;
    updates.data = nextData;
  }

  useTabsStore.getState().updateTab(tabId, updates);
}

/** Capture a snapshot of the tab *as it is now*, then push it onto the undo stack. */
export function recordTabSnapshot(tabId: string, label?: string) {
  const tab = useTabsStore.getState().tabs.find(t => t.id === tabId);
  if (!tab) return;
  const snap = snapshotTab(tab, label);
  useTabHistoryStore.getState().push(tabId, snap);
}

/** Roll the tab back one step. Returns the label of the change that was undone, if any. */
export function undoTab(tabId: string): string | null {
  const history = useTabHistoryStore.getState();
  const past = history.byTab[tabId]?.past ?? [];
  if (past.length === 0) return null;

  const tab = useTabsStore.getState().tabs.find(t => t.id === tabId);
  if (!tab) return null;

  // Push the current state onto the redo stack, then apply the previous snapshot.
  const currentSnap = snapshotTab(tab);
  history.pushFuture(tabId, currentSnap);
  const previous = history.popPast(tabId);
  if (!previous) return null;
  applySnapshot(tabId, previous);
  return previous.label ?? 'undo';
}

/** Re-apply the most recently undone change. */
export function redoTab(tabId: string): string | null {
  const history = useTabHistoryStore.getState();
  const future = history.byTab[tabId]?.future ?? [];
  if (future.length === 0) return null;

  const tab = useTabsStore.getState().tabs.find(t => t.id === tabId);
  if (!tab) return null;

  const currentSnap = snapshotTab(tab);
  history.pushPast(tabId, currentSnap);
  const next = history.popFuture(tabId);
  if (!next) return null;
  applySnapshot(tabId, next);
  return next.label ?? 'redo';
}

export function canUndoTab(tabId: string): boolean {
  return useTabHistoryStore.getState().canUndo(tabId);
}

export function canRedoTab(tabId: string): boolean {
  return useTabHistoryStore.getState().canRedo(tabId);
}
