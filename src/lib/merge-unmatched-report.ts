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
  for (const pair of report.key_map || []) {
    if (pair.left !== pair.right) lines.push(`Key ${pair.left} matched ${pair.right}.`);
  }
  if (report.source_wave_column) {
    lines.push(`Added ${report.source_wave_column} so each row keeps its source file.`);
  }
  for (const dup of report.duplicate_ids || []) {
    lines.push(`Duplicate ${dup.column} across waves: ${dup.count} (${dup.ids.join(', ')}).`);
  }
  for (const note of report.type_coercions || []) {
    lines.push(`${note.column}: ${note.detail}`);
  }
  return lines;
}
