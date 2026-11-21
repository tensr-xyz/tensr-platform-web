import {
  filterMentionPeople,
  insertMentionAt,
  mentionQueryAt,
  mentionsForReport,
  notifyMentionReceived,
  personInitials,
  roleLabel,
  unseenMentionIds,
} from './comment-mentions';

describe('comment-mentions', () => {
  it('finds an @query at the caret', () => {
    expect(mentionQueryAt('Worth a look @Mic', 17)).toEqual({ start: 13, query: 'Mic' });
    expect(mentionQueryAt('no mention here', 5)).toBeNull();
    expect(mentionQueryAt('email me a@b.com', 16)).toBeNull();
  });

  it('filters people by the typed name and keeps labels', () => {
    const people = [
      { user_id: '1', name: 'Michael King', role: 'editor' },
      { user_id: '2', name: 'Priya Shah', role: 'asker' },
      { user_id: '3', name: 'Tom Reid', role: 'viewer' },
    ];
    expect(filterMentionPeople(people, 'mic').map(row => row.name)).toEqual(['Michael King']);
    expect(roleLabel('asker')).toBe('Asker');
    expect(personInitials('Michael King')).toBe('MK');
  });

  it('inserts @Name at the active query', () => {
    const next = insertMentionAt('Worth a look @Mic', 17, 'Michael King');
    expect(next).toEqual({
      text: 'Worth a look @Michael King ',
      caret: 'Worth a look @Michael King '.length,
    });
  });

  it('keeps mentions for one report only', () => {
    const notes = [
      { report_id: 'run-a', comment_id: 'c1', author_name: 'Ollie', text: '@Ada hi' },
      { report_id: 'run-b', comment_id: 'c2', author_name: 'Ollie', text: '@Ada there' },
    ];
    expect(mentionsForReport(notes, 'run-a')).toHaveLength(1);
  });

  it('fires a browser notification only when the tab is hidden', () => {
    const notify = jest.fn();
    expect(
      notifyMentionReceived({
        authorName: 'Ollie',
        text: '@Ada check this',
        hidden: false,
        notify,
      })
    ).toBe(false);
    expect(notify).not.toHaveBeenCalled();
    expect(
      notifyMentionReceived({
        authorName: 'Ollie',
        text: '@Ada check this',
        hidden: true,
        notify,
      })
    ).toBe(true);
    expect(notify).toHaveBeenCalledWith('Ollie mentioned you', {
      body: '@Ada check this',
      silent: false,
    });
  });

  it('treats every mention as unseen when sessionStorage is empty', () => {
    const notes = [{ report_id: 'r1', comment_id: 'c1', created_at: 't1' }];
    expect(unseenMentionIds(notes)).toEqual(['r1#c1#t1']);
  });
});
