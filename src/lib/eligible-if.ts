/** eligible_if text in the variable view: "owns_A=1 & source_wave=FR". */

export type EligibleClause = {
  column: string;
  op: string;
  value: string;
};

const CLAUSE = /^([A-Za-z_][A-Za-z0-9_]*)\s*(==|!=|=|>=|<=|>|<|in)\s*(.+)$/;

export function parseEligibleIf(text: string): EligibleClause[] {
  const clauses: EligibleClause[] = [];
  for (const part of text.split('&')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const match = CLAUSE.exec(trimmed);
    if (!match) continue;
    const op = match[2] === '==' ? '=' : match[2];
    clauses.push({ column: match[1], op, value: match[3].trim() });
  }
  return clauses;
}

export function formatEligibleIf(clauses: EligibleClause[] | null | undefined): string {
  if (!clauses?.length) return '';
  return clauses.map(clause => `${clause.column}${clause.op}${clause.value}`).join(' & ');
}
