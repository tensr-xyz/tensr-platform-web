/** Launch feature gates — set env vars to enable pre-release capabilities. */

/** Legacy zip projects with multiple importable files. Off at launch; use datasets. */
export const MULTI_FILE_PROJECTS_ENABLED =
  process.env.NEXT_PUBLIC_MULTI_FILE_PROJECTS_ENABLED === 'true';

/** Choice modelling is on for production, dev, and localhost.

NEXT_PUBLIC_CHOICE_MODELLING_ENABLED=false hides it. That value is fixed at build time.
 */
export const CHOICE_MODELLING_MENU_NAMES: ReadonlySet<string> = new Set([
  'Conjoint (CBC)',
  'MaxDiff',
  'MaxDiff (counting / MNL)',
  'Conjoint (MNL)',
  'MaxDiff (Count)',
  'MaxDiff (MNL)',
  'MaxDiff (individual utilities)',
  'Conjoint (individual utilities)',
  'Choice Simulator',
]);

export function choiceModellingEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CHOICE_MODELLING_ENABLED !== 'false';
}
