import type { MergeReport } from '@/lib/dataset-data-ops';

export function mergeUnmatchedReportLines(report: MergeReport, keyed: boolean): string[] {
  const lines = [`${report.row_count ?? 0} rows in the result.`];
  if (keyed) {
    const leftKeys = report.unmatched_left_keys || [];
    const rightKeys = report.unmatched_right_keys || [];
    lines.push(
      `Unmatched on this file: ${report.unmatched_left_count ?? 0}${
        leftKeys.length ? ` (${leftKeys.join(', ')})` : ''
      }`
    );
    lines.push(
      `Unmatched on the other file: ${report.unmatched_right_count ?? 0}${
        rightKeys.length ? ` (${rightKeys.join(', ')})` : ''
      }`
    );
    const leftDups = report.duplicate_key_count_left ?? 0;
    const rightDups = report.duplicate_key_count_right ?? 0;
    if (leftDups || rightDups) {
      lines.push(`Duplicate keys on this file: ${leftDups}`);
      lines.push(`Duplicate keys on the other file: ${rightDups}`);
      lines.push('Duplicate keys multiply rows.');
    }
  }
  if ((report.columns_only_left || []).length > 0) {
    lines.push(`Only on this file: ${report.columns_only_left!.join(', ')}`);
  }
  if ((report.columns_only_right || []).length > 0) {
    lines.push(`Only on the other file: ${report.columns_only_right!.join(', ')}`);
  }
  return lines;
}
