/** Details labels Excel preview helpers (Paper 9d / TEN-202). Labels only in UI copy. */

export type LabelChange = {
  column: string;
  field: 'question_label' | 'value_label' | string;
  code?: string | null;
  before: string;
  after: string;
};

export type LabelsImportPreview = {
  filename: string;
  content_base64?: string;
  labels_changed: number;
  unmatched: number;
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
