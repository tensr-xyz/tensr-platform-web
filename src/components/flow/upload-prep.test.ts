import { prepApplyBody, preparedCopyLabel, prepParts, qualityFlagTitle } from './upload-prep';

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
        respondents: 800,
        speeder_rows: 2,
        straightline_rows: 2,
        trap_rows: 1,
        bot_rows: 1,
        poor_text_rows: 1,
        threshold: 0.5,
        would_remove: 11,
        would_remove_share: 0.014,
        would_review: 4,
      },
    });
    expect(parts.map(part => part.label)).toEqual([
      '1 shortened labels',
      'brand awareness',
      'Weight: Design weight',
      'NPS groups for How likely are you to recommend it?',
      '11 quality flags',
    ]);
    expect(parts.find(part => part.id === 'flags')?.title).toBe('Flag 11 respondents');
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
    expect(flags?.before).not.toContain('short open answers');
    expect(flags?.after).toContain('Quality flag column');
    expect(flags?.after).toContain('11 of 800 (1.4%) would be removed at the 50% bar');
    expect(flags?.after).toContain('4 to review');
    expect(preparedCopyLabel('W5_raw.sav')).toBe('W5_raw · prepared');
  });

  it('names poor open answers without calling ordinary short reasons short', () => {
    const flags = prepParts({
      quality: {
        flagged: 3,
        respondents: 100,
        poor_text_rows: 3,
        threshold: 0.5,
        would_remove: 0,
        would_review: 3,
      },
    }).find(part => part.id === 'flags');
    expect(flags?.before).toContain('3 poor open answers');
    expect(flags?.before).not.toContain('short open');
  });

  it('says when no NPS scale and no quality flags were found', () => {
    const parts = prepParts({ quality: { flagged: 0, checked: 3 } });
    expect(parts.map(part => part.label)).toEqual(['No NPS scale found', 'No quality flags']);
    expect(parts.every(part => !part.after)).toBe(true);
    expect(prepParts({}).map(part => part.label)).toEqual([
      'No NPS scale found',
      'No quality flags',
    ]);
  });

  it('leads the quality row with the count that would be removed', () => {
    expect(
      qualityFlagTitle({
        flagged: 318,
        respondents: 380,
        would_remove: 3,
        would_remove_share: 0.008,
      })
    ).toBe('Flag 3 respondents');
    const flags = prepParts({
      quality: {
        flagged: 318,
        respondents: 380,
        speeder_rows: 200,
        would_remove: 3,
        would_remove_share: 0.008,
        threshold: 0.5,
      },
    }).find(part => part.id === 'flags');
    expect(flags?.title).toBe('Flag 3 respondents');
    expect(flags?.before).toContain('318 flagged in total');
  });
});
