import { sharedIdOptions } from './join-files';

describe('sharedIdOptions', () => {
  it('matches columns by label when the variable names differ', () => {
    const options = sharedIdOptions(
      [
        { name: 'resp_id', label: 'Respondent ID' },
        { name: 'age', label: 'Age' },
      ],
      [
        { name: 'id', label: 'Respondent ID' },
        { name: 'age', label: 'Age' },
      ]
    );
    expect(options).toEqual([
      { leftName: 'resp_id', rightName: 'id', label: 'Respondent ID' },
      { leftName: 'age', rightName: 'age', label: 'Age' },
    ]);
  });

  it('falls back to the column name when there is no label', () => {
    const options = sharedIdOptions(
      [{ name: 'case_id' }, { name: 'score' }],
      [{ name: 'case_id' }, { name: 'score' }]
    );
    expect(options.map(option => option.label)).toEqual(['case_id', 'score']);
  });
});
