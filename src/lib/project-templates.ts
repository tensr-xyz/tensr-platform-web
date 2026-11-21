/** TEN-196 / Paper 10e — start a project from a blank, a copied setup, or a team template. */

export type ProjectStartKind = 'blank' | 'project' | 'template';

export type ProjectStartOption = {
  id?: string;
  kind: ProjectStartKind;
  title: string;
  blurb: string;
  name?: string;
  recipe_count?: number;
  has_report_layout?: boolean;
  updated_at?: string | null;
};

export type ProjectStartOptions = {
  blank: ProjectStartOption;
  projects: ProjectStartOption[];
  templates: ProjectStartOption[];
  then_note: string;
};

export const DEFAULT_THEN_NOTE =
  "Upload the new wave. Tensr matches questions by name and label and shows anything it couldn't match before running.";

export const BLANK_START_OPTION: ProjectStartOption = {
  kind: 'blank',
  title: 'Blank project',
  blurb: 'Upload data and start from scratch',
};

export function flattenStartOptions(
  page: Partial<ProjectStartOptions> | null | undefined
): ProjectStartOption[] {
  const blank = page?.blank || BLANK_START_OPTION;
  const projects = Array.isArray(page?.projects) ? page!.projects! : [];
  const templates = Array.isArray(page?.templates) ? page!.templates! : [];
  return [blank, ...projects, ...templates];
}

export function startSelectionKey(option: ProjectStartOption): string {
  if (option.kind === 'blank') return 'blank';
  return `${option.kind}:${option.id || ''}`;
}

export function parseStartSelection(key: string): {
  source_kind: ProjectStartKind;
  source_id: string | null;
} {
  if (!key || key === 'blank') return { source_kind: 'blank', source_id: null };
  const cut = key.indexOf(':');
  if (cut <= 0) return { source_kind: 'blank', source_id: null };
  const kind = key.slice(0, cut);
  const id = key.slice(cut + 1).trim();
  if (kind === 'project' || kind === 'template') {
    return { source_kind: kind, source_id: id || null };
  }
  return { source_kind: 'blank', source_id: null };
}

export function thenNoteForSelection(key: string, note: string | null | undefined): string | null {
  const { source_kind } = parseStartSelection(key);
  if (source_kind === 'blank') return null;
  return (note || DEFAULT_THEN_NOTE).trim() || DEFAULT_THEN_NOTE;
}

export function defaultTemplateName(projectName: string | null | undefined): string {
  const base = (projectName || '').trim() || 'Project';
  return `${base} template`;
}
