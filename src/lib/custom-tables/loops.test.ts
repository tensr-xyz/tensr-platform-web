import {
  DATASET_METADATA_EVENT,
  loopMemberNames,
  loopPickerColumns,
  loopProposalSentence,
  notifyDatasetMetadata,
} from './loops';

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

  it('names the wide columns that belong in the group', () => {
    expect(loopMemberNames([CARS])).toEqual(['aware_A', 'owns_A']);
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

  it('tells the column panel to reload after a chat confirm', () => {
    const heard: string[] = [];
    const onEvent = (event: Event) => {
      heard.push(String((event as CustomEvent<{ datasetId?: string }>).detail?.datasetId));
    };
    window.addEventListener(DATASET_METADATA_EVENT, onEvent);
    notifyDatasetMetadata('dataset-1');
    window.removeEventListener(DATASET_METADATA_EVENT, onEvent);
    expect(heard).toEqual(['dataset-1']);
  });
});
