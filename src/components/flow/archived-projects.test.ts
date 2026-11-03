import { archivedDate, archivedFilesLine, creatorName, filterArchived } from './archived-projects';

describe('archived projects', () => {
  const rows = [
    { id: 'a', name: 'Brand tracker W3', folder: 'Octavia Energy', created_by: 'u1' },
    { id: 'b', name: 'Test upload', created_by: 'u2' },
  ];

  it('searches name and folder', () => {
    expect(filterArchived(rows, 'octavia').map(row => row.id)).toEqual(['a']);
    expect(filterArchived(rows, 'test').map(row => row.id)).toEqual(['b']);
    expect(filterArchived(rows, '  ')).toHaveLength(2);
  });

  it('labels files, dates and the creator', () => {
    expect(archivedFilesLine(0)).toBe('No data');
    expect(archivedFilesLine(1)).toBe('1 file');
    expect(archivedFilesLine(6)).toBe('6 files');
    const now = new Date('2026-11-03T12:00:00Z');
    expect(archivedDate('2026-09-02T10:00:00Z', now)).toBe('2 Sep');
    expect(archivedDate('2025-09-02T10:00:00Z', now)).toBe('2 Sep 2025');
    expect(archivedDate(undefined, now)).toBe('—');
    expect(creatorName(rows[0], [{ user_id: 'u1', name: 'Ollie Darby' }])).toBe('Ollie Darby');
    expect(creatorName(rows[0], [{ user_id: 'u1', email: 'o@x.com' }])).toBe('o@x.com');
    expect(creatorName(rows[0], [{ user_id: 'u9', name: 'Someone' }])).toBe('—');
  });
});
