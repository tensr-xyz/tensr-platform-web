/** Project tabs. Details is where the study brief and saved audiences live. */
export const PROJECT_TABS = [
  ['chat', 'Chat'],
  ['sources', 'Sources'],
  ['details', 'Details'],
  ['responses', 'Responses'],
  ['tables', 'Tables'],
  ['report', 'Report'],
] as const;

export function visibleProjectSection(section: string): string {
  return section;
}

export function projectSectionPath(projectId: string, section: string): string {
  return `/flow/p/${projectId}/${visibleProjectSection(section)}`;
}
