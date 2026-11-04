/** Pure helpers for the uncoded-answer review queue (Paper 4h). */

export type FrameCode = {
  id: string;
  label: string;
  definition: string;
  keywords: string[];
  examples: string[];
};

export type ReviewRow = {
  /** Row position in the coded file. Overrides on /open-end/apply are keyed by it. */
  row: number;
  respondentId: string | null;
  text: string;
  suggested: string[];
  confidence: number | null;
};

export type PreviewPage = {
  variable_names?: string[];
  rows?: unknown[][];
  offset?: number;
  n_rows?: number;
  n_rows_matched?: number;
  truncated?: boolean;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(item => String(item)).filter(Boolean) : [];
}

/** The saved code frame for a coded column, else its value labels. */
export function frameCodes(columnMeta: unknown): FrameCode[] {
  const meta = asRecord(columnMeta);
  if (!meta) return [];
  const frame = meta.codeframe;
  const rawCodes = Array.isArray(frame) ? frame : asRecord(frame)?.codes;
  const codes: FrameCode[] = [];
  if (Array.isArray(rawCodes)) {
    for (const raw of rawCodes) {
      const code = asRecord(raw);
      if (!code || code.id == null) continue;
      const id = String(code.id);
      const label = String(code.label || id);
      codes.push({
        id,
        label,
        definition: String(code.definition || ''),
        keywords: strings(code.keywords),
        examples: strings(code.examples),
      });
    }
  }
  if (codes.length) return codes;
  const labels = asRecord(meta.value_labels);
  if (!labels) return [];
  return Object.entries(labels).map(([id, label]) => ({
    id,
    label: String(label || id),
    definition: '',
    keywords: [],
    examples: [],
  }));
}

/** The apply route needs at least one keyword per code. */
export function codesForApply(codes: FrameCode[]): FrameCode[] {
  return codes.map(code => ({
    ...code,
    keywords: code.keywords.length ? code.keywords : [code.label],
  }));
}

export function newCodeId(label: string, existing: string[]): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'theme';
  const taken = new Set(existing);
  if (!taken.has(base)) return base;
  let index = 2;
  while (taken.has(`${base}_${index}`)) index += 1;
  return `${base}_${index}`;
}

function provenance(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'string') {
    try {
      return asRecord(JSON.parse(raw)) || {};
    } catch {
      return {};
    }
  }
  return asRecord(raw) || {};
}

/**
 * Text that is not an answer. The same list the API uses for the theme base
 * (app/non_answers.py), so the review queue, the "not yet coded" count and the table agree.
 */
const NOT_AN_ANSWER = new Set([
  '',
  'nan',
  'null',
  '<na>',
  'na',
  'n a',
  'n/a',
  'not applicable',
  'none',
  'none really',
  'nil',
  'nothing',
  'nothing to add',
  'nothing else',
  'nothing more',
  'nothing more to add',
  'nothing else to add',
  'nothing to say',
  'nothing really',
  'nothing in particular',
  'nothing at all',
  'no comment',
  'no comments',
  'no further comments',
  'no other comments',
  'no answer',
  'blank',
  '(blank)',
  '-',
  '--',
  '.',
]);

function normalized(text: string): string {
  const flat = text
    .replace(/\u2019/g, "'")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  if (NOT_AN_ANSWER.has(flat)) return flat;
  return flat.replace(/^[\s.,!?\-"'`]+|[\s.,!?\-"'`]+$/g, '');
}

export function isAnswer(text: string): boolean {
  return !NOT_AN_ANSWER.has(normalized(String(text ?? '')));
}

/** A theme that only names a non-answer ("No comment", "N/A"). Non-answers are out of the base, so not a theme. */
export function isNonAnswerTheme(label: string | undefined, id?: string): boolean {
  return [label, id]
    .map(name => String(name || '').replace(/_/g, ' '))
    .some(name => name.trim() !== '' && !isAnswer(name));
}

/** Uncoded answers from a preview page filtered to code column = "uncoded". */
export function reviewRowsFromPreview(
  page: PreviewPage,
  textColumn: string,
  codeColumn: string
): ReviewRow[] {
  const names = page.variable_names || [];
  const textAt = names.indexOf(textColumn);
  const provAt = names.indexOf(
    codeColumn.endsWith('_codes') ? `${codeColumn.slice(0, -6)}_coding` : `${codeColumn}_coding`
  );
  const respondentAt = names.indexOf('respondent_id');
  const out: ReviewRow[] = [];
  for (const cells of page.rows || []) {
    const prov = provAt >= 0 ? provenance(cells[provAt]) : {};
    const row = typeof prov.row === 'number' ? prov.row : Number.NaN;
    // Without the row position the answer cannot be saved back, so it is not offered.
    if (!Number.isInteger(row) || row < 0) continue;
    const respondent =
      respondentAt >= 0 && cells[respondentAt] != null
        ? String(cells[respondentAt])
        : prov.respondent_id != null
          ? String(prov.respondent_id)
          : null;
    const confidence = typeof prov.confidence === 'number' ? prov.confidence : null;
    const text = textAt >= 0 && cells[textAt] != null ? String(cells[textAt]).trim() : '';
    // A blank or "no comment" has nothing to code; it is not in the queue or the count.
    if (!isAnswer(text)) continue;
    out.push({
      row,
      respondentId: respondent,
      text,
      suggested: strings(prov.suggested_codes),
      confidence,
    });
  }
  return out;
}

/** A model match that fell under the bar to apply on its own. */
export function isLowConfidence(row: ReviewRow): boolean {
  return row.suggested.length > 0 && row.confidence != null;
}

export function splitCodeCell(cell: unknown): string[] {
  if (cell == null) return [];
  return String(cell)
    .split('|')
    .map(part => part.trim())
    .filter(part => part && part !== 'uncoded');
}

/**
 * Overrides for every row, so re-applying the frame keeps each existing code and
 * only changes the answers reviewed here.
 */
export function buildOverrides(
  cells: unknown[],
  edits: Record<number, string[]>
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  cells.forEach((cell, index) => {
    out[String(index)] = edits[index] ? [...edits[index]] : splitCodeCell(cell);
  });
  for (const [key, codes] of Object.entries(edits)) {
    if (!(key in out)) out[key] = [...codes];
  }
  return out;
}

export function respondentLabel(row: ReviewRow): string {
  return row.respondentId ? `Respondent ${row.respondentId}` : `Row ${row.row + 1}`;
}

/** How many uncoded answers are left: the queue itself, or the server's count less the non-answers seen. */
export function uncodedTotal(page: PreviewPage, queueLength: number): number {
  const seen = (page.rows || []).length;
  if (!page.truncated || page.n_rows_matched == null) return queueLength;
  return Math.max(queueLength, Number(page.n_rows_matched) - (seen - queueLength));
}
