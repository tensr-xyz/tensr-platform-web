import JSZip from 'jszip';

import { downloadExport } from '@/components/flow/survey-screens';
import { ApiRequestError, formatApiErrorMessage } from '@/lib/api-error';
import { flowFetch } from '@/lib/flow-api';

const FILE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function looksLikeFileId(value: string): boolean {
  const text = value.trim();
  const stem = text.replace(/\.[^.]+$/, '');
  return FILE_UUID.test(text) || FILE_UUID.test(stem);
}

/** Stem for download filenames from an upload or version name. */
export function exportStem(name?: string): string {
  const base = (name || 'dataset').replace(/\.[a-z0-9]+$/i, '');
  return (
    base
      .replace(/[^\w.-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'dataset'
  );
}

/** Prefer the working-version label the user sees over a parent file name. */
export function exportStemFromVersion(file: {
  original_filename?: string | null;
  source_filenames?: string[] | null;
  parent_dataset_id?: string | null;
  lineage_label?: string | null;
}): string {
  const label = String(file.lineage_label || '').trim();
  if (file.parent_dataset_id && label && !looksLikeFileId(label)) {
    return exportStem(label);
  }
  const names = [file.original_filename, ...(file.source_filenames || [])];
  for (const name of names) {
    const text = String(name || '').trim();
    if (text && !looksLikeFileId(text)) return exportStem(text);
  }
  if (label && !looksLikeFileId(label)) return exportStem(label);
  return exportStem(undefined);
}

async function fetchExportBlob(path: string): Promise<Blob> {
  const response = await flowFetch(path);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(formatApiErrorMessage(new ApiRequestError(response.status, body)));
  }
  return response.blob();
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** One data file from GET /datasets/{id}/export. */
export async function exportDatasetFormat(
  datasetId: string,
  stem: string,
  format: 'csv' | 'sav' | 'dta' | 'xlsx' | 'sps' | 'json',
  opts?: { headers?: 'labels' | 'names' }
) {
  if (!datasetId) throw new Error('Open a file first.');
  const headers =
    format === 'csv' && opts?.headers === 'names'
      ? '&headers=names'
      : format === 'csv'
        ? '&headers=labels'
        : '';
  await downloadExport(
    `/datasets/${datasetId}/export?format=${format}${headers}`,
    `${stem}.${format}`
  );
}

/**
 * SPSS data plus the companion weight syntax as one zip.
 * One download avoids the browser blocking the second file after an async fetch.
 */
export async function exportDatasetSavAndSps(datasetId: string, stem: string) {
  if (!datasetId) throw new Error('Open a file first.');
  const [sav, sps] = await Promise.all([
    fetchExportBlob(`/datasets/${datasetId}/export?format=sav`),
    fetchExportBlob(`/datasets/${datasetId}/export?format=sps`),
  ]);
  const zip = new JSZip();
  zip.file(`${stem}.sav`, sav);
  zip.file(`${stem}.sps`, sps);
  const packed = await zip.generateAsync({ type: 'blob' });
  triggerBlobDownload(packed, `${stem}-spss.zip`);
}
