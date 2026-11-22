import {
  filterFirstRunQuestions,
  firstRunAgentPrompts,
  firstRunGroupChips,
  firstRunQuestionTypeLabel,
  firstRunSuggestedQuestions,
  isTablesFirstRun,
} from './tables-first-run';
import type { OutlineQuestion } from '@/lib/flow-columns';

const outline: OutlineQuestion[] = [
  {
    key: 'titles',
    label: 'Which titles have you read',
    kind: 'multi',
    columns: ['q3_a', 'q3_b'],
    stubValue: 'titles',
  },
  {
    key: 'trust',
    label: 'Trust in brand',
    kind: 'scale 1-5',
    columns: ['q7'],
    stubValue: 'q7',
    measureColumn: 'q7',
  },
  {
    key: 'region',
    label: 'Region',
    kind: 'single',
    columns: ['region'],
    stubValue: 'region',
    measureColumn: 'region',
  },
  {
    key: 'audience',
    label: 'Audience',
    kind: 'single',
    columns: ['audience'],
    stubValue: 'audience',
    measureColumn: 'audience',
  },
  {
    key: 'comment',
    label: 'Any other comments',
    kind: 'open',
    columns: ['oe'],
    stubValue: 'oe',
  },
];

describe('isTablesFirstRun', () => {
  it('is true only when the rail is ready, nothing is saved, and no stub is picked', () => {
    expect(isTablesFirstRun({ railReady: true, savedCount: 0, stub: '' })).toBe(true);
    expect(isTablesFirstRun({ railReady: false, savedCount: 0, stub: '' })).toBe(false);
    expect(isTablesFirstRun({ railReady: true, savedCount: 1, stub: '' })).toBe(false);
    expect(isTablesFirstRun({ railReady: true, savedCount: 0, stub: 'q7' })).toBe(false);
  });
});

describe('firstRunQuestionTypeLabel', () => {
  it('maps outline kinds to plain words', () => {
    expect(firstRunQuestionTypeLabel('multi')).toBe('Multiple choice');
    expect(firstRunQuestionTypeLabel('scale 1-5')).toBe('Rating scale');
    expect(firstRunQuestionTypeLabel('single')).toBe('Single choice');
    expect(firstRunQuestionTypeLabel('numeric')).toBe('Number');
  });
});

describe('firstRunSuggestedQuestions', () => {
  it('takes labelled questions from the outline and skips open ends', () => {
    const rows = firstRunSuggestedQuestions(outline, 3);
    expect(rows).toEqual([
      { value: 'titles', label: 'Which titles have you read', typeLabel: 'Multiple choice' },
      { value: 'q7', label: 'Trust in brand', typeLabel: 'Rating scale' },
      { value: 'region', label: 'Region', typeLabel: 'Single choice' },
    ]);
    expect(rows.every(row => row.label !== 'Any other comments')).toBe(true);
  });
});

describe('firstRunGroupChips', () => {
  it('prefers low-cardinality singles and excludes the picked stub', () => {
    const chips = firstRunGroupChips(
      outline,
      [
        { name: 'region', n_unique: 4 },
        { name: 'audience', n_unique: 3 },
        { name: 'q7', n_unique: 5 },
      ],
      { exclude: 'q7', limit: 3 }
    );
    expect(chips.map(item => item.value)).toEqual(['audience', 'region']);
    expect(chips.every(item => item.value !== 'q7')).toBe(true);
  });
});

describe('firstRunAgentPrompts', () => {
  it('builds prompts from this file and ends with a generic ask', () => {
    const prompts = firstRunAgentPrompts(outline, 3);
    expect(prompts).toHaveLength(3);
    expect(prompts[0]).toContain('by');
    expect(prompts[prompts.length - 1]).toBe('What should I look at first?');
    expect(prompts.join(' ')).not.toMatch(/Global Ledger|Northwind/i);
  });
});

describe('filterFirstRunQuestions', () => {
  it('filters by label without exposing variable names as the match target', () => {
    const hits = filterFirstRunQuestions(outline, 'trust');
    expect(hits).toEqual([{ value: 'q7', label: 'Trust in brand', typeLabel: 'Rating scale' }]);
    expect(filterFirstRunQuestions(outline, '')).toHaveLength(4);
  });
});
