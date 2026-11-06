import { archiveChatTurn } from '@/components/flow/chat-thread';
import { codingVersionStatus, type CodingFile } from '@/components/flow/coding-versions';
import {
  displayedCount,
  shownDecimals,
  shownStatistics,
  tableFootStatus,
} from '@/components/flow/survey-screens';
import { findingFromOverview } from '@/lib/flow-report';

describe('round 13', () => {
  it('keeps every exchange, not only the latest', () => {
    let past = archiveChatTurn([], null);
    past = archiveChatTurn(past, { user: 'How many rows?', note: '', answer: '8 rows.' });
    past = archiveChatTurn(past, { user: 'And the base?', note: '', answer: 'Base 8.' });
    past = archiveChatTurn(past, { user: 'Which region is largest?', note: '', answer: 'North.' });
    expect(past.map(turn => turn.user)).toEqual([
      'How many rows?',
      'And the base?',
      'Which region is largest?',
    ]);
    expect(past.map(turn => turn.answer)).toEqual(['8 rows.', 'Base 8.', 'North.']);
  });

  it('shows the weighted count, rounded the same way as the export', () => {
    const cell = { count: 39.4, weighted_n: 39.4, unweighted_n: 36 };
    expect(displayedCount(cell, true)).toBe('39');
    expect(displayedCount(cell, false)).toBe('36');
    expect(displayedCount({ count: 76.2, unweighted_n: 70 }, true)).toBe('76');
  });

  it('does not call an edited table saved', () => {
    expect(tableFootStatus(true, false)).toBe('Saved');
    expect(tableFootStatus(true, true)).toBe('');
    expect(tableFootStatus(false, false)).toBe('');
  });

  it('notices a newer coding file whose origin was stored as its own id', () => {
    const files: CodingFile[] = [
      {
        id: 'coded',
        name: 'likert - coded',
        createdAt: '2026-11-03T10:00:00.000Z',
        lineageLabel: 'coded comments',
        producingOperation: 'open_end_coding',
        parentId: 'upload',
        originId: 'upload',
      },
      {
        id: 'newer',
        name: 'likert - coded 2',
        createdAt: '2026-11-04T10:00:00.000Z',
        lineageLabel: 'coded comments',
        producingOperation: 'open_end_coding',
        parentId: 'coded',
        originId: 'newer',
      },
    ];
    const status = codingVersionStatus(files, 'coded');
    expect(status.newerAvailable).toBe(true);
    expect(status.newerId).toBe('newer');
  });

  it('writes a finding from the overview without a table grid', () => {
    const finding = findingFromOverview({ id: 'spec', title: 'Region by gender', number: 2 });
    expect(finding.citation).toBe('T2');
    expect(finding.eyebrow).toBe('T2 · Region by gender');
    expect(finding.bars).toEqual([]);
  });

  it('keeps the cell measure when the mean row is on, and gives means their own decimals', () => {
    const measures = ['count', 'column_proportion', 'row_proportion', 'total_proportion'];
    for (const measure of measures) {
      expect(shownStatistics(measure, true)).toEqual([measure, 'column_mean']);
      expect(shownStatistics(measure, false)).toEqual([measure]);
    }
    expect(shownDecimals('column_proportion', 0, true)).toEqual({
      column_proportion: 0,
      column_mean: 1,
    });
    expect(shownDecimals('count', 3, true)).toEqual({ count: 0, column_mean: 3 });
    expect(shownDecimals('row_proportion', 2, false)).toEqual({ row_proportion: 2 });
    expect(shownDecimals('total_proportion', 1, true).column_mean).toBe(1);
  });
});
