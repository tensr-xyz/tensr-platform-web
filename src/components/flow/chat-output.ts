/** Output panel text for a finished chat turn: title, takeaway, and the base note. */

type ToolResult = {
  name?: string;
  procedure?: string;
  analysis_type?: string;
  request_body?: Record<string, unknown> | null;
  summary?: Record<string, unknown> | null;
  args?: Record<string, unknown>;
  result?: Record<string, unknown>;
};

const KIND_LABELS: Record<string, string> = {
  anova_oneway: 'ANOVA',
  banner_table: 'Crosstab',
  chi_square: 'Chi-square',
  descriptives: 'Descriptives',
  frequencies: 'Frequencies',
  ttest_independent: 't-test',
  ttest_paired: 'Paired t-test',
  linear_regression: 'Regression',
  logistic_regression: 'Logistic regression',
  correlation: 'Correlation',
  drivers: 'Drivers',
  export_set: 'Export',
};

function procedureOf(item: ToolResult): string {
  const args = item.args || {};
  const nested = item.result || {};
  const value = item.analysis_type || item.procedure || args.analysis_type || nested.analysis_type;
  return typeof value === 'string' ? value : '';
}

function bodyOf(item: ToolResult): Record<string, unknown> {
  const args = item.args || {};
  const body = item.request_body || (args.request_body as Record<string, unknown> | undefined);
  return body && typeof body === 'object' ? body : {};
}

function summaryOf(item: ToolResult): Record<string, unknown> {
  const nested = item.result || {};
  const summary = item.summary || (nested.summary as Record<string, unknown> | undefined);
  return summary && typeof summary === 'object' ? summary : {};
}

function analysisItems(results: ToolResult[] | undefined): ToolResult[] {
  return (results || []).filter(item => {
    const procedure = procedureOf(item);
    return procedure && !['finish', 'count', 'export_set'].includes(procedure);
  });
}

/** The analysis kind for the badge: ANOVA, Crosstab, and so on. */
export function outputKind(results: ToolResult[] | undefined): string {
  const procedure = procedureOf(analysisItems(results)[0] || {});
  if (!procedure) return 'Output';
  return KIND_LABELS[procedure] || procedure.replaceAll('_', ' ');
}

/** The statistic line from the result, else the one sentence of the answer that carries it. */
export function outputStat(results: ToolResult[] | undefined, answer: string, skip = ''): string {
  for (const item of analysisItems(results)) {
    const statistic = summaryOf(item).statistic;
    if (typeof statistic === 'string' && statistic.trim()) return statistic.trim();
  }
  for (const line of proseLines(answer)) {
    const hit = sentences(line).find(
      sentence =>
        !skip.includes(sentence) &&
        /\bp\s*[<=>]|p-value|F\s*\(|χ²|chi-square|η²|eta/i.test(sentence)
    );
    if (hit) return hit;
  }
  return '';
}

function first(body: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = body[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  }
  return '';
}

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
  for (const item of analysisItems(results)) {
    const result = item.result || {};
    const nested =
      result.result && typeof result.result === 'object'
        ? (result.result as Record<string, unknown>)
        : {};
    const title = summaryOf(item).title ?? result.title ?? nested.title;
    if (typeof title === 'string' && title.trim()) return title.trim();
    const body = bodyOf(item);
    const measure = first(body, [
      'value_column',
      'stub_column',
      'stub_columns',
      'column',
      'columns',
      'dependent',
      'outcome',
    ]);
    const group = first(body, ['group_column', 'banner_column', 'factor', 'by']);
    if (measure && group) return `${measure} by ${group}`;
    if (measure) return measure;
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
    if (kept.length) return kept[0];
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

/** The thread copy of the answer: the base sentences move to the panel note. Tables stay. */
export function answerWithoutBase(answer: string): string {
  const kept: string[] = [];
  for (const line of answer.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('|')) {
      kept.push(line);
      continue;
    }
    const rest = sentences(trimmed).filter(sentence => !isBaseSentence(sentence));
    if (rest.length) kept.push(rest.join(' '));
  }
  return kept
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Plain lines written one under another stay on separate lines when rendered. */
export function keepLineBreaks(text: string): string {
  const lines = text.split('\n');
  const out: string[] = [];
  let fenced = false;
  const plain = (line: string) => {
    const trimmed = line.trim();
    return Boolean(trimmed) && !/^(\||[-*+]\s|\d+[.)]\s|#|>)/.test(trimmed);
  };
  lines.forEach((line, index) => {
    if (line.trim().startsWith('```')) fenced = !fenced;
    out.push(line);
    const next = lines[index + 1];
    if (!fenced && next !== undefined && plain(line) && plain(next)) out.push('');
  });
  return out.join('\n');
}

/** Saved run ids on this turn, for the server exports. */
export function outputRunIds(results: ToolResult[] | undefined): string[] {
  return analysisItems(results)
    .map(item => {
      const nested = item.result || {};
      const value = (item as { run_id?: unknown }).run_id ?? nested.run_id;
      return typeof value === 'string' ? value : '';
    })
    .filter(Boolean);
}

/** Method checks the engine ran, as short chips. A failed check is a warning. */
export function outputChecks(
  results: ToolResult[] | undefined
): { label: string; warn: boolean }[] {
  const checks: { label: string; warn: boolean }[] = [];
  for (const item of analysisItems(results)) {
    const records = summaryOf(item).preconditions;
    if (!Array.isArray(records)) continue;
    for (const record of records as Record<string, unknown>[]) {
      const name = String(record?.name || '').replaceAll('_', ' ');
      const status = String(record?.status || '');
      if (!name || status === 'skipped') continue;
      const message = String(record?.message || '').trim();
      const warn = status === 'failed' || status === 'warning';
      const label =
        message && message.length <= 44
          ? message.replace(/\.$/, '')
          : `${name[0].toUpperCase()}${name.slice(1)} ${warn ? 'failed' : 'passed'}`;
      if (!checks.some(check => check.label === label)) checks.push({ label, warn });
    }
  }
  return checks;
}
