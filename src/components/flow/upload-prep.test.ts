import { prepApplyBody, prepParts } from './upload-prep';

describe('upload prep', () => {
  it('lists each part by its label and never drops rows', () => {
    const parts = prepParts({
      label_changes: [{ column: 'q1', to: 'Short' }],
      variable_sets: [{ label: 'brand awareness', columns: ['a', 'b'] }],
      weight_label: 'Design weight',
      nps: { label: 'How likely are you to recommend it?' },
      quality: { flagged: 4 },
    });
    expect(parts.map(part => part.label)).toEqual([
      '1 shortened labels',
      'brand awareness',
      'Weight: Design weight',
      'NPS groups for How likely are you to recommend it?',
      '4 quality flags',
    ]);
    const body = prepApplyBody(['sets', 'weight']);
    expect(body).toEqual({
      labels: false,
      sets: true,
      weight: true,
      nps: false,
      flags: false,
      drop_rows: false,
    });
  });
});
