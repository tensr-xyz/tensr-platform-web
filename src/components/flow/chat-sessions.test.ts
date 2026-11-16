import { recentChatSessions, sortSessionsByRecency } from './chat-sessions';

describe('chat session rails', () => {
  it('orders Chat and Responses from the same recency list', () => {
    const sessions = [
      { session_id: 'old-uuid-zzzz', title: 'Sunday chat', updated_at: '2026-11-09T12:00:00Z' },
      { session_id: 'new-uuid-aaaa', title: 'Today chat', updated_at: '2026-11-16T15:00:00Z' },
      { session_id: 'mid-uuid-mmmm', title: 'Friday chat', updated_at: '2026-11-14T09:00:00Z' },
      { session_id: 'no-stamp', title: 'Legacy' },
    ];

    expect(sortSessionsByRecency(sessions).map(row => row.session_id)).toEqual([
      'new-uuid-aaaa',
      'mid-uuid-mmmm',
      'old-uuid-zzzz',
      'no-stamp',
    ]);
  });

  it('caps the Responses rail to the newest chats, not UUID order', () => {
    const sessions = Array.from({ length: 8 }, (_, index) => ({
      session_id: `sess-${index}`,
      // Older UUIDs first in the raw list, but newer updated_at at higher indexes.
      updated_at: `2026-11-${String(index + 1).padStart(2, '0')}T12:00:00Z`,
    }));

    expect(recentChatSessions(sessions, 6).map(row => row.session_id)).toEqual([
      'sess-7',
      'sess-6',
      'sess-5',
      'sess-4',
      'sess-3',
      'sess-2',
    ]);
  });
});
