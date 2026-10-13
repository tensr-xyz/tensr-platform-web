import posthog from 'posthog-js';

import { formatApiErrorMessage } from '@/lib/api-error';
import { inspectUploadFile } from '@/lib/spreadsheet-probe';

/** Record a caught upload failure and return the sentence to show. */
export async function reportUploadFailure(file: File, error: unknown): Promise<string> {
  const facts = await inspectUploadFile(file);
  const parserError = error instanceof Error ? error.message : String(error);
  console.error('Dataset upload failed', error);
  posthog.captureException(error instanceof Error ? error : new Error(parserError), {
    file_type: facts.fileType,
    sheet_count: facts.sheetCount,
    row_count: facts.rowCount,
    col_count: facts.colCount,
    parser_error: facts.parserError ? `${parserError} (${facts.parserError})` : parserError,
  });
  return error instanceof Error ? formatApiErrorMessage(error) : 'Upload failed';
}
