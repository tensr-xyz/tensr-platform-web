import { prepApplyBody, preparedCopyLabel, prepParts } from './upload-prep';

describe('upload prep', () => {
  it('lists each part by its label and never drops rows', () => {
    const parts = prepParts({
      label_changes: [{ column: 'q1', from: 'Long source label', to: 'Short' }],
      variable_sets: [
        {
          label: 'brand awareness',
          columns: ['a', 'b'],
          items: [{ label: 'North' }, { label: 'South' }],
          summary: '2 items, multi-response',
          binary: true,
        },
      ],
      weight_label: 'Design weight',
      weight_summary: { mean: 1, min: 0.5, max: 1.5, effective_base: 40 },
      nps: { label: 'How likely are you to recommend it?' },
      quality: {
        flagged: 6,
        speeder_rows: 2,
        straightline_rows: 2,
        trap_rows: 1,
        bot_rows: 1,
      },
    });
    expect(parts.map(part => part.label)).toEqual([
      '1 shortened labels',
      'brand awareness',
      'Weight: Design weight',
      'NPS groups for How likely are you to recommend it?',
      '6 quality flags',
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
    expect(labels?.before).toBe('Long source label');
    expect(labels?.after).toBe('→ Short');
    const sets = parts.find(part => part.id === 'sets');
    expect(sets?.before).toContain('North · South');
    expect(sets?.after).toBe('→ brand awareness · 2 items, multi-response');
    const weight = parts.find(part => part.id === 'weight');
    expect(weight?.before).toContain('mean 1.00');
    expect(weight?.before).toContain('effective base 40');
    const flags = parts.find(part => part.id === 'flags');
    expect(flags?.before).toContain('finished in under a third of the median time');
    expect(flags?.before).toContain('same answer down a grid');
    expect(flags?.before).toContain('failed an attention check');
    expect(flags?.before).toContain('bot or copy-pasted answers');
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
