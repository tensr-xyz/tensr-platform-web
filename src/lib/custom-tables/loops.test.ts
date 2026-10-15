import { loopPickerColumns, loopProposalSentence } from './loops';

const CARS = {
  id: 'aware+likes+owns',
  stems: ['aware', 'owns', 'likes'],
  items: ['A', 'B', 'C'],
  item_key: 'item',
  item_title: 'Brand',
  stem_labels: { aware: 'Are you aware of', owns: 'Do you own', likes: 'How much do you like' },
  stem_value_labels: { aware: { '0': 'No', '1': 'Yes' } },
  members: [
    { column: 'aware_A', stem: 'aware', item: 'A' },
    { column: 'owns_A', stem: 'owns', item: 'A' },
  ],
};

describe('loop proposals', () => {
  it('says which questions asked for which brands', () => {
    expect(loopProposalSentence({ ...CARS, item_title: undefined })).toBe(
      'aware, owns, likes asked for brands A, B, C'
    );
  });

  it('lists the loop questions and hides the wide columns', () => {
    const columns = loopPickerColumns(
      [
        { id: 'aware_A', label: 'aware_A' },
        { id: 'region', label: 'Region' },
        { id: 'weight', label: 'Weight' },
      ],
      CARS
    );
    expect(columns.map(column => column.label)).toEqual([
      'Brand',
      'Are you aware of',
      'Do you own',
      'How much do you like',
      'Region',
      'Weight',
    ]);
    expect(columns[0]?.hideId).toBe(true);
    expect(columns[0]?.id).toBe('item');
    expect(columns.some(column => column.id === 'aware_A')).toBe(false);
  });
});
