/** Detect the Asker "not in this data" refusal (Paper 7a / FT checklist). */

export function answerIsNotInData(answer: string | undefined | null): boolean {
  const text = String(answer || '')
    .trim()
    .toLowerCase();
  if (!text) return false;
  return text.startsWith('not in this data') || text.startsWith('that is not in this data');
}

/** Drop the lead phrase so the callout can show the reason on its own. */
export function stripNotInDataLead(answer: string): string {
  return String(answer || '').replace(/^(that is )?not in this data\.?\s*/i, '');
}
