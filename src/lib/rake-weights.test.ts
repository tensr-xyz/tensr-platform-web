import {
  buildRakePayload,
  marginsFromTargetsCsv,
  rakeMarginFromColumn,
  RAKE_COPY,
  RAKE_MISSING_CATEGORY_WARNING,
} from './rake-weights';

const ROWS = [
  { gender: 'Male', region: 'North' },
  { gender: 'Female', region: 'South' },
  { gender: 'Male', region: 'South' },
];

describe('rake form payload', () => {
  it('builds categorical targets from filled margins', () => {
    const payload = buildRakePayload([{ column: 'gender', targets: { Male: '4', Female: '4' } }]);
    expect(payload.categorical_targets).toEqual({ gender: { Male: 4, Female: 4 } });
  });

  it('drops blank columns and non-numeric targets', () => {
    const payload = buildRakePayload([
      { column: '', targets: { Male: '4' } },
      { column: 'gender', targets: { Male: '', Female: 'x', Other: '1.5' } },
    ]);
    expect(payload.categorical_targets).toEqual({ gender: { Other: 1.5 } });
  });

  it('seeds one margin per unique category in first-seen order', () => {
    const margin = rakeMarginFromColumn('gender', ROWS);
    expect(margin).toEqual({
      column: 'gender',
      targets: { Male: '', Female: '' },
    });
  });

  it('defaults to excluding missing categories and names the targets file', () => {
    const payload = buildRakePayload(
      [{ column: 'gender', targets: { Female: '104', Male: '96' } }],
      {
        targetsFilename: 'targets.csv',
      }
    );
    expect(payload.missing_handling).toBe('exclude');
    expect(payload.targets_filename).toBe('targets.csv');
  });

  it('reads a variable, category, population targets file', () => {
    const margins = marginsFromTargetsCsv(
      'variable,level,population\ngender,Female,104\ngender,Male,96\n'
    );
    expect(margins).toEqual([{ column: 'gender', targets: { Female: '104', Male: '96' } }]);
  });

  it('warns that missing categories are excluded', () => {
    expect(RAKE_MISSING_CATEGORY_WARNING.toLowerCase()).toMatch(/weight 0/);
    expect(RAKE_MISSING_CATEGORY_WARNING.toLowerCase()).toMatch(/excluded/);
  });

  it('says raking is a new version, not Weight Cases', () => {
    expect(RAKE_COPY.toLowerCase()).toMatch(/new dataset version/);
    expect(RAKE_COPY.toLowerCase()).toMatch(/weight cases/);
    expect(RAKE_COPY.toLowerCase()).toMatch(/does not overwrite/);
  });
});
