import { isAnswer, reviewRowsFromPreview, uncodedTotal } from './coding-review-data';
import { groupDatasets, uploadTotal } from './datasets-screen';
import { projectTableRows, tableFileNote } from './project-tables';
import {
  compareManyWaves,
  compareWaves,
  labelDifferences,
  reversedCodes,
  stackMappings,
  stackRecodes,
} from './stack-waves';
import {
  agentHistory,
  agentReplyText,
  tableBodyFromAgentBook,
  columnChoiceLabel,
  tableWeightChoices,
  themeRows,
  weightOptionLabel,
} from './survey-screens';
import { rakeOutputColumn } from './weight-modal';

describe('QA round 6', () => {
  test('3: the modal names the column the rake will add', () => {
    expect(rakeOutputColumn(['id', 'region'])).toBe('weight');
    expect(rakeOutputColumn(['id', 'Weight'])).toBe('rake_weight');
    expect(rakeOutputColumn(['weight', 'rake_weight', 'weight_2'])).toBe('weight_3');
  });

  test('a question named like its variable stays the question, not a category', () => {
    expect(
      columnChoiceLabel({
        name: 'region',
        label: 'Region',
      })
    ).toBe('Region');
  });

  test('4: weight menu has no _weight copy, no duplicates, no "Weight Weight"', () => {
    expect(
      tableWeightChoices(['rake_weight', '_weight', 'weight', 'Weight'], 'rake_weight')
    ).toEqual(['rake_weight', 'weight']);
    expect(weightOptionLabel('weight', 'Weight')).toBe('weight');
    expect(weightOptionLabel('rake_weight', 'Survey weight, raked to targets.csv')).toBe(
      'Survey weight, raked to targets.csv'
    );
    expect(weightOptionLabel('design_weight', 'Design weight')).toBe('Design weight');
  });

  test('3: an answer to the agent question carries the earlier turns', () => {
    const history = agentHistory([
      { role: 'user', text: 'Use the raked file, weight by _weight, stub Q7' },
      { role: 'reply', text: 'Which banner?' },
      { role: 'run', text: 'Built Q7' },
    ]);
    expect(history).toEqual([
      { role: 'user', content: 'Use the raked file, weight by _weight, stub Q7' },
      { role: 'assistant', content: 'Which banner?' },
    ]);
    expect(
      agentReplyText({ status: 'clarification', clarification_questions: ['Which banner?'] })
    ).toBe('Which banner?');
  });

  test('5: the agent table re-runs with every value row and saves', () => {
    const body = tableBodyFromAgentBook({
      cells: [],
      banner_columns: [],
      spec: {
        stubs: [{ column: 'Q7', values: [], nets: [{ label: 'Top 2 Box', values: ['4', '5'] }] }],
        banners: [{ columns: ['source_wave', 'region'] }],
        statistics: ['column_proportion'],
        weight: { dataset_id: 'd', column: '_weight' },
      },
    });
    expect(body).toEqual({
      stubs: [{ column: 'Q7', nets: [{ label: 'Top 2 Box', values: ['4', '5'] }] }],
      banner: [{ columns: ['source_wave', 'region'] }],
      statistics: ['column_proportion'],
      weight: '_weight',
      save: true,
    });
    expect(tableBodyFromAgentBook({ spec: { stubs: [] } })).toBeNull();
  });

  test('6: project tables keep their file and say when it is another one', () => {
    const rows = projectTableRows([
      { spec_id: 't1', label: 'Q7', dataset_id: 'a', filename: 'cars_EN.sav' },
      { spec_id: 't1', label: 'Q7', dataset_id: 'a', filename: 'cars_EN.sav' },
      { spec_id: 't2', label: 'Q8', dataset_id: 'b', filename: 'cars_EN - weighted 3 Nov' },
    ]);
    expect(rows.map(row => row.id)).toEqual(['t1', 't2']);
    expect(tableFileNote(rows[0], 'a')).toBe('');
    expect(tableFileNote(rows[1], 'a')).toBe('on cars_EN - weighted 3 Nov');
  });

  test('2: stacking flags codes and labels that differ, and recodes to match', () => {
    const en = { name: 'Q7', value_labels: { '1': 'Disagree', '5': 'Agree' } };
    const fr = { name: 'Q7', value_labels: { '1': "Pas d'accord", '5': "D'accord" } };
    expect(labelDifferences(en, fr)).toBe('labels translated');
    const two = compareWaves([en], [fr], 'cars_EN', 'cars_FR');
    expect(two[0]).toMatchObject({ kind: 'matched', labelsDiffer: true });
    const many = compareManyWaves([
      { name: 'cars_EN', columns: [en] },
      { name: 'cars_DE', columns: [en] },
      { name: 'cars_FR', columns: [fr] },
    ]);
    expect(many[0].kind).toBe('matched');
    expect(many[0].reason).toContain('cars_FR');
    expect(reversedCodes(['1', '2', '3', '4', '5'])).toEqual({
      '1': '5',
      '2': '4',
      '3': '3',
      '4': '2',
      '5': '1',
    });
    const choices = { [many[0].id]: { decision: 'recode' as const, target: '' } };
    expect(
      stackRecodes(many, choices, { [many[0].id]: { fr: { '1': '5', '5': '1', '3': '3' } } })
    ).toEqual({ fr: { Q7: { '1': '5', '5': '1' } } });
    expect(stackMappings(many, choices)[0].decision).toBe('accept');
  });

  test('9: a coded column ends on Not yet coded in Tables too, unsorted', () => {
    const cell = (n: number) => ({ banner_id: 'total', unweighted_n: n, column_unweighted_n: 348 });
    const rows = themeRows(
      [
        { id: 'a', label: 'A', cells: [cell(5)] },
        { id: 'b', label: 'B', cells: [cell(9)] },
      ] as never,
      85,
      false
    );
    expect(rows.map(row => row.label)).toEqual(['A', 'B', 'Not yet coded']);
  });

  test('10: the review queue and the count use the API rule for non-answers', () => {
    expect(isAnswer('No comment')).toBe(false);
    expect(isAnswer('n/a')).toBe(false);
    expect(isAnswer('Delivery was late')).toBe(true);
    const page = {
      variable_names: ['comments', 'comments_coding'],
      rows: [
        ['Delivery was late', JSON.stringify({ row: 0 })],
        ['No comment', JSON.stringify({ row: 1 })],
        ['', JSON.stringify({ row: 2 })],
      ],
      n_rows_matched: 3,
      truncated: false,
    };
    const queue = reviewRowsFromPreview(page, 'comments', 'comments_codes');
    expect(queue).toHaveLength(1);
    expect(uncodedTotal(page, queue.length)).toBe(1);
    expect(uncodedTotal({ ...page, truncated: true, n_rows_matched: 50 }, queue.length)).toBe(48);
  });

  test('19: a version whose parent is archived nests under its upload; one upload count', () => {
    const rows = [
      { dataset_id: 'up', original_filename: 'cars_EN.sav' },
      { dataset_id: 'v2', parent_dataset_id: 'archived', origin_dataset_id: 'up' },
      { dataset_id: 'v1', parent_dataset_id: 'up' },
      { dataset_id: 'other', original_filename: 'cars_DE.sav' },
    ];
    const groups = groupDatasets(rows);
    expect(groups.find(group => group.root.dataset_id === 'up')?.versions).toHaveLength(2);
    expect(uploadTotal(rows)).toBe(2);
  });
});
