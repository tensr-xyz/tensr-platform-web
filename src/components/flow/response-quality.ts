/** Fieldwork response quality helpers for the Sources panel (TEN-157 / artboard 10a). */

export type QualityDecision = 'keep' | 'review' | 'remove';

export type QualityRow = {
  row_index: number;
  respondent_id: string;
  flags: string[];
  reasons: string[];
  score: number;
  decision: QualityDecision;
};

export type QualityFilter = 'review' | 'remove' | 'keep';

/** Share of checks failed (0–1) → quality score out of 100 (higher is better). */
export function qualityScoreOutOf100(shareFailed: number): number {
  if (!Number.isFinite(shareFailed)) return 100;
  return Math.max(0, Math.min(100, Math.round((1 - shareFailed) * 100)));
}

export function qualityWhy(reasons: string[]): string {
  return reasons.filter(Boolean).join(' · ');
}

export function filterQualityRows(rows: QualityRow[], filter: QualityFilter): QualityRow[] {
  if (filter === 'review') {
    return rows.filter(row => row.decision === 'review');
  }
  if (filter === 'remove') {
    return rows.filter(row => row.decision === 'remove');
  }
  return rows.filter(row => row.decision === 'keep');
}

export function countByDecision(rows: QualityRow[]): Record<QualityDecision, number> {
  return {
    keep: rows.filter(row => row.decision === 'keep').length,
    review: rows.filter(row => row.decision === 'review').length,
    remove: rows.filter(row => row.decision === 'remove').length,
  };
}

export function removalCsv(rows: QualityRow[]): string {
  const lines = ['respondent_id,reasons'];
  for (const row of rows.filter(item => item.decision === 'remove')) {
    const reasons = row.reasons.join('; ').replace(/"/g, '""');
    lines.push(`${row.respondent_id},"${reasons}"`);
  }
  return `${lines.join('\n')}\n`;
}
