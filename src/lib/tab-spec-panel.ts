/** Helpers for Paper 10h · Tables → Build from a spec. */

export type TabSpecStatus = 'matched' | 'needs_question' | string;

export type TabSpecRefusal = {
  code?: string;
  reason?: string;
  hand_work?: string;
  raw?: string;
};

export type TabSpecRow = {
  index: number;
  title: string;
  banner_label: string;
  status: TabSpecStatus;
  status_label?: string;
  stub_text?: string;
  stub_column?: string | null;
  banner_columns?: string[];
  refusal?: TabSpecRefusal | null;
  warnings?: TabSpecRefusal[];
  spec_body?: Record<string, unknown> | null;
};

export type TabSpecReport = {
  ok?: boolean;
  filename?: string;
  n_tables?: number;
  n_banners?: number;
  n_matched?: number;
  n_needs_you?: number;
  tables?: TabSpecRow[];
  status_labels?: Record<string, string>;
  summary_line?: string;
  file_line?: string;
};

export type TabSpecBuildResult = {
  ok?: boolean;
  n_built?: number;
  n_skipped?: number;
  built?: Array<{ index?: number; title?: string; spec_id?: string }>;
  skipped?: Array<{ index?: number; title?: string; reason?: string }>;
};

export function tabSpecFileLine(
  report: TabSpecReport | null | undefined,
  fallbackName?: string
): string {
  if (report?.file_line) return report.file_line;
  const tables = report?.n_tables ?? 0;
  const banners = report?.n_banners ?? 0;
  const tableBit = tables === 1 ? '1 table' : `${tables} tables`;
  if (!banners) return tableBit;
  const bannerBit = banners === 1 ? '1 banner' : `${banners} banners`;
  return `${tableBit} · ${bannerBit}`;
}

export function tabSpecSummaryLine(report: TabSpecReport | null | undefined): string {
  if (report?.summary_line) return report.summary_line;
  const matched = report?.n_matched ?? 0;
  const needs = report?.n_needs_you ?? 0;
  return `${matched} matched · ${needs} need you · stat tests, bases and nets taken from the spec`;
}

export function tabSpecStatusLabel(row: TabSpecRow): string {
  if (row.status_label) return row.status_label;
  if (row.status === 'matched') return 'Matched';
  if (row.status === 'needs_question') return 'Pick question';
  return String(row.status || 'Unknown');
}

export function tabSpecIsMatched(row: TabSpecRow): boolean {
  return row.status === 'matched';
}

export function tabSpecBuildLabel(matched: number): string {
  if (matched <= 0) return 'Build tables';
  if (matched === 1) return 'Build 1 table';
  return `Build ${matched.toLocaleString('en-GB')} tables`;
}

export function tabSpecReviewLabel(needs: number): string {
  if (needs <= 0) return 'Review';
  return `Review ${needs.toLocaleString('en-GB')}`;
}

export function tabSpecPreviewRows(
  report: TabSpecReport | null | undefined,
  options?: { reviewOnly?: boolean; limit?: number }
): TabSpecRow[] {
  const reviewOnly = Boolean(options?.reviewOnly);
  const limit = options?.limit ?? 8;
  const rows = report?.tables || [];
  const filtered = reviewOnly ? rows.filter(row => !tabSpecIsMatched(row)) : rows;
  return filtered.slice(0, Math.max(1, limit));
}
