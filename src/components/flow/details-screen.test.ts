import {
  joinBrief,
  peopleNotOnProject,
  splitBrief,
  workspacePerson,
  workspacePersonLabel,
} from './details-screen';

describe('project brief', () => {
  it('keeps objectives and audience as two parts of one brief', () => {
    const text = joinBrief('Track awareness\nMeasure satisfaction', 'UK adults 18+');
    expect(splitBrief(text)).toEqual({
      objectives: 'Track awareness\nMeasure satisfaction',
      audience: 'UK adults 18+',
    });
    expect(splitBrief('Just a note')).toEqual({ objectives: 'Just a note', audience: '' });
  });

  it('labels a workspace member by name and email and skips people already on the project', () => {
    const person = workspacePerson({
      user_id: 'user-1',
      email: 'oliver@example.com',
      display_name: 'Oliver',
    });
    expect(workspacePersonLabel(person)).toBe('Oliver · oliver@example.com');
    expect(peopleNotOnProject([person], [{ user_id: 'user-1' }])).toEqual([]);
    expect(peopleNotOnProject([person], [])).toEqual([person]);
  });
});
