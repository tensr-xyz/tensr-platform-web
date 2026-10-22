/** Launch feature gates — set env vars to enable pre-release capabilities. */

/** Legacy zip projects with multiple importable files. Off at launch; use datasets. */
export const MULTI_FILE_PROJECTS_ENABLED =
  process.env.NEXT_PUBLIC_MULTI_FILE_PROJECTS_ENABLED === 'true';

/** Choice modelling stays off the production app until it passes QA. On for dev and localhost.

The gate is the Vercel build: next.config bakes NEXT_PUBLIC_VERCEL_ENV from VERCEL_ENV.
A production Vercel build is off. Localhost and preview builds are on.
NEXT_PUBLIC_CHOICE_MODELLING_ENABLED overrides that, and it is also fixed at build time.
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
  const flag = process.env.NEXT_PUBLIC_CHOICE_MODELLING_ENABLED;
  if (flag === 'false') return false;
  if (flag === 'true') return true;
  return process.env.NEXT_PUBLIC_VERCEL_ENV !== 'production';
}
