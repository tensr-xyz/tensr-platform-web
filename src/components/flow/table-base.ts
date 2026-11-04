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
  const whole = Math.round(value);
  if (Math.abs(value - whole) < 1e-6) return whole.toLocaleString('en-GB');
  return value.toLocaleString('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** "Base: …" once. A label that already starts with base is not prefixed again. */
export function baseLineFromLabel(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return '';
  if (/^base\s*:/i.test(trimmed)) return `Base:${trimmed.replace(/^base\s*:/i, '')}`;
  if (/^base\b/i.test(trimmed)) return `Base: ${trimmed.replace(/^base\s+/i, '')}`;
  return trimmed;
}

/** Footer figures from the engine's base_label when it carries the table base. */
export function footFromBaseLabel(label: string): string {
  const weighted = label.match(/([\d,.]+)\s*weighted\s*\(\s*unweighted\s*([\d,.]+)\s*\)/i);
  if (weighted) {
    return `${weighted[1]} weighted (${weighted[2]} unweighted)`;
  }
  const unweighted = label.match(/Unweighted,\s*n\s*=\s*([\d,.]+)/i);
  if (unweighted) {
    return `${unweighted[1]} respondents`;
  }
  return '';
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
    const line = baseLineFromLabel(label);
    const fromLabel = footFromBaseLabel(label);
    if (fromLabel) return { line, foot: fromLabel };
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
      line: `Base: ${shown} weighted (unweighted ${unweighted})`,
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
