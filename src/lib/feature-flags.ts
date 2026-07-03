/** Launch feature gates — set env vars to enable pre-release capabilities. */

export const FEATURE_FLAGS = {
  /** Dedicated Charts workspace tab (off at launch). */
  CHARTS_TAB_ENABLED: process.env.NEXT_PUBLIC_CHARTS_TAB_ENABLED === 'true',
} as const;

/** Legacy zip projects with multiple importable files. Off at launch; use datasets. */
export const MULTI_FILE_PROJECTS_ENABLED =
  process.env.NEXT_PUBLIC_MULTI_FILE_PROJECTS_ENABLED === 'true';
