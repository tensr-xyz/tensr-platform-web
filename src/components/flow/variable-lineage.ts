/** Helpers for Paper 10d Built from / Used by and Removed respondents. */

export type LineageItem = {
  kind?: string;
  id?: string;
  name?: string;
  title: string;
  detail?: string;
  role?: string;
  stale?: boolean;
};

export type RemovedCase = {
  case_id: string;
  respondent_label: string;
  removed_at?: string;
};

export type ColumnDependencies = {
  dataset_id: string;
  column: string;
  label: string;
  built_from: LineageItem[];
  used_by: LineageItem[];
  used_by_count: number;
};

export function usedInPlacesLabel(count: number): string {
  const n = Math.max(0, Math.floor(count));
  if (n === 1) return 'Used in 1 place';
  return `Used in ${n} places`;
}

/** One-line summary for the Removed respondents row (labels, never cell dumps). */
export function removedRespondentsSummary(cases: RemovedCase[]): string {
  const rows = cases.filter(item => item && item.case_id);
  if (!rows.length) return '';
  if (rows.length === 1) {
    const label = String(rows[0].respondent_label || '').trim() || '1 respondent';
    return `${label} removed`;
  }
  return `${rows.length} removed`;
}

export function responsesFocusKey(projectId: string): string {
  return `tensr-responses-focus:${projectId}`;
}

export type ResponsesFocus = {
  column: string;
  showLineage?: boolean;
};

export function rememberResponsesFocus(projectId: string, focus: ResponsesFocus): void {
  if (!projectId || !focus.column) return;
  try {
    window.sessionStorage.setItem(responsesFocusKey(projectId), JSON.stringify(focus));
  } catch {
    // Focus is optional when storage is unavailable.
  }
}

export function readResponsesFocus(projectId: string): ResponsesFocus | null {
  if (!projectId) return null;
  try {
    const raw = window.sessionStorage.getItem(responsesFocusKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ResponsesFocus;
    const column = String(parsed?.column || '').trim();
    if (!column) return null;
    return { column, showLineage: Boolean(parsed.showLineage) };
  } catch {
    return null;
  }
}

export function clearResponsesFocus(projectId: string): void {
  if (!projectId) return;
  try {
    window.sessionStorage.removeItem(responsesFocusKey(projectId));
  } catch {
    // Optional.
  }
}

/** Read and clear in one step when the column was applied. */
export function takeResponsesFocus(projectId: string): ResponsesFocus | null {
  const focus = readResponsesFocus(projectId);
  if (focus) clearResponsesFocus(projectId);
  return focus;
}
