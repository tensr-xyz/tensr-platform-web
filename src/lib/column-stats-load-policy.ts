/**
 * Spreadsheet column-stats fetch policy.
 *
 * `/api/analysis/analyze-file` is attempted once per dataset. A 5xx used to
 * clear the attempt flag, and the load effect then refetched in a tight loop.
 */

export function shouldLoadColumnStats(opts: {
  hasPath: boolean;
  isProjectFile: boolean;
  hasUsableStats: boolean;
  isLoading: boolean;
  attempted: boolean;
}): boolean {
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
