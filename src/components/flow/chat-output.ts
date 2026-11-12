/** Output panel text for a finished chat turn: title, takeaway, and the base note. */

import { analysisDisplayName } from '@/lib/analysis-definitions';

type ToolResult = {
  name?: string;
  ok?: boolean;
  error?: unknown;
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
  nps: 'NPS',
  funnel: 'Funnel',
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

function hasFrequencyTable(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.frequency_tables)) return true;
  if (Array.isArray(record.table)) {
    return record.table.some(row => {
      if (!row || typeof row !== 'object') return false;
      const item = row as Record<string, unknown>;
      return 'frequency' in item || Array.isArray(item.rows);
    });
  }
  const nested = record.result;
  return Boolean(nested && typeof nested === 'object' && hasFrequencyTable(nested));
}

function isFrequencyResult(item: ToolResult): boolean {
  if (procedureOf(item) === 'frequencies') return true;
  const summary = summaryOf(item);
  const text = `${summary.title || ''} ${summary.line || ''}`;
  if (/\bfrequency table\b/i.test(text)) return true;
  return hasFrequencyTable(summary) || hasFrequencyTable(item.result);
}

/** The analysis kind for the badge: ANOVA, Crosstab, and so on. */
export function outputKind(results: ToolResult[] | undefined): string {
  const items = analysisItems(results);
  if (items.some(isFrequencyResult)) return 'Frequencies';
  const procedure = procedureOf(items[0] || {});
  if (!procedure) return 'Output';
  return KIND_LABELS[procedure] || analysisDisplayName(procedure);
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
  /^(the weighted base for this table is|minimum base|no column is under that base|a column is under that base|base:|unweighted, n =|base \d|(un)?weighted\.?$)/i;
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

function questionFromFrequency(text: string): string {
  const match = text.match(/frequency table(?: for)?:\s*(.+)/i);
  if (!match) return '';
  return match[1].replace(/\.\s*$/, '').trim();
}

function questionFromTableTitle(text: string): string {
  return text
    .replace(/^frequency table:\s*/i, '')
    .replace(/\.\s*$/, '')
    .trim();
}

function isQuestion(text: string): boolean {
  return text.includes(' ');
}

/** A long statement is the lead. The card title is a short name. */
function isLeadSentence(text: string): boolean {
  return text.trim().split(/\s+/).filter(Boolean).length > 14;
}

/** The question on the column this result is about, when the title is only an answer such as Yes. */
function questionFromBody(
  body: Record<string, unknown> | undefined,
  columns: QuestionLabel[]
): string {
  const measure = first(body || {}, [
    'column',
    'columns',
    'value_column',
    'stub_column',
    'stub_columns',
    'dependent',
    'outcome',
    'score_column',
  ]);
  if (!measure) return '';
  const shown = titledWithQuestion(measure, columns);
  return isQuestion(shown) ? shown : '';
}

/** Question labels on the frequency tables, in order. A variable code such as Q5 is not a question. */
function frequencyQuestions(results: ToolResult[] | undefined): string[] {
  const found: string[] = [];
  const push = (text: string) => {
    const question = questionFromTableTitle(text);
    if (question && isQuestion(question) && !found.includes(question)) found.push(question);
  };
  for (const item of analysisItems(results)) {
    const summary = summaryOf(item);
    const table = summary.table;
    if (Array.isArray(table)) {
      for (const block of table) {
        if (!block || typeof block !== 'object') continue;
        const title = (block as { title?: unknown }).title;
        if (typeof title === 'string') push(title);
      }
    }
    for (const layer of [item.result, summary]) {
      if (!layer || typeof layer !== 'object') continue;
      const tables = (layer as { frequency_tables?: unknown }).frequency_tables;
      const nested = (layer as { result?: { frequency_tables?: unknown } }).result;
      const lists = [tables, nested?.frequency_tables];
      for (const list of lists) {
        if (!Array.isArray(list)) continue;
        for (const block of list) {
          if (!block || typeof block !== 'object') continue;
          const title = (block as { title?: unknown }).title;
          if (typeof title === 'string') push(title);
        }
      }
    }
    for (const key of ['title', 'line'] as const) {
      const text = summary[key];
      if (typeof text !== 'string') continue;
      const question = questionFromFrequency(text);
      if (question && !found.some(existing => question.includes(existing))) push(question);
    }
  }
  return found;
}

export type QuestionLabel = { name: string; label?: string | null };

/** A column code becomes its question when the file has a label for it. */
export function titledWithQuestion(title: string, columns: QuestionLabel[] = []): string {
  const stripped = title.replace(/^frequency table:\s*/i, '').trim();
  const key = stripped.replace(/\.\s*$/, '').toLowerCase();
  const meta = columns.find(column => column.name.trim().toLowerCase() === key);
  const label = (meta?.label || '').trim();
  if (label && label.toLowerCase() !== key) return label;
  return stripped || title;
}

/** The table title the API put on the result, or the first prose line that is not the base. */
export function outputTitle(
  results: ToolResult[] | undefined,
  answer: string,
  columns: QuestionLabel[] = []
): string {
  const questions = frequencyQuestions(results).map(question =>
    titledWithQuestion(question, columns)
  );
  if (questions.length) return questions.join(', ');
  const items = analysisItems(results);
  for (const item of items) {
    const result = item.result || {};
    const nested =
      result.result && typeof result.result === 'object'
        ? (result.result as Record<string, unknown>)
        : {};
    const title = summaryOf(item).title ?? result.title ?? nested.title;
    if (typeof title === 'string' && title.trim() && !isLeadSentence(title)) {
      const shown = titledWithQuestion(title, columns);
      if (isQuestion(shown)) return shown;
      const fromColumn = questionFromBody(bodyOf(item), columns);
      if (fromColumn) return fromColumn;
      if (shown.trim()) return shown;
    }
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
    if (measure && group) {
      return `${titledWithQuestion(measure, columns)} by ${titledWithQuestion(group, columns)}`;
    }
    if (measure) return titledWithQuestion(measure, columns);
  }
  const procedure = procedureOf(items[0] || {});
  if (procedure && (KIND_LABELS[procedure] || analysisDisplayName(procedure))) {
    return KIND_LABELS[procedure] || analysisDisplayName(procedure);
  }
  const lines = proseLines(answer).filter(line => !FILE_LINE.test(line));
  for (const line of lines) {
    const opening = sentences(line).find(
      sentence => !isBaseSentence(sentence) && !isLeadSentence(sentence)
    );
    if (opening) return opening.length > 90 ? `${opening.slice(0, 89).trimEnd()}…` : opening;
  }
  return 'Result';
}

/** The first prose sentence that states a figure. A test name on its own is skipped. */
export function outputTakeaway(answer: string): string {
  let fallback = '';
  for (const line of proseLines(answer)) {
    if (FILE_LINE.test(line)) continue;
    for (const sentence of sentences(line).filter(item => !isBaseSentence(item))) {
      if (/themes among people who answered/i.test(sentence)) continue;
      if (!fallback) fallback = sentence;
      if (/\d/.test(sentence)) return sentence;
    }
  }
  return fallback;
}

/** The base and weight clause from a frequency summary, when the answer did not keep one. */
export function outputBaseClause(results: ToolResult[] | undefined, answer: string): string {
  const noted = outputBaseNote(answer);
  if (noted) return noted;
  for (const item of analysisItems(results)) {
    const line = String(summaryOf(item).line || '');
    const match = line.match(/((?:weighted by|unweighted)\b[\s\S]*)$/i);
    if (match && /base/i.test(match[1])) return match[1].replace(/\s+/g, ' ').trim();
  }
  return '';
}

/** Base sentences, each once, for the small note under the takeaway. */
export function outputBaseNote(answer: string): string {
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const line of proseLines(answer)) {
    for (const sentence of sentences(line)) {
      if (!isBaseSentence(sentence) || /^(base \d|(un)?weighted\.?$)/i.test(sentence)) continue;
      const clean = sentence.replace(/\.{2,}$/, '.');
      const key = clean.replace(/[.\s]+$/, '').toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      kept.push(clean);
    }
  }
  return kept.join(' ');
}

/** A result citation the server did not fill. The table comes from the result, not this token. */
export function withoutResultTokens(answer: string): string {
  return String(answer || '')
    .replace(/\{+\s*table:\s*[^{}\n]+\}+/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
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

function succeeded(item: ToolResult): boolean {
  if (item.ok === false || item.error) return false;
  const nested = item.result || {};
  return nested.ok !== false && !nested.error;
}

/** Saved run ids on this turn, for the server exports. A failed step is not an output. */
export function outputRunIds(results: ToolResult[] | undefined): string[] {
  return analysisItems(results)
    .filter(succeeded)
    .map(item => {
      const nested = item.result || {};
      const value = (item as { run_id?: unknown }).run_id ?? nested.run_id;
      return typeof value === 'string' ? value : '';
    })
    .filter(Boolean);
}

/** The output card is a successful result. A failed turn stays in the thread. */
export function outputCardReady(
  turn: { status?: string; tool_results?: ToolResult[] } | null | undefined,
  plan: boolean
): boolean {
  if (!turn || turn.status !== 'ok' || plan) return false;
  return outputRunIds(turn.tool_results).length > 0;
}

/** Method checks the engine ran, as short chips. A failed check is a warning. */
export function outputChecks(
  results: ToolResult[] | undefined
): { label: string; warn: boolean }[] {
  const checks: { label: string; warn: boolean }[] = [];
  for (const item of analysisItems(results)) {
    const records = summaryOf(item).preconditions;
    for (const record of (Array.isArray(records) ? records : []) as Record<string, unknown>[]) {
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
    for (const label of exclusionLabels(item)) {
      if (!checks.some(check => check.label === label)) checks.push({ label, warn: false });
    }
  }
  return checks;
}

function exclusionLabels(item: ToolResult): string[] {
  const result = item.result || {};
  const nested =
    result.result && typeof result.result === 'object'
      ? (result.result as Record<string, unknown>)
      : {};
  const report = (result.report || nested.report || {}) as {
    exclusion_summary?: Record<string, unknown>;
  };
  const summary = summaryOf(item);
  const exclusion =
    report.exclusion_summary || (summary.exclusion as Record<string, unknown> | undefined);
  if (!exclusion || typeof exclusion !== 'object') return [];
  const count = (key: string) => {
    const value = exclusion[key];
    return typeof value === 'number' && value > 0 ? value : 0;
  };
  const lines: string[] = [];
  const missing = count('missing_selected');
  const weight = count('zero_or_missing_weight');
  const filtered = count('filtered_out');
  const other = count('other');
  if (missing) lines.push(`${missing} rows excluded because a selected column was missing`);
  if (weight) lines.push(`${weight} rows excluded because the weight was zero or missing`);
  if (filtered) lines.push(`${filtered} rows excluded because they were filtered out`);
  if (other) lines.push(`${other} rows excluded for another counted reason`);
  return lines;
}

/** Markdown table blocks in the answer, in order. The panel shows them; the thread keeps the prose. */
export function answerTables(answer: string): string {
  const blocks: string[] = [];
  let current: string[] = [];
  for (const line of answer.split('\n')) {
    if (line.trim().startsWith('|')) {
      current.push(line);
      continue;
    }
    if (current.length) blocks.push(current.join('\n'));
    current = [];
  }
  if (current.length) blocks.push(current.join('\n'));
  return blocks.join('\n\n');
}

export function answerWithoutTables(answer: string): string {
  return answer
    .split('\n')
    .filter(line => !line.trim().startsWith('|'))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Respondent count from the base note, for the trace line. */
export function baseCount(note: string): string {
  const weighted = note.match(/\(unweighted (\d[\d,]*)\)/i);
  if (weighted) return weighted[1];
  const plain = note.match(/n = (\d[\d,]*)/i);
  return plain ? plain[1] : '';
}
