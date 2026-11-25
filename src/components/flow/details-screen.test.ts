import {
  joinBrief,
  peopleNotOnProject,
  previewColumns,
  splitBrief,
  workspacePerson,
  workspacePersonLabel,
} from './details-screen';

describe('previewColumns', () => {
  it('keeps array headers and rows', () => {
    expect(previewColumns({ headers: ['age', 'region'], rows: [[1, 'UK']] })).toEqual({
      headers: ['age', 'region'],
      rows: [[1, 'UK']],
    });
  });

  it('tolerates null, object-shaped, or missing headers without crashing', () => {
    expect(previewColumns(null)).toEqual({ headers: [], rows: [] });
    expect(previewColumns(undefined)).toEqual({ headers: [], rows: [] });
    expect(
      previewColumns({ headers: null as unknown as string[], rows: null as unknown as [] })
    ).toEqual({
      headers: [],
      rows: [],
    });
    expect(
      previewColumns({
        headers: { 0: 'age', 1: 'region' } as unknown as string[],
        rows: { 0: [1, 'UK'] } as unknown as unknown[][],
      })
    ).toEqual({
      headers: ['age', 'region'],
      rows: [],
    });
  });
});

describe('project brief', () => {
  it('keeps objectives and audience as two parts of one brief', () => {
    const text = joinBrief('Track awareness\nMeasure satisfaction', 'UK adults 18+');
    expect(splitBrief(text)).toEqual({
      objectives: 'Track awareness\nMeasure satisfaction',
      audience: 'UK adults 18+',
      notes: '',
    });
    expect(splitBrief('Just a note')).toEqual({
      objectives: 'Just a note',
      audience: '',
      notes: '',
    });
    const full = joinBrief('Grow awareness', 'UK drivers', 'Use NET agree');
    expect(splitBrief(full)).toEqual({
      objectives: 'Grow awareness',
      audience: 'UK drivers',
      notes: 'Use NET agree',
    });
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
