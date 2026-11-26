import {
  BLANK_START_OPTION,
  copySetupDisclosureLabel,
  defaultTemplateName,
  flattenStartOptions,
  parseStartSelection,
  partitionStartOptions,
  startSelectionKey,
  thenNoteForSelection,
} from './project-templates';

describe('project start-from options (TEN-196)', () => {
  it('flattens blank, copy-setup projects and team templates', () => {
    const rows = flattenStartOptions({
      blank: BLANK_START_OPTION,
      projects: [
        {
          id: 'p1',
          kind: 'project',
          title: 'Brand tracker W4 (copy setup)',
          blurb:
            'Keeps weights, derived questions, banners, recipes and report layout. Leaves data behind.',
        },
      ],
      templates: [
        {
          id: 't1',
          kind: 'template',
          title: 'Team template · Ad-hoc U&A study',
          blurb: 'Saved by your team · 3 recipes · house report style',
        },
      ],
      then_note: 'Upload the new wave.',
    });
    expect(rows).toHaveLength(3);
    expect(rows[0].title).toBe('Blank project');
    expect(rows[1].title).toContain('copy setup');
    expect(rows[2].title).toContain('Team template');
  });

  it('round-trips the selected start key', () => {
    expect(startSelectionKey(BLANK_START_OPTION)).toBe('blank');
    expect(
      startSelectionKey({
        id: 'p1',
        kind: 'project',
        title: 'A',
        blurb: 'B',
      })
    ).toBe('project:p1');
    expect(parseStartSelection('blank')).toEqual({ source_kind: 'blank', source_id: null });
    expect(parseStartSelection('template:t9')).toEqual({
      source_kind: 'template',
      source_id: 't9',
    });
  });

  it('shows the then-note only when copying a setup', () => {
    expect(thenNoteForSelection('blank', 'Upload the new wave.')).toBeNull();
    expect(thenNoteForSelection('project:p1', 'Upload the new wave.')).toBe('Upload the new wave.');
  });

  it('names a saved template from the project label', () => {
    expect(defaultTemplateName('Brand tracker W4')).toBe('Brand tracker W4 template');
    expect(defaultTemplateName('')).toBe('Project template');
  });

  it('partitions blank, copy-setup projects and templates for the capped dialog', () => {
    const projects = Array.from({ length: 15 }, (_, i) => ({
      id: `p${i + 1}`,
      kind: 'project' as const,
      title: `Study ${i + 1} (copy setup)`,
      blurb: 'Keeps setup. Leaves data behind.',
    }));
    const rows = flattenStartOptions({
      blank: BLANK_START_OPTION,
      projects,
      templates: [
        {
          id: 't1',
          kind: 'template',
          title: 'Team template · Ad-hoc',
          blurb: 'Saved by your team',
        },
      ],
      then_note: 'Upload the new wave.',
    });
    const parts = partitionStartOptions(rows);
    expect(parts.blank.title).toBe('Blank project');
    expect(parts.projects).toHaveLength(15);
    expect(parts.templates).toHaveLength(1);
    expect(copySetupDisclosureLabel(15, false)).toBe('15 projects · ▾');
    expect(copySetupDisclosureLabel(1, true)).toBe('1 project · ▴');
  });
});
