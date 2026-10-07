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
});
