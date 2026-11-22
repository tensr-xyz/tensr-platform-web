import {
  normalizeRecipeReferenceFiles,
  recipeStepLabels,
  standingInstructionsBlock,
} from '@/lib/recipe-instructions';

describe('recipe standing instructions', () => {
  it('keeps labelled reference files only', () => {
    expect(normalizeRecipeReferenceFiles('nope')).toEqual([]);
    expect(
      normalizeRecipeReferenceFiles([
        { label: ' Brand voice ', filename: 'voice.pdf' },
        { filename: 'prior.xlsx' },
        { note: 'orphan' },
      ])
    ).toEqual([
      { label: 'Brand voice', filename: 'voice.pdf' },
      { label: 'prior.xlsx', filename: 'prior.xlsx' },
    ]);
  });

  it('builds a standing-instructions block for leads and reports', () => {
    expect(standingInstructionsBlock(null)).toBe('');
    expect(
      standingInstructionsBlock({
        when_to_use: 'Every lead',
        instructions: 'Sentence case titles. Cite tables, not codes.',
        reference_files: [{ label: 'Brand voice' }],
      })
    ).toBe(
      [
        'When to use: Every lead',
        'Sentence case titles. Cite tables, not codes.',
        'Reference files: Brand voice.',
      ].join('\n\n')
    );
  });

  it('labels recipe steps for the editor without codes', () => {
    expect(recipeStepLabels(null)).toEqual([]);
    expect(
      recipeStepLabels([
        { op: 'import', role: 'survey' },
        { op: 'weight', method: 'rake' },
        { op: 'analysis', analysis_type: 'frequencies' },
        { op: 'analysis', analysis_type: 'banner_table', title: 'Awareness funnel by region' },
      ])
    ).toEqual(['Weight to targets', 'Frequencies', 'Awareness funnel by region']);
  });
});
