export type AudienceCombine = 'and' | 'or';

export type AudienceCondition = {
  column: string;
  op: string;
  value: string;
  exclude: boolean;
};

/** The filter the audience API stores. An excluded condition is a not group. */
export function audienceFilter(combine: AudienceCombine, conditions: AudienceCondition[]) {
  const filters = conditions
    .filter(condition => condition.column.trim() && String(condition.value).trim())
    .map(condition => {
      const clause = {
        column: condition.column.trim(),
        op: condition.op.trim() || '=',
        value: String(condition.value).trim(),
      };
      if (!condition.exclude) return clause;
      return { op: 'not' as const, combine: 'and' as const, filters: [clause] };
    });
  return { combine, filters };
}
