import { buildRakePayload, rakeMarginFromColumn, RAKE_COPY } from './rake-weights';

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

  it('says raking is a new version, not Weight Cases', () => {
    expect(RAKE_COPY.toLowerCase()).toMatch(/new dataset version/);
    expect(RAKE_COPY.toLowerCase()).toMatch(/weight cases/);
    expect(RAKE_COPY.toLowerCase()).toMatch(/does not overwrite/);
  });
});
