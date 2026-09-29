const OBVIOUS_ID_NAMES = [
  'id',
  'respondent_id',
  'respondentid',
  'resp_id',
  'respid',
  'case_id',
  'caseid',
  'uuid',
  'pid',
  'person_id',
] as const;

/** Shared column that looks like a respondent key, else null. */
export function pickObviousIdColumn(names: string[]): string | null {
  const byLower = new Map(names.map(name => [name.toLowerCase(), name]));
  for (const key of OBVIOUS_ID_NAMES) {
    const hit = byLower.get(key);
    if (hit) return hit;
  }
  return null;
}
