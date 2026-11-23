import {
  dependentColumns,
  openEndColumns,
  questionnaireOutline,
  tableStubPickerOptions,
} from './flow-columns';

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
    expect(outline[0].stubValue).toBe('Which types of media do you prefer?');
  });

  it('offers one stub choice per brand multi set, not each member column', () => {
    const options = tableStubPickerOptions(
      [
        { name: 'r1', label: 'Read last month: Title A' },
        { name: 'r2', label: 'Read last month: Title B' },
        { name: 'r3', label: 'Read last month: Title C' },
        { name: 'aud', label: 'Audience', value_labels: { '1': 'North', '2': 'South' } },
        { name: 'w', label: 'Weight', role: 'weight' },
      ],
      [
        {
          id: 'read_last_month',
          name: 'Read last month',
          label: 'Read last month',
          kind: 'multiple_response',
          columns: ['r1', 'r2', 'r3'],
        },
      ],
      ['w']
    );
    expect(options).toEqual([
      { value: 'Read last month', label: 'Read last month' },
      { value: 'aud', label: 'Audience' },
    ]);
  });

  it('keeps unlabelled text categoricals on the stub list when n_unique is low', () => {
    const options = tableStubPickerOptions(
      [
        {
          name: 'gender',
          label: 'What is your gender?',
          type: 'string',
          n_unique: 2,
          n_rows: 400,
        },
        {
          name: 'region',
          label: 'Which region?',
          type: 'string',
          n_unique: 4,
          n_rows: 400,
        },
        {
          name: 'brand',
          label: 'Which brand?',
          type: 'string',
          n_unique: 6,
          n_rows: 400,
        },
        {
          name: 'why',
          label: 'Why that score?',
          type: 'string',
          n_unique: 180,
          n_rows: 400,
        },
        {
          name: 'rating',
          label: 'How would you rate the product? (1-5)',
          type: 'numeric',
        },
        {
          name: 'spend',
          label: 'How much did you spend?',
          type: 'numeric',
        },
      ],
      [],
      []
    );
    expect(options.map(item => item.label)).toEqual([
      'What is your gender?',
      'Which region?',
      'Which brand?',
      'How would you rate the product? (1-5)',
      'How much did you spend?',
    ]);
  });

  it('groups shared Question - Option labels when sets are missing and hides admin / Other', () => {
    const options = tableStubPickerOptions(
      [
        { name: 'SubmittedOn', label: 'Submitted On' },
        {
          name: 't1',
          label: 'What food and nutrition topics do you keep informed about? - Obesity',
        },
        {
          name: 't2',
          label: 'What food and nutrition topics do you keep informed about? - Diabetes',
        },
        {
          name: 't3',
          label: 'What food and nutrition topics do you keep informed about? - Other Choice',
          type: 'string',
        },
        { name: 'region', label: 'Region', value_labels: { '1': 'North', '2': 'South' } },
      ],
      [],
      []
    );
    expect(options.map(item => item.label)).toEqual([
      'What food and nutrition topics do you keep informed about?',
      'Region',
    ]);
    expect(options[0].value).toBe('What food and nutrition topics do you keep informed about?');
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

  it('offers agent-coded *_themes columns and metadata-coded frames', () => {
    const { themeColumns, isCodedOpenEndColumn, sourceTextColumnFor } =
      jest.requireActual('./flow-columns');
    const columns = [
      {
        name: 'sat_reason_themes',
        label: 'Why did you give that satisfaction score? themes',
        source_text_column: 'sat_reason',
        coded_multi: true,
      },
      { name: 'sat_reason', label: 'Why did you give that satisfaction score?' },
      {
        name: 'notes_coded',
        label: 'Notes themes',
        source_text_column: 'notes',
        codeframe: { source_text_column: 'notes', codes: [] },
      },
      { name: 'region', label: 'Region' },
    ];
    expect(themeColumns(columns)).toEqual([
      { value: 'sat_reason_themes', label: 'Why did you give that satisfaction score?' },
      { value: 'notes_coded', label: 'Notes' },
    ]);
    expect(isCodedOpenEndColumn(columns[0])).toBe(true);
    expect(isCodedOpenEndColumn(columns[3])).toBe(false);
    expect(sourceTextColumnFor(columns[0], columns)).toBe('sat_reason');
    expect(sourceTextColumnFor({ name: 'open_end_codes' }, columns)).toBe('open_end');
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
    expect(questionKind({ name: 'gender', type: 'string', n_unique: 2, n_rows: 400 }, [])).toBe(
      'single'
    );
    expect(questionKind({ name: 'comment', type: 'string', n_unique: 180, n_rows: 400 }, [])).toBe(
      'open'
    );
    expect(questionKind({ name: 'q5_1', type: 'numeric' }, [1], new Set(['q5_1']))).toBe('multi');
    expect(questionKind({ name: 'weight', type: 'numeric' }, [0.8, 1.2, 1.1])).toBe('numeric');
  });

  it('keeps labelled nominals as single choice, not a rating scale', () => {
    const { questionKind } = jest.requireActual('./flow-columns');
    const regionLabels = {
      '1': 'North',
      '2': 'South',
      '3': 'East',
      '4': 'West',
      '5': 'Central',
    };
    expect(
      questionKind(
        {
          name: 'region',
          type: 'numeric',
          measure: 'nominal',
          value_labels: regionLabels,
        },
        [1, 2, 3, 4, 5]
      )
    ).toBe('single');
    expect(
      questionKind(
        {
          name: 'region',
          type: 'numeric',
          measure: 'scale',
          value_labels: regionLabels,
        },
        [1, 2, 3, 4, 5]
      )
    ).toBe('single');
    expect(
      questionKind(
        {
          name: 'profession',
          type: 'numeric',
          value_labels: {
            '1': 'GP',
            '2': 'Nurse',
            '3': 'Pharmacist',
            '4': 'Dietitian',
            '5': 'Specialist',
            '6': 'Other clinician',
            '7': 'Prefer not to say',
          },
        },
        [1, 2, 3, 4, 5, 6, 7]
      )
    ).toBe('single');
    expect(
      questionKind(
        {
          name: 'agree',
          type: 'numeric',
          measure: 'ordinal',
          value_labels: {
            '1': 'Strongly disagree',
            '2': 'Disagree',
            '3': 'Neither',
            '4': 'Agree',
            '5': 'Strongly agree',
          },
        },
        [1, 2, 3, 4, 5]
      )
    ).toBe('scale 1-5');
    expect(
      questionKind(
        { name: 'why', type: 'numeric', measure: 'nominal', n_unique: 200, n_rows: 300 },
        []
      )
    ).not.toBe('numeric');
  });
});

describe('id columns', () => {
  it('skips respondent ids by name or by every value being distinct', () => {
    const { isIdColumn } = jest.requireActual('./flow-columns');
    expect(isIdColumn('Respondent id')).toBe(true);
    expect(isIdColumn('Respondent')).toBe(true);
    expect(isIdColumn('resp_id')).toBe(true);
    expect(isIdColumn('pid')).toBe(true);
    expect(isIdColumn('psid')).toBe(true);
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

describe('outline linked other-choice and full stems', () => {
  it('hides Data Preparation flag columns from the questionnaire outline', () => {
    const outline = questionnaireOutline(
      [
        { name: 'region', label: 'Region' },
        {
          name: 'prep_quality',
          label: 'Share of quality checks failed',
          role: 'helper',
          folder: 'Data Preparation',
        },
        {
          name: 'prep_decision',
          label: 'Quality decision (keep, review, or remove)',
          role: 'helper',
          folder: 'Data Preparation',
        },
      ],
      [
        {
          id: 'data_preparation',
          name: 'Data Preparation',
          label: 'Data Preparation',
          kind: 'group',
          columns: ['prep_quality', 'prep_decision'],
        },
      ]
    );
    expect(outline.map(item => item.label)).toEqual(['Region']);
  });

  it('hides id columns and linked Other Choice text from the outline', () => {
    const outline = questionnaireOutline(
      [
        { name: 'Respondent', label: 'Respondent' },
        { name: 'pid', label: 'pid' },
        { name: 'psid', label: 'psid' },
        {
          name: 'q_5',
          label: 'Please select the profession you currently hold.',
        },
        {
          name: 'q_5_text',
          label: 'Please select the profession you currently hold. - Other Choice',
          type: 'string',
          linked_set: 'q_5',
          role: 'helper',
        },
        {
          name: 'q_3_1',
          label: 'Which of the following best describes your race and ethnic background? - Asian',
        },
        {
          name: 'q_3_2',
          label: 'Which of the following best describes your race and ethnic background? - Black',
        },
      ],
      [
        {
          id: 'q_3',
          name: 'Which of the following best describes your race and ethnic background?',
          label: 'Which of the following best describes your race and ethnic background?',
          kind: 'multiple_response',
          columns: ['q_3_1', 'q_3_2'],
        },
      ],
      { kinds: { q_5: 'single' } }
    );
    expect(outline.map(item => item.label)).toEqual([
      'Please select the profession you currently hold.',
      'Which of the following best describes your race and ethnic background?',
    ]);
    expect(outline[1].kind).toBe('multi');
  });
});
