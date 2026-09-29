import { pickObviousIdColumn } from './obvious-id-column';

describe('pickObviousIdColumn', () => {
  it('prefers id over a later respondent_id', () => {
    expect(pickObviousIdColumn(['score', 'respondent_id', 'id'])).toBe('id');
  });

  it('matches respondent_id case-insensitively', () => {
    expect(pickObviousIdColumn(['Respondent_ID', 'gender'])).toBe('Respondent_ID');
  });

  it('returns null when nothing looks like a key', () => {
    expect(pickObviousIdColumn(['gender', 'age'])).toBeNull();
  });
});
