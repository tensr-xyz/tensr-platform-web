/** Details labels Excel preview helpers (Paper 9d / TEN-202). Labels only in UI copy. */

export type LabelChange = {
  column: string;
  field: 'question_label' | 'value_label' | string;
  code?: string | null;
  before: string;
  after: string;
};

export type UnmatchedLabelRow = {
  name: string;
  code?: string | null;
  reason?: string;
};

export type LabelsImportPreview = {
  filename: string;
  content_base64?: string;
  labels_changed: number;
  unmatched: number;
  unmatched_rows: UnmatchedLabelRow[];
  code_changed: number;
  changes: LabelChange[];
};

export function labelsImportApplyLabel(count: number): string {
  const n = Math.max(0, Math.floor(count));
  return `Apply ${n} change${n === 1 ? '' : 's'}`;
}

export function labelChangeLine(change: LabelChange): string {
  const before = String(change.before || '').trim() || '(blank)';
  const after = String(change.after || '').trim() || '(blank)';
  return `“${before}” → “${after}”`;
}

export function unmatchedLabelLine(row: UnmatchedLabelRow): string {
  const name = String(row.name || '').trim() || '(blank)';
  const code = String(row.code || '').trim();
  const reason = String(row.reason || '').trim() || 'not matched';
  if (code) return `${name} · ${code} — ${reason}`;
  return `${name} — ${reason}`;
}

/** One-line status after preview so Upload is never silent. */
export function labelsImportPreviewNote(preview: {
  labels_changed: number;
  unmatched: number;
  code_changed: number;
}): string {
  const changed = Math.max(0, Math.floor(preview.labels_changed));
  const unmatched = Math.max(0, Math.floor(preview.unmatched));
  const codes = Math.max(0, Math.floor(preview.code_changed));
  if (changed > 0) {
    const bits = [`${changed} label${changed === 1 ? '' : 's'} ready to apply`];
    if (unmatched) bits.push(`${unmatched} row${unmatched === 1 ? '' : 's'} not matched`);
    if (codes) bits.push(`${codes} code change${codes === 1 ? '' : 's'} skipped`);
    return bits.join(' · ') + '.';
  }
  if (unmatched || codes) {
    const bits: string[] = ['No label changes to apply'];
    if (unmatched) bits.push(`${unmatched} row${unmatched === 1 ? '' : 's'} not matched`);
    if (codes) bits.push(`${codes} code change${codes === 1 ? '' : 's'} not allowed`);
    return bits.join(' · ') + '.';
  }
  return 'No label changes found in that file.';
}

export function labelsImportAppliedNote(count: number): string {
  const n = Math.max(0, Math.floor(count));
  return `${n} label${n === 1 ? '' : 's'} updated · saved as a new version.`;
}
