import { archiveChatTurn } from '@/components/flow/chat-thread';
import { codingVersionStatus, type CodingFile } from '@/components/flow/coding-versions';
import { displayedCount } from '@/components/flow/survey-screens';
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
});
