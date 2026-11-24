import {
  countByDecision,
  filterQualityRows,
  qualityScoreOutOf100,
  qualityWhy,
  removalCsv,
  type QualityRow,
} from './response-quality';

const rows: QualityRow[] = [
  {
    row_index: 0,
    respondent_id: 'R-1',
    flags: ['speeder'],
    reasons: ['Finished far faster than the median'],
    score: 0.82,
    decision: 'remove',
  },
  {
    row_index: 1,
    respondent_id: 'R-2',
    flags: ['bot'],
    reasons: ['Likely bot or copy-pasted answers'],
    score: 0.4,
    decision: 'review',
  },
  {
    row_index: 2,
    respondent_id: 'R-3',
    flags: [],
    reasons: [],
    score: 0,
    decision: 'keep',
  },
];

describe('response quality helpers', () => {
  it('maps share-failed to a score out of 100', () => {
    expect(qualityScoreOutOf100(0.82)).toBe(18);
    expect(qualityScoreOutOf100(0)).toBe(100);
    expect(qualityScoreOutOf100(1)).toBe(0);
  });

  it('joins reasons for the Why column', () => {
    expect(qualityWhy(['Finished far faster than the median', 'Same answer down a grid'])).toBe(
      'Finished far faster than the median · Same answer down a grid'
    );
  });

  it('filters and counts by decision', () => {
    expect(filterQualityRows(rows, 'review').map(row => row.respondent_id)).toEqual(['R-2']);
    expect(countByDecision(rows)).toEqual({ keep: 1, review: 1, remove: 1 });
  });

  it('builds a panel removal CSV from Remove decisions', () => {
    const csv = removalCsv(rows);
    expect(csv).toContain('respondent_id,reasons');
    expect(csv).toContain('R-1');
    expect(csv).not.toContain('R-2');
  });
});
