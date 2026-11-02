/** Output panel text for a finished chat turn: title, takeaway, and the base note. */

type ToolResult = {
  name?: string;
  args?: Record<string, unknown>;
  result?: Record<string, unknown>;
};

const BASE_SENTENCE =
  /^(the weighted base for this table is|minimum base|no column is under that base|a column is under that base|base:|unweighted, n =|base \d)/i;
const FILE_LINE = /^(excel workbook|spss syntax|r syntax):/i;

function proseLines(answer: string): string[] {
  return answer
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('|'))
    .map(line =>
      line
        .replace(/^#+\s*/, '')
        .replace(/^[-*•]\s+/, '')
        .replace(/[*`]/g, '')
        .trim()
    )
    .filter(Boolean);
}

function sentences(line: string): string[] {
  return line
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map(part => part.trim())
    .filter(Boolean);
}

function isBaseSentence(sentence: string): boolean {
  return BASE_SENTENCE.test(sentence);
}

/** The table title the API put on the result, or the first prose line that is not the base. */
export function outputTitle(results: ToolResult[] | undefined, answer: string): string {
  for (const item of results || []) {
    const result = item.result || {};
    const nested =
      result.result && typeof result.result === 'object'
        ? (result.result as Record<string, unknown>)
        : {};
    const title = result.title ?? nested.title;
    if (typeof title === 'string' && title.trim()) return title.trim();
  }
  const lines = proseLines(answer).filter(line => !FILE_LINE.test(line));
  for (const line of lines) {
    const first = sentences(line).find(sentence => !isBaseSentence(sentence));
    if (first) return first.length > 90 ? `${first.slice(0, 89).trimEnd()}…` : first;
  }
  return 'Result';
}

/** The first prose sentence that is not the base or a file line. */
export function outputTakeaway(answer: string): string {
  for (const line of proseLines(answer)) {
    if (FILE_LINE.test(line)) continue;
    const kept = sentences(line).filter(sentence => !isBaseSentence(sentence));
    if (kept.length) return kept.join(' ');
  }
  return '';
}

/** Base sentences, each once, for the small note under the takeaway. */
export function outputBaseNote(answer: string): string {
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const line of proseLines(answer)) {
    for (const sentence of sentences(line)) {
      if (!isBaseSentence(sentence) || /^base \d/i.test(sentence)) continue;
      const clean = sentence.replace(/\.{2,}$/, '.');
      const key = clean.replace(/[.\s]+$/, '').toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      kept.push(clean);
    }
  }
  return kept.join(' ');
}
