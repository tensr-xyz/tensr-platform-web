import { downloadExport } from '@/components/flow/survey-screens';

/** Stem for download filenames from an upload or version name. */
export function exportStem(name?: string): string {
  const base = (name || 'dataset').replace(/\.[a-z0-9]+$/i, '');
  return base.replace(/[^\w.-]+/g, '-').slice(0, 60) || 'dataset';
}

/** One data file from GET /datasets/{id}/export. */
export async function exportDatasetFormat(
  datasetId: string,
  stem: string,
  format: 'csv' | 'sav' | 'dta' | 'xlsx' | 'sps' | 'json'
) {
  if (!datasetId) throw new Error('Open a file first.');
  await downloadExport(`/datasets/${datasetId}/export?format=${format}`, `${stem}.${format}`);
}

/** SPSS data plus the companion weight syntax, matching Export report · Data for SPSS. */
export async function exportDatasetSavAndSps(datasetId: string, stem: string) {
  if (!datasetId) throw new Error('Open a file first.');
  await exportDatasetFormat(datasetId, stem, 'sav');
  await exportDatasetFormat(datasetId, stem, 'sps');
}
