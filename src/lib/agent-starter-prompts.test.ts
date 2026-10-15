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

  it('does not suggest RespID, ResponseId, or a high-uniqueness integer', () => {
    const prompts = starterPromptsForColumns([
      { id: 'RespID', header: 'RespID', type: 'categorical', uniqueCount: 300 },
      { id: 'ResponseId', header: 'ResponseId', type: 'string' },
      { id: 'resp_id', header: 'resp_id', type: 'string' },
      { id: 'case_no', header: 'case_no', type: 'integer', uniqueCount: 300 },
      { id: 'Gender', header: 'Gender', type: 'categorical', uniqueCount: 2 },
      { id: 'Group', header: 'Group', type: 'categorical', uniqueCount: 2 },
    ]);
    const text = prompts.join('\n');
    expect(text).toMatch(/Gender/);
    expect(text).toMatch(/Group/);
    expect(text).not.toMatch(/RespID|ResponseId|resp_id|case_no/);
  });

  it('does not crosstab a continuous column such as Age', () => {
    const prompts = starterPromptsForColumns([
      { id: 'Age', header: 'Age', type: 'categorical', uniqueCount: 20 },
      { id: 'Q1', header: 'Gender', type: 'categorical', uniqueCount: 2 },
      { id: 'Group', header: 'Group', type: 'categorical', uniqueCount: 3 },
    ]);
    const crosstab = prompts.find(prompt => /crosstab/i.test(prompt)) || '';
    expect(crosstab).toContain('Gender');
    expect(crosstab).toContain('Group');
    expect(crosstab).not.toMatch(/Age/);
  });

  it('bins a continuous column when the other column is categorical', () => {
    const prompts = starterPromptsForColumns([
      { id: 'Age', header: 'Age', type: 'categorical', uniqueCount: 48 },
      { id: 'Group', header: 'Group', type: 'categorical', uniqueCount: 3 },
    ]);
    const crosstab = prompts.find(prompt => /crosstab/i.test(prompt)) || '';
    expect(crosstab).toMatch(/Bin Age/);
    expect(crosstab).toContain('Group');
    expect(crosstab).not.toMatch(/crosstab of Age by Group|crosstab of Group by Age/);
  });
});
