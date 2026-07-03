/**
 * Window events that connect the agent panel / chat to the live spreadsheet.
 * Column header menus call into the spreadsheet directly; chat uses these
 * dispatches so sort / filter / hide stay in sync with the grid.
 */

import type { FilterOperator } from '@/lib/chat-actions';

export const SPREADSHEET_EVENTS = {
  SORT: 'tensr:sort-column',
  CLEAR_SORT: 'tensr:clear-sort',
  FILTER_FOCUS: 'tensr:filter-column',
  APPLY_FILTERS: 'tensr:apply-column-filters',
  CLEAR_FILTERS: 'tensr:clear-filters',
  HIDE_COLUMN: 'tensr:hide-column',
  SHOW_HIDDEN_COLUMNS: 'tensr:show-hidden-columns',
} as const;

export type TabColumnFilterPayload = {
  id: string;
  value: { operator: string; value: unknown };
};

export function dispatchSortColumn(columnId: string, direction: 'asc' | 'desc') {
  window.dispatchEvent(
    new CustomEvent(SPREADSHEET_EVENTS.SORT, { detail: { columnId, direction } })
  );
}

export function dispatchClearSort() {
  window.dispatchEvent(new CustomEvent(SPREADSHEET_EVENTS.CLEAR_SORT));
}

export function dispatchApplyColumnFilters(
  filters: TabColumnFilterPayload[],
  options?: { showFilterBar?: boolean }
) {
  window.dispatchEvent(
    new CustomEvent(SPREADSHEET_EVENTS.APPLY_FILTERS, {
      detail: { filters, showFilterBar: options?.showFilterBar },
    })
  );
}

export function dispatchClearColumnFilters() {
  window.dispatchEvent(new CustomEvent(SPREADSHEET_EVENTS.CLEAR_FILTERS));
}

export function dispatchFilterColumnFocus(
  columnId: string,
  options?: { operator?: FilterOperator; value?: unknown; showFilterBar?: boolean }
) {
  window.dispatchEvent(
    new CustomEvent(SPREADSHEET_EVENTS.FILTER_FOCUS, {
      detail: {
        columnId,
        operator: options?.operator,
        value: options?.value,
        showFilters: options?.showFilterBar ?? true,
      },
    })
  );
}

export function dispatchHideColumn(columnId: string) {
  window.dispatchEvent(new CustomEvent(SPREADSHEET_EVENTS.HIDE_COLUMN, { detail: { columnId } }));
}

export function dispatchShowHiddenColumns() {
  window.dispatchEvent(new CustomEvent(SPREADSHEET_EVENTS.SHOW_HIDDEN_COLUMNS));
}
