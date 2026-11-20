import { flowJson } from '@/lib/flow-api';
import { downloadExport } from '@/components/flow/survey-screens';

const OFFICE_DECK_POLL_MS = 1500;
/** ~5 minutes for large report-ordered decks on the 180s worker. */
const OFFICE_DECK_POLL_LIMIT = 200;

export type OfficeDeckJobSnapshot = {
  ok?: boolean;
  job_id?: string;
  status?: string;
  stage?: string;
  message?: string;
  tables_done?: number;
  tables_total?: number;
  export_id?: string;
  filename?: string;
  error?: string;
  result?: Record<string, unknown>;
};

export type ReportExportPage = {
  id: string;
  title: string;
  section: string;
  tableSpecId?: string;
};

export type ReportPageGroupKey = 'summary' | 'insights' | 'appendix' | 'other';

export type ReportPageGroup = {
  key: ReportPageGroupKey;
  label: string;
  pages: ReportExportPage[];
  /** Insights open by default; appendix collapsed. */
  defaultExpanded: boolean;
};

/** Map a stored Report page section onto the export picker groups. */
export function reportPageGroupKey(section: string, title: string): ReportPageGroupKey {
  const hay = `${section} ${title}`.toLowerCase();
  if (/exec|summary|study brief|study intro|context/.test(hay)) return 'summary';
  if (/insight|finding/.test(hay)) return 'insights';
  if (/appendix|question/.test(hay)) return 'appendix';
  return 'other';
}

/**
 * Section divider pages (title equals the section name, no live table) must not
 * appear in the export picker — they were counted as "Q1 · Appendix".
 * Executive summary is a real text slide (title often equals its section), so keep it.
 */
export function isExportableReportPage(page: {
  title: string;
  section: string;
  tableSpecId?: string;
}): boolean {
  if (page.tableSpecId) return true;
  const title = page.title.trim().toLowerCase();
  const section = page.section.trim().toLowerCase();
  if (!title) return false;
  // Text-only exec summary pages are slides, not section dividers.
  if (title === 'executive summary' || /exec(utive)?\s+summary/.test(title)) return true;
  if (section && title === section) return false;
  if (title === 'appendix' || title === 'insights' || title === 'summary') return false;
  return true;
}

/** True when a picker page belongs in the Summary group. */
export function isSummaryExportPage(page: { title: string; section: string }): boolean {
  return reportPageGroupKey(page.section, page.title) === 'summary';
}

/** True when a picker page belongs in the Appendix group. */
export function isAppendixExportPage(page: { title: string; section: string }): boolean {
  return reportPageGroupKey(page.section, page.title) === 'appendix';
}

export function pagesFromReportDocument(
  document: { pages?: unknown } | null | undefined
): ReportExportPage[] {
  const pages = Array.isArray(document?.pages) ? document.pages : [];
  const out: ReportExportPage[] = [];
  pages.forEach((page, index) => {
    if (!page || typeof page !== 'object') return;
    const record = page as Record<string, unknown>;
    const id = String(record.id || `page-${index + 1}`).trim() || `page-${index + 1}`;
    const title = String(record.title || '').trim() || `Page ${index + 1}`;
    const section = String(record.section || '').trim();
    let tableSpecId = '';
    const objects = Array.isArray(record.objects) ? record.objects : [];
    for (const obj of objects) {
      if (!obj || typeof obj !== 'object') continue;
      const row = obj as Record<string, unknown>;
      const specId = String(row.table_spec_id || row.tableSpecId || '').trim();
      if (specId) {
        tableSpecId = specId;
        break;
      }
    }
    const next: ReportExportPage = { id, title, section, ...(tableSpecId ? { tableSpecId } : {}) };
    if (!isExportableReportPage(next)) return;
    out.push(next);
  });
  return out;
}

export function groupReportExportPages(pages: ReportExportPage[]): ReportPageGroup[] {
  const buckets: Record<ReportPageGroupKey, ReportExportPage[]> = {
    summary: [],
    insights: [],
    appendix: [],
    other: [],
  };
  for (const page of pages) {
    buckets[reportPageGroupKey(page.section, page.title)].push(page);
  }
  const groups: ReportPageGroup[] = [];
  if (buckets.summary.length) {
    groups.push({
      key: 'summary',
      label: 'Summary',
      pages: buckets.summary,
      defaultExpanded: false,
    });
  }
  if (buckets.insights.length) {
    groups.push({
      key: 'insights',
      label: 'Insights',
      pages: buckets.insights,
      defaultExpanded: true,
    });
  }
  if (buckets.appendix.length) {
    groups.push({
      key: 'appendix',
      label: 'Appendix, one per question',
      pages: buckets.appendix,
      defaultExpanded: false,
    });
  }
  if (buckets.other.length) {
    groups.push({
      key: 'other',
      label: 'Other pages',
      pages: buckets.other,
      defaultExpanded: true,
    });
  }
  return groups;
}

/** Rough export time copy for the dialog footer (general, not file-specific). */
export function estimateOfficeDeckSeconds(pageCount: number): number {
  const n = Math.max(0, Math.floor(pageCount));
  if (n <= 0) return 15;
  return Math.max(20, Math.min(180, Math.round(12 + n * 0.7)));
}

export async function fetchOfficeDeckJob(
  datasetId: string,
  jobId: string
): Promise<OfficeDeckJobSnapshot | null> {
  try {
    return await flowJson<OfficeDeckJobSnapshot>(
      `/datasets/${datasetId}/export/deck/jobs/${encodeURIComponent(jobId)}`
    );
  } catch {
    return null;
  }
}

export async function waitForOfficeDeckJob(
  datasetId: string,
  jobId: string,
  opts?: {
    intervalMs?: number;
    attempts?: number;
    onProgress?: (message: string) => void;
  }
): Promise<OfficeDeckJobSnapshot | null> {
  const intervalMs = opts?.intervalMs ?? OFFICE_DECK_POLL_MS;
  const attempts = opts?.attempts ?? OFFICE_DECK_POLL_LIMIT;
  let last = '';
  for (let i = 0; i < attempts; i += 1) {
    const job = await fetchOfficeDeckJob(datasetId, jobId);
    const status = String(job?.status || 'pending');
    const line = String(job?.message || 'Building the PowerPoint file');
    if (line && line !== last) {
      opts?.onProgress?.(line);
      last = line;
    }
    if (job && status !== 'pending' && status !== 'running') return job;
    if (i + 1 >= attempts) return job;
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  return null;
}

/**
 * POST /export/deck and, when the gateway returns a pending job, poll until the
 * file is ready (or failed with a reason).
 */
export async function exportOfficeDeckAndDownload(
  datasetId: string,
  stem: string,
  body: Record<string, unknown>,
  opts?: { onProgress?: (message: string) => void }
): Promise<void> {
  const created = await flowJson<{
    export_id?: string;
    filename?: string;
    status?: string;
    job_id?: string;
    message?: string;
    detail?: string;
  }>(`/datasets/${datasetId}/export/deck`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

  let exportId = String(created.export_id || '').trim();
  let filename = created.filename || `${stem}.pptx`;
  const jobId = String(created.job_id || '').trim();

  if (!exportId && (created.status === 'pending' || jobId)) {
    if (!jobId) {
      throw new Error(String(created.message || created.detail || 'The deck did not start.'));
    }
    opts?.onProgress?.(String(created.message || 'Building the PowerPoint file'));
    const job = await waitForOfficeDeckJob(datasetId, jobId, {
      onProgress: opts?.onProgress,
    });
    if (!job) {
      throw new Error('The PowerPoint export timed out. Try again.');
    }
    if (String(job.status || '') === 'failed') {
      throw new Error(String(job.error || job.message || 'Building the PowerPoint file failed.'));
    }
    const fromResult =
      job.result && typeof job.result === 'object'
        ? String((job.result as { export_id?: string }).export_id || '').trim()
        : '';
    exportId = String(job.export_id || fromResult || '').trim();
    filename =
      String(job.filename || (job.result as { filename?: string } | undefined)?.filename || '') ||
      filename;
  }

  if (!exportId) {
    throw new Error(
      String(created.message || created.detail || 'The deck did not build. Try again.')
    );
  }
  await downloadExport(`/exports/${exportId}`, filename);
}
