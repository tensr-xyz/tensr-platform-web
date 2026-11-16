import { prepApplyBody, preparedCopyLabel, prepParts } from './upload-prep';

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
    const labels = parts.find(part => part.id === 'labels');
    expect(labels?.title).toBe('Shorten 1 label');
    expect(labels?.before).toBe('');
    expect(labels?.after).toBe('→ Short');
    expect(preparedCopyLabel('W5_raw.sav')).toBe('W5_raw · prepared');
  });

  it('says when no NPS scale and no quality flags were found', () => {
    const parts = prepParts({ quality: { flagged: 0, checked: 3 } });
    expect(parts.map(part => part.label)).toEqual(['No NPS scale found', 'No quality flags']);
    expect(prepParts({}).map(part => part.label)).toEqual([
      'No NPS scale found',
      'No quality flags',
    ]);
  });
});
