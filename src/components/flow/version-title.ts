/** Shared working-version titles for Sources, Responses, and Tables. */

const FILE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const VERSION_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export type VersionTitleFile = {
  original_filename?: string | null;
  source_filenames?: string[] | null;
  parent_dataset_id?: string | null;
  lineage_label?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function looksLikeFileId(value: string): boolean {
  const text = value.trim();
  const stem = text.replace(/\.[^.]+$/, '');
  return FILE_UUID.test(text) || FILE_UUID.test(stem);
}

function looksLikeStackName(name: string): boolean {
  return / \+ /.test(name);
}

export function versionWhen(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${date.getDate()} ${VERSION_MONTHS[date.getMonth()]} ${hours}:${minutes}:${seconds}`;
}

function plainFileName(file: VersionTitleFile): string {
  const names = [file.original_filename, ...(file.source_filenames || [])];
  for (const name of names) {
    const text = String(name || '').trim();
    if (text && !looksLikeFileId(text)) return text;
  }
  if (file.lineage_label && !looksLikeFileId(file.lineage_label)) return file.lineage_label;
  return 'Untitled file';
}

/** Distinct title with day and time so two stack copies do not look identical. */
export function sourceVersionTitle(file: VersionTitleFile): string {
  if (!file.parent_dataset_id) return plainFileName(file);
  const original = String(file.original_filename || '').trim();
  const label = String(file.lineage_label || '').trim();
  let base = '';
  let fromOperationLabel = false;
  if (original && !looksLikeFileId(original) && looksLikeStackName(original)) {
    base = original;
  } else if (label && !looksLikeFileId(label)) {
    base = label;
    fromOperationLabel = true;
  } else if (original && !looksLikeFileId(original)) {
    base = original;
  } else {
    base = plainFileName(file);
  }
  if (!base) base = 'Untitled file';
  const titled = fromOperationLabel ? base.charAt(0).toUpperCase() + base.slice(1) : base;
  if (/\d{1,2}:\d{2}/.test(titled)) return titled;
  const stamp = versionWhen(file.created_at || file.updated_at);
  return stamp ? `${titled} · ${stamp}` : titled;
}
