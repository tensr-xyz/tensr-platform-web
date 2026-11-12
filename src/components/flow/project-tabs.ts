/** Project tabs. Details is not one of them; an old /details link opens Chat. */
export const PROJECT_TABS = [
  ['chat', 'Chat'],
  ['sources', 'Sources'],
  ['responses', 'Responses'],
  ['tables', 'Tables'],
  ['report', 'Report'],
] as const;

export function visibleProjectSection(section: string): string {
  return section === 'details' ? 'chat' : section;
}

export function projectSectionPath(projectId: string, section: string): string {
  return `/flow/p/${projectId}/${visibleProjectSection(section)}`;
}
