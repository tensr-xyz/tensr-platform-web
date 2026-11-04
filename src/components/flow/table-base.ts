/** Shared table base copy so the pane and the agent read the same book fields. */

export type TableBaseBook = {
  base_label?: string | null;
  answered_n?: number | null;
  respondent_n?: number | null;
  weight?: {
    weight_aware?: boolean;
    weighted_n?: number | null;
    unweighted_n?: number | null;
  } | null;
};

function formatBase(value: number): string {
  return Number.isInteger(value)
    ? value.toLocaleString('en-GB')
    : value.toLocaleString('en-GB', { maximumFractionDigits: 1 });
}

/** Title line and footer from the book the engine already computed. */
export function tableBaseCopy(book: TableBaseBook | null | undefined): {
  line: string;
  foot: string;
} {
  if (!book) return { line: '', foot: '' };
  const weight = book.weight;
  const label = String(book.base_label || '').trim();
  if (label) {
    const line = /^base\b/i.test(label) ? `Base: ${label}` : label;
    if (weight?.weight_aware && weight.weighted_n != null && weight.unweighted_n != null) {
      return {
        line,
        foot: `${formatBase(Number(weight.weighted_n))} weighted (${formatBase(Number(weight.unweighted_n))} unweighted)`,
      };
    }
    if (book.respondent_n != null) {
      return { line, foot: `${formatBase(Number(book.respondent_n))} respondents` };
    }
    return { line, foot: label };
  }
  if (book.answered_n != null && book.respondent_n != null) {
    return {
      line: `Base: answered ${String(book.answered_n)} of ${String(book.respondent_n)}`,
      foot: `${formatBase(Number(book.respondent_n))} respondents`,
    };
  }
  if (weight?.weight_aware && weight.weighted_n != null && weight.unweighted_n != null) {
    const shown = formatBase(Number(weight.weighted_n));
    const unweighted = formatBase(Number(weight.unweighted_n));
    return {
      line: `Base: base ${shown} weighted (unweighted ${unweighted})`,
      foot: `${shown} weighted (${unweighted} unweighted)`,
    };
  }
  if (book.respondent_n != null) {
    return {
      line: `Base: all respondents (${formatBase(Number(book.respondent_n))})`,
      foot: `${formatBase(Number(book.respondent_n))} respondents`,
    };
  }
  return { line: '', foot: '' };
}
