/** Launch feature gates — set env vars to enable pre-release capabilities. */

/** Legacy zip projects with multiple importable files. Off at launch; use datasets. */
export const MULTI_FILE_PROJECTS_ENABLED =
  process.env.NEXT_PUBLIC_MULTI_FILE_PROJECTS_ENABLED === 'true';
