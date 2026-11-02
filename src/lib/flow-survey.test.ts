import { bannerHeading, codedStub, efficiencyPercent, selectionFromCell } from './flow-survey';

describe('flow survey grid', () => {
  it('prefers the value label over a stored banner code', () => {
    expect(
      bannerHeading({
        id: 'region=1',
        label: 'East',
        codes: [{ code: '1' }],
      })
    ).toBe('East');
    expect(bannerHeading({ id: 'region=1', codes: [{ code: '1' }] })).toBe('1');
  });

  it('treats a coded open end as a multi-response stub', () => {
    expect(codedStub('open_end_codes')).toEqual({
      column: 'open_end_codes',
      multiple_response: true,
      value_delimiter: '|',
    });
    expect(codedStub('measure')).toEqual({ column: 'measure' });
  });

  it('keeps the cell percent, base, and n for the evidence drill', () => {
    const selected = selectionFromCell(
      { resolved_weight: 'weight' },
      { id: 'row-1', label: 'Theme', source_text_column: 'open_end' },
      {
        banner_id: 'total',
        percent: 25,
        unweighted_n: 4,
        column_unweighted_n: 12,
        provenance: { row_uid_bitset: 'bitset' },
      },
      'A'
    );
    expect(selected).toMatchObject({
      percent: '25.0%',
      n: '4',
      base: '12',
      weight: 'weight',
      textColumn: 'open_end',
      bitset: 'bitset',
      letter: 'A',
    });
  });

  it('uses an origin bitset when the cell does not carry one of its own', () => {
    const selected = selectionFromCell(
      {},
      { id: 'row-1', label: 'Theme', column: 'open_end' },
      {
        banner_id: 'total',
        percent: 10,
        unweighted_n: 2,
        column_unweighted_n: 8,
        provenance: { origin_bitsets: { origin: { row_uid_bitset: 'abc' } } },
      }
    );
    expect(selected?.bitset).toBe('abc');
    expect(selected?.percent).toBe('10.0%');
  });

  it('keeps the cell claim when provenance says the bitset is unavailable', () => {
    const selected = selectionFromCell(
      {},
      { id: 'row-1', label: 'Theme', column: 'open_end' },
      {
        banner_id: 'total',
        percent: 10,
        unweighted_n: 2,
        column_unweighted_n: 8,
        provenance: {
          provenance_unavailable: 'unknown_row_uids',
          origin_bitsets: { origin: { row_uid_bitset: 'abc' } },
        },
      }
    );
    expect(selected?.bitset).toBe('');
    expect(selected?.n).toBe('2');
  });

  it('shows rake efficiency as a percent', () => {
    expect(efficiencyPercent(0.82)).toBe('82.0%');
  });
});

describe('theme read', () => {
  it('names the largest theme and the largest significant segment gap', () => {
    const { themeRead } = jest.requireActual('./flow-survey');
    const book = {
      banner_columns: [
        { id: 'total', label: 'Total' },
        { id: 'r=E', label: 'region=East', letter_slot: 'A' },
        { id: 'r=N', label: 'region=North', letter_slot: 'B' },
      ],
      letters: [{ stub_row_id: 'price', banner_id: 'r=E', letter: 'B' }],
      rows: [
        {
          id: 'price',
          label: 'Price',
          kind: 'value',
          cells: [
            { banner_id: 'total', percent: 31 },
            { banner_id: 'r=E', percent: 40 },
            { banner_id: 'r=N', percent: 22 },
          ],
        },
        {
          id: 'staff',
          label: 'Staff',
          kind: 'value',
          cells: [{ banner_id: 'total', percent: 12 }],
        },
      ],
    };
    const read = themeRead(book);
    expect(read.text).toBe(
      'Price is the largest theme, at 31% overall. Price is higher in East (40%) than North (22%) at 95%.'
    );
    expect(read.bannerId).toBe('r=E');
  });
});
