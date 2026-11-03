import {
  buildOverrides,
  codesForApply,
  frameCodes,
  isLowConfidence,
  newCodeId,
  respondentLabel,
  reviewRowsFromPreview,
  splitCodeCell,
} from './coding-review-data';

describe('coding review data', () => {
  it('reads the saved code frame, then falls back to value labels', () => {
    expect(
      frameCodes({
        codeframe: { codes: [{ id: 'price', label: 'Price too high', keywords: ['price'] }] },
      })
    ).toEqual([
      { id: 'price', label: 'Price too high', definition: '', keywords: ['price'], examples: [] },
    ]);
    expect(frameCodes({ value_labels: { a: 'Apple' } })[0]).toMatchObject({
      id: 'a',
      label: 'Apple',
    });
    expect(frameCodes(null)).toEqual([]);
  });

  it('gives every code a keyword for the apply route', () => {
    const [code] = codesForApply(frameCodes({ value_labels: { a: 'Apple' } }));
    expect(code.keywords).toEqual(['Apple']);
  });

  it('makes unique ids for new themes', () => {
    expect(newCodeId('App reliability', [])).toBe('app_reliability');
    expect(newCodeId('App reliability', ['app_reliability'])).toBe('app_reliability_2');
    expect(newCodeId('!!', [])).toBe('theme');
  });

  it('reads uncoded rows with their row position and suggestion', () => {
    const rows = reviewRowsFromPreview(
      {
        variable_names: ['respondent_id', 'comments', 'comments_codes', 'comments_coding'],
        rows: [
          [
            '118',
            'App crashes',
            'uncoded',
            JSON.stringify({ row: 4, suggested_codes: ['support'], confidence: 0.41 }),
          ],
          ['119', 'Fine', 'uncoded', JSON.stringify({ row: 5, suggested_codes: [] })],
          ['120', 'No row', 'uncoded', '{}'],
        ],
      },
      'comments',
      'comments_codes'
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      row: 4,
      respondentId: '118',
      text: 'App crashes',
      suggested: ['support'],
      confidence: 0.41,
    });
    expect(isLowConfidence(rows[0])).toBe(true);
    expect(isLowConfidence(rows[1])).toBe(false);
    expect(respondentLabel(rows[0])).toBe('Respondent 118');
    expect(respondentLabel({ ...rows[1], respondentId: null })).toBe('Row 6');
  });

  it('keeps existing codes and swaps in reviewed ones', () => {
    expect(splitCodeCell('a|uncoded|b')).toEqual(['a', 'b']);
    expect(buildOverrides(['a|b', 'uncoded', '', null], { 1: ['c'] })).toEqual({
      '0': ['a', 'b'],
      '1': ['c'],
      '2': [],
      '3': [],
    });
  });
});

describe('blank answers', () => {
  it('leaves blank answers out of the review queue', () => {
    const { reviewRowsFromPreview } = jest.requireActual('./coding-review-data');
    const rows = reviewRowsFromPreview(
      {
        variable_names: ['comments', 'comments_coding'],
        rows: [
          ['(blank)', JSON.stringify({ row: 1 })],
          ['', JSON.stringify({ row: 2 })],
          ['Too expensive', JSON.stringify({ row: 3 })],
        ],
      },
      'comments',
      'comments_codes'
    );
    expect(rows.map((row: { text: string }) => row.text)).toEqual(['Too expensive']);
  });
});
