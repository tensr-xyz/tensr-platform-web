import { dependentColumns, openEndColumns, questionnaireOutline } from './flow-columns';

describe('ANOVA dependent columns', () => {
  it('keeps a numeric companion when the preview type is text and id is the only numeric type', () => {
    const names = dependentColumns([
      { name: 'id', type: 'numeric' },
      { name: 'agree_value_numeric', type: 'string', measure: 'nominal' },
      { name: 'comment', type: 'string' },
    ]);
    expect(names).toContain('agree_value_numeric');
    expect(names).toContain('id');
    expect(names).not.toContain('comment');
  });

  it('keeps a scale measure whose stored type is not numeric', () => {
    expect(dependentColumns([{ name: 'satisfaction', type: 'string', measure: 'scale' }])).toEqual([
      'satisfaction',
    ]);
  });
});

describe('code frame open ends', () => {
  it('keeps text columns and drops numeric and already-coded ones', () => {
    expect(
      openEndColumns([
        { name: 'comments', type: 'string' },
        { name: 'Q7', type: 'numeric' },
        { name: 'agree_value', type: 'string', measure: 'ordinal' },
        { name: 'comments_codes', type: 'string' },
        { name: 'region', type: 'string', measure: 'nominal' },
      ])
    ).toEqual(['comments', 'region']);
  });
});

describe('picker columns', () => {
  it('drops row ids, coding scratch, stored codes, and admin fields', () => {
    const { pickerColumns, isInternalColumn } = jest.requireActual('./flow-columns');
    expect(
      pickerColumns([
        { name: '_row_uid' },
        { name: 'comments_coding' },
        { name: 'comments_codes' },
        { name: 'region' },
        { name: 'ResponseId', role: 'admin' },
      ]).map((column: { name: string }) => column.name)
    ).toEqual(['region']);
    expect(isInternalColumn('source_wave')).toBe(false);
    expect(
      pickerColumns([{ name: 'region' }, { name: undefined as unknown as string }]).map(
        (column: { name: string }) => column.name
      )
    ).toEqual(['region']);
  });

  it('collapses multi-select sets and skips admin columns in the outline', () => {
    const outline = questionnaireOutline(
      [
        { name: 'ResponseId', label: 'Response ID', role: 'admin' },
        { name: 'q_6_1', label: 'Which types of media do you prefer? - Email' },
        { name: 'q_6_2', label: 'Which types of media do you prefer? - Social' },
        { name: 'q_6_3', label: 'Which types of media do you prefer? - Podcasts' },
        {
          name: 'q_6_4_text',
          label: 'Which types of media do you prefer? - Other (please specify)',
          type: 'string',
        },
        { name: 'region', label: 'Region' },
        { name: 'weight', label: 'Weight', role: 'weight' },
      ],
      [
        {
          id: 'q_6',
          name: 'Which types of media do you prefer?',
          label: 'Which types of media do you prefer?',
          kind: 'multiple_response',
          columns: ['q_6_1', 'q_6_2', 'q_6_3'],
          text_columns: [
            {
              column: 'q_6_4_text',
              label: 'Which types of media do you prefer? - Other (please specify)',
            },
          ],
        },
      ],
      { weightName: 'weight', kinds: { region: 'single', q_6_1: 'multi' } }
    );
    expect(outline.map(item => item.label)).toEqual([
      'Which types of media do you prefer?',
      'Region',
    ]);
    expect(outline[0].kind).toBe('multi');
    expect(outline[0].columns).toEqual(['q_6_1', 'q_6_2', 'q_6_3']);
  });

  it('keeps questionnaire order and groups open-end boxes as one open question', () => {
    const outline = questionnaireOutline(
      [
        { name: 'region', label: 'Region' },
        {
          name: 'q_12_1',
          label: 'Can you share some of your favourite sources - 1',
          type: 'string',
        },
        {
          name: 'q_12_2',
          label: 'Can you share some of your favourite sources - 2',
          type: 'string',
        },
        {
          name: 'q_12_3',
          label: 'Can you share some of your favourite sources - 3',
          type: 'string',
        },
        { name: 'q_9_1_1', label: 'Source A - Price' },
        { name: 'q_9_1_2', label: 'Source A - Speed' },
        { name: 'q_9_2_1', label: 'Source B - Price' },
        { name: 'q_9_2_2', label: 'Source B - Speed' },
      ],
      [
        {
          id: 'q_9',
          name: 'Sources grid',
          label: 'Sources grid',
          kind: 'grid',
          columns: ['q_9_1_1', 'q_9_1_2', 'q_9_2_1', 'q_9_2_2'],
        },
        {
          id: 'q_12',
          name: 'Can you share some of your favourite sources',
          label: 'Can you share some of your favourite sources',
          kind: 'group',
          structure: 'open_end',
          columns: ['q_12_1', 'q_12_2', 'q_12_3'],
        },
      ],
      { kinds: { region: 'single' } }
    );
    expect(outline.map(item => item.kind)).toEqual(['single', 'open', 'grid']);
    expect(outline.map(item => item.label)).toEqual([
      'Region',
      'Can you share some of your favourite sources',
      'Sources grid',
    ]);
    expect(outline[1].columns).toEqual(['q_12_1', 'q_12_2', 'q_12_3']);
  });

  it('offers coded open ends by their open-end name', () => {
    const { themeColumns } = jest.requireActual('./flow-columns');
    expect(
      themeColumns([
        { name: 'comments_codes', label: 'Codes for comments' },
        { name: 'Q7_codes' },
        { name: 'region', label: 'Region' },
      ])
    ).toEqual([
      { value: 'comments_codes', label: 'comments' },
      { value: 'Q7_codes', label: 'Q7' },
    ]);
  });
});

describe('question kind', () => {
  it('reads the type from labels, values, and response sets', () => {
    const { questionKind } = jest.requireActual('./flow-columns');
    expect(questionKind({ name: 'aware', type: 'numeric' }, [0, 1, 1, 0])).toBe('single');
    expect(questionKind({ name: 'likes', type: 'numeric' }, [1, 2, 5, 4, 3])).toBe('scale 1-5');
    expect(questionKind({ name: 'nps', type: 'numeric' }, [0, 7, 10, 9, 3])).toBe('scale 0-10');
    expect(questionKind({ name: 'region', type: 'numeric' }, [1, 2, 2, 1])).toBe('single');
    expect(questionKind({ name: 'wave', type: 'string' }, ['a', 'b', 'a', 'b', 'a'])).toBe(
      'single'
    );
    expect(questionKind({ name: 'why', type: 'string' }, ['too dear', 'staff', 'slow'])).toBe(
      'open'
    );
    expect(questionKind({ name: 'q5_1', type: 'numeric' }, [1], new Set(['q5_1']))).toBe('multi');
    expect(questionKind({ name: 'weight', type: 'numeric' }, [0.8, 1.2, 1.1])).toBe('numeric');
  });
});

describe('id columns', () => {
  it('skips respondent ids by name or by every value being distinct', () => {
    const { isIdColumn } = jest.requireActual('./flow-columns');
    expect(isIdColumn('Respondent id')).toBe(true);
    expect(isIdColumn('resp_id')).toBe(true);
    expect(isIdColumn('ID')).toBe(true);
    expect(isIdColumn('_row_uid')).toBe(true);
    expect(isIdColumn('serial_no')).toBe(true);
    expect(isIdColumn('region')).toBe(false);
    expect(isIdColumn('paid')).toBe(false);
    const distinct = Array.from({ length: 30 }, (_, index) => index + 1);
    expect(isIdColumn('code', distinct)).toBe(true);
    expect(
      isIdColumn(
        'likes',
        distinct.map(value => value % 5)
      )
    ).toBe(false);
  });
});
