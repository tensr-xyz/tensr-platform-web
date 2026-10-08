import { starterPromptsForColumns } from './agent-starter-prompts';

describe('starter prompts', () => {
  it('uses the open dataset columns instead of an NBA example', () => {
    const prompts = starterPromptsForColumns([
      { id: '_row_uid', header: '_row_uid', type: 'string' },
      { id: 'Q1', header: 'Gender', type: 'categorical' },
      { id: 'Q3', header: 'Region', type: 'categorical' },
      { id: 'Q5', header: 'Rating', type: 'numeric' },
    ]);
    expect(prompts.join('\n')).toContain('Gender');
    expect(prompts.join('\n')).toContain('Region');
    expect(prompts.join('\n')).not.toMatch(/minutes|points|PTS/i);
  });

  it('does not crosstab an id column by a date column', () => {
    const prompts = starterPromptsForColumns([
      { id: 'participant_id', header: 'participant_id', type: 'string' },
      { id: 'StartDate', header: 'StartDate', type: 'date' },
      { id: 'Q1', header: 'Gender', type: 'categorical', uniqueCount: 2 },
      { id: 'Q3', header: 'Region', type: 'categorical', uniqueCount: 4 },
    ]);
    const crosstab = prompts.find(prompt => /crosstab/i.test(prompt)) || '';
    expect(crosstab).toContain('Gender');
    expect(crosstab).toContain('Region');
    expect(crosstab).not.toMatch(/participant_id|StartDate/);
  });

  it('skips the crosstab chip when only id and date columns are categorical', () => {
    const prompts = starterPromptsForColumns([
      { id: 'participant_id', header: 'participant_id', type: 'string' },
      { id: 'StartDate', header: 'StartDate', type: 'datetime' },
    ]);
    expect(prompts.join('\n')).not.toMatch(/crosstab of participant_id by StartDate/i);
  });
});
