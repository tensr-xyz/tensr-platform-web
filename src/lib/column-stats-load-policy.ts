/**
 * Spreadsheet column-stats fetch policy.
 *
 * `/api/analysis/analyze-file` runs once, when the stats panel opens.
 * A 5xx used to clear the attempt flag, and the load effect then refetched.
 */

export function shouldLoadColumnStats(opts: {
  hasPath: boolean;
  isProjectFile: boolean;
  hasUsableStats: boolean;
  isLoading: boolean;
  attempted: boolean;
  statsPanelOpen: boolean;
}): boolean {
  if (!opts.statsPanelOpen) return false;
  if (!opts.hasPath || opts.isProjectFile || opts.hasUsableStats || opts.isLoading) {
    return false;
  }
  return !opts.attempted;
}

/** Keep the flag set after success or failure so effects cannot immediately refetch. */
export function shouldKeepAttemptAfterFetchSettled(): boolean {
  return true;
}

export function shouldClearAttemptOnShowStats(): boolean {
  return false;
}

export function shouldClearAttemptOnPathChange(): boolean {
  return true;
}
