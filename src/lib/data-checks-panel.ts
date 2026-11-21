import type { DataChecksReport } from '@/lib/dataset-data-ops';

/** One warn card in the Paper 10h Check data dialog. */
export type DataCheckCard = {
  id: string;
  kind: string;
  title: string;
  detail?: string;
  count: number;
  column?: string;
  columns?: string[];
  showLabel: string;
};

const PASSED_SHORT: Record<string, string> = {
  missing_label: 'labels',
  unlabeled_code: 'codes',
  unused_label: 'unused labels',
  duplicate_label: 'duplicates',
  out_of_range: 'ranges',
  empty_column: 'empty columns',
  straightlining: 'straight-lining',
};

const LOOK_AT_CAP = 12;

function showPhrase(count: number): string {
  const n = Math.max(0, Math.floor(count));
  return `Show the ${n.toLocaleString('en-GB')}`;
}

/** Cards to look at, highest count first, capped so the dialog stays readable. */
export function dataCheckCards(report: DataChecksReport | null | undefined): DataCheckCard[] {
  if (!report) return [];
  const cards: DataCheckCard[] = [];

  for (const item of report.construction || []) {
    const count = Math.max(0, Number(item.count) || 0);
    const label = String(item.label || item.column || '').trim() || 'Question';
    const kindLabel = String(item.kind_label || item.kind || 'Issue').trim();
    cards.push({
      id: `construction:${item.kind}:${item.column}:${cards.length}`,
      kind: String(item.kind || ''),
      title: `${kindLabel}: ${label}${count ? ` · ${count.toLocaleString('en-GB')}` : ''}`,
      detail: String(item.message || '').trim() || undefined,
      count,
      column: item.column,
      columns: item.columns,
      showLabel: showPhrase(count || 1),
    });
  }

  for (const item of report.straightlining || []) {
    const count = Math.max(0, Number(item.straightline_count) || 0);
    const label = String(item.label || '').trim() || 'Grid';
    const kindLabel = String(item.kind_label || 'Same answer down a grid').trim();
    cards.push({
      id: `straightlining:${item.set_id || label}:${cards.length}`,
      kind: 'straightlining',
      title: `${kindLabel}: ${label} · ${count.toLocaleString('en-GB')}`,
      detail: String(item.message || '').trim() || undefined,
      count,
      column: item.columns?.[0],
      columns: item.columns,
      showLabel: showPhrase(count || 1),
    });
  }

  cards.sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));
  return cards.slice(0, LOOK_AT_CAP);
}

export function dataChecksTitle(lookAt: number): string {
  if (lookAt <= 0) return 'Data checks · all clear';
  if (lookAt === 1) return 'Data checks · 1 to look at';
  return `Data checks · ${lookAt.toLocaleString('en-GB')} to look at`;
}

/** Passed kinds with no findings, matching the Paper 10h green strip. */
export function dataChecksPassedLine(report: DataChecksReport | null | undefined): string | null {
  if (!report) return null;
  const hit = new Set<string>();
  for (const item of report.construction || []) {
    if (item.kind) hit.add(String(item.kind));
  }
  if ((report.straightlining || []).length) hit.add('straightlining');

  const known = Object.keys(report.issue_labels || PASSED_SHORT);
  const keys = known.length ? known : Object.keys(PASSED_SHORT);
  const passed = keys.filter(key => !hit.has(key));
  if (!passed.length) return null;

  const shorts = passed
    .map(key => PASSED_SHORT[key] || String(report.issue_labels?.[key] || key).toLowerCase())
    .filter(Boolean);
  const unique = [...new Set(shorts)].slice(0, 4);
  return `✓ ${passed.length.toLocaleString('en-GB')} other checks passed · ${unique.join(', ')}`;
}

export function dataChecksFooterNote(): string {
  return 'Runs automatically after each upload. Fixes save a new version.';
}
