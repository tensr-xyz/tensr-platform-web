import { removedRespondentsSummary, usedInPlacesLabel } from './variable-lineage';

describe('usedInPlacesLabel', () => {
  it('singular and plural', () => {
    expect(usedInPlacesLabel(0)).toBe('Used in 0 places');
    expect(usedInPlacesLabel(1)).toBe('Used in 1 place');
    expect(usedInPlacesLabel(4)).toBe('Used in 4 places');
  });
});

describe('removedRespondentsSummary', () => {
  it('names a single removed respondent', () => {
    expect(
      removedRespondentsSummary([{ case_id: 'c1', respondent_label: 'R2', removed_at: '' }])
    ).toBe('R2 removed');
  });

  it('counts multiple removals', () => {
    expect(
      removedRespondentsSummary([
        { case_id: 'c1', respondent_label: 'R1' },
        { case_id: 'c2', respondent_label: 'R2' },
        { case_id: 'c3', respondent_label: 'R3' },
      ])
    ).toBe('3 removed');
  });

  it('returns empty when nothing was removed', () => {
    expect(removedRespondentsSummary([])).toBe('');
  });
});
