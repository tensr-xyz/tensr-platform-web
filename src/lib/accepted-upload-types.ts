/** Client allowlist for dataset upload. Must match tensr-api parse_upload_bytes. */
export const ACCEPTED_UPLOAD_EXTENSIONS = [
  'csv',
  'xlsx',
  'xls',
  'sav',
  'dta',
  'sss',
  'parquet',
  'json',
] as const;

export const ACCEPTED_UPLOAD_DOT_EXTENSIONS = ACCEPTED_UPLOAD_EXTENSIONS.map(ext => `.${ext}`);

export const ACCEPTED_UPLOAD_ACCEPT = ACCEPTED_UPLOAD_DOT_EXTENSIONS.join(',');

export const ACCEPTED_UPLOAD_HELP =
  'CSV, Excel (.xlsx, .xls), JSON records, SPSS (.sav), Stata (.dta), Triple-S (.sss), or Parquet.';

export function isAcceptedUploadExtension(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase();
  return !!ext && (ACCEPTED_UPLOAD_EXTENSIONS as readonly string[]).includes(ext);
}
