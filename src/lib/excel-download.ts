export type ExcelDownload = {
  filename: string;
  mediaType: string;
  excelBase64: string;
};

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function fromRecord(record: Record<string, unknown>): ExcelDownload | null {
  const download = record.download;
  if (download && typeof download === 'object') {
    const file = download as Record<string, unknown>;
    if (typeof file.excel_base64 === 'string' && file.excel_base64) {
      return {
        filename:
          typeof file.filename === 'string' && file.filename ? file.filename : 'banner.xlsx',
        mediaType:
          typeof file.media_type === 'string' && file.media_type ? file.media_type : XLSX_TYPE,
        excelBase64: file.excel_base64,
      };
    }
  }
  if (typeof record.excel_base64 === 'string' && record.excel_base64) {
    return {
      filename:
        typeof record.excel_filename === 'string' && record.excel_filename
          ? record.excel_filename
          : typeof record.filename === 'string' && record.filename
            ? record.filename
            : 'banner.xlsx',
      mediaType: XLSX_TYPE,
      excelBase64: record.excel_base64,
    };
  }
  return null;
}

/** Artifact returned on a tool result or a saved run. One level of nesting, no cycles. */
export function excelDownloadFromResult(result: unknown, depth = 0): ExcelDownload | null {
  if (depth > 3 || !result || typeof result !== 'object') return null;
  const record = result as Record<string, unknown>;
  const direct = fromRecord(record);
  if (direct) return direct;
  if (record.exports && typeof record.exports === 'object') {
    const nested = fromRecord(record.exports as Record<string, unknown>);
    if (nested) return nested;
  }
  if (record.result && typeof record.result === 'object') {
    return excelDownloadFromResult(record.result, depth + 1);
  }
  return null;
}

export function excelDownloadFromToolResults(
  results: Array<Record<string, unknown>> | undefined
): ExcelDownload | null {
  if (!results?.length) return null;
  for (const entry of results) {
    const found = excelDownloadFromResult(entry);
    if (found) return found;
  }
  return null;
}

export type ExportDownload = {
  filename: string;
  key: string;
  expires?: number;
};

/** Signed files on a tool result. The URL is left on the wire and is not kept. */
export function downloadsFromToolResults(
  results: Array<Record<string, unknown>> | undefined
): ExportDownload[] {
  if (!results?.length) return [];
  const found: ExportDownload[] = [];
  for (const entry of results) {
    const downloads = entry.downloads;
    if (!Array.isArray(downloads)) continue;
    for (const item of downloads) {
      if (!item || typeof item !== 'object') continue;
      const file = item as Record<string, unknown>;
      const filename = typeof file.filename === 'string' ? file.filename : '';
      const key = typeof file.key === 'string' ? file.key : '';
      if (!filename || !key) continue;
      found.push({
        filename,
        key,
        expires: typeof file.expires === 'number' ? file.expires : undefined,
      });
    }
  }
  return found;
}

export async function openSignedDownload(file: ExportDownload): Promise<void> {
  if (typeof document === 'undefined') return;
  const { apiClient } = await import('@/lib/api-client');
  const signed = await apiClient.assistant.signExport(file.key);
  const link = document.createElement('a');
  link.href = signed.url;
  link.download = signed.filename || file.filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function downloadExcelArtifact(file: ExcelDownload): void {
  if (typeof document === 'undefined') return;
  const binary = atob(file.excelBase64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  const blob = new Blob([bytes], { type: file.mediaType || XLSX_TYPE });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.filename || 'banner.xlsx';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
