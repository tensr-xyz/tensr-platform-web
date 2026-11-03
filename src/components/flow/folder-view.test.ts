import { filesLine, folderProjects } from './folder-view';

const projects = [
  { id: 'a', name: 'Old', folder: 'Octavia', created_by: 'u1', updated_at: '2026-10-01T00:00:00Z' },
  { id: 'b', name: 'New', folder: 'Octavia', created_by: 'u2', updated_at: '2026-11-01T00:00:00Z' },
  { id: 'c', name: 'Gone', folder: 'Octavia', status: 'archived', created_by: 'u1' },
  { id: 'd', name: 'Elsewhere', folder: 'Halden', created_by: 'u1' },
  { id: 'e', name: 'Loose', created_by: 'u1' },
];

describe('folder view', () => {
  it('keeps the folder’s projects for each filter, newest first', () => {
    expect(folderProjects(projects, 'Octavia', 'active', ['u1']).map(p => p.id)).toEqual([
      'b',
      'a',
    ]);
    expect(folderProjects(projects, 'Octavia', 'mine', ['u1']).map(p => p.id)).toEqual(['a']);
    expect(folderProjects(projects, 'Octavia', 'archived', ['u1']).map(p => p.id)).toEqual(['c']);
    expect(folderProjects(projects, 'Octavia', 'mine', [])).toEqual([]);
  });

  it('describes the files in a project', () => {
    expect(filesLine([])).toBe('No data yet');
    expect(
      filesLine([
        { dataset_id: 'v', parent_dataset_id: 'u', original_filename: 'stacked.sav' },
        { dataset_id: 'u', original_filename: 'wave.sav' },
      ])
    ).toBe('2 files · wave.sav');
    expect(filesLine([{ dataset_id: 'u' }])).toBe('1 file');
  });
});
