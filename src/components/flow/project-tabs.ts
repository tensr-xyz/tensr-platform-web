/** Project tabs. Details is where the study brief and saved audiences live. */
export const PROJECT_TABS = [
  ['chat', 'Chat'],
  ['sources', 'Sources'],
  ['details', 'Details'],
  ['responses', 'Responses'],
  ['tables', 'Tables'],
  ['report', 'Report'],
  ['asker-questions', 'Asker questions'],
] as const;

export type ProjectTabKey = (typeof PROJECT_TABS)[number][0];

const TAB_KEYS = new Set<string>(PROJECT_TABS.map(([key]) => key));

/** Askers only see the ask workspace (Chat). Owners/editors also get Asker questions. */
export function tabsForRole(
  role: string | null | undefined
): readonly (typeof PROJECT_TABS)[number][] {
  if (role === 'asker') {
    return PROJECT_TABS.filter(([key]) => key === 'chat');
  }
  return PROJECT_TABS;
}

export function isProjectTabKey(section: string): section is ProjectTabKey {
  return TAB_KEYS.has(section);
}

/** Keep a visited tab mounted so switching back paints instantly (no remount spinner). */
export function markVisitedProjectTab(visited: ReadonlySet<string>, section: string): Set<string> {
  if (!isProjectTabKey(section)) return visited as Set<string>;
  if (visited.has(section)) return visited as Set<string>;
  return new Set(visited).add(section);
}

export function visibleProjectSection(section: string): string {
  return section;
}

export function projectSectionPath(projectId: string, section: string): string {
  return `/flow/p/${projectId}/${visibleProjectSection(section)}`;
}
