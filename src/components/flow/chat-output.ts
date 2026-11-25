/** Output panel text for a finished chat turn: title, takeaway, and the base note. */

import { analysisDisplayName } from '@/lib/analysis-definitions';
import type { RunTable } from '@/components/flow/run-document';
import { funnelHeadline } from '@/components/flow/result-tables';

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
  anova_twoway: 'ANOVA',
  banner_table: 'Crosstab',
  chi_square: 'Chi-square',
  descriptives: 'Descriptives',
  frequencies: 'Frequencies',
  rake: 'Weighting',
  poststratify: 'Weighting',
  ttest_independent: 't-test',
  ttest_paired: 'Paired t-test',
  mann_whitney_u: 'Mann-Whitney',
  kruskal_wallis: 'Kruskal-Wallis',
  wilcoxon_signed_rank: 'Wilcoxon',
  friedman: 'Friedman',
  sign_test: 'Sign test',
  median_test: 'Median test',
  jonckheere_terpstra: 'Jonckheere-Terpstra',
  runs_test: 'Runs test',
  shapiro_wilk: 'Shapiro-Wilk',
  kolmogorov_smirnov: 'Kolmogorov-Smirnov',
  lilliefors_ks: 'Lilliefors',
  kendalls_w: "Kendall's W",
  cochrans_q: "Cochran's Q",
  linear_regression: 'Regression',
  logistic_regression: 'Logistic regression',
  multinomial_logit: 'Multinomial logit',
  quasi_poisson_regression: 'Quasi-Poisson regression',
  bartlett_sphericity: 'Bartlett test of sphericity',
  correlation: 'Correlation',
  drivers: 'Drivers',
  export_set: 'Export',
  build_client_deck: 'Client deck',
  nps: 'NPS',
  calibrated_purchase_intent: 'Calibrated purchase intent',
  share_of_wallet: 'Share of wallet',
  funnel: 'Funnel',
  brand_duplication: 'Duplication',
  paired_brand_test: 'Paired comparison',
};

function procedureOf(item: ToolResult): string {
  const args = item.args || {};
  const nested = item.result || {};
  const value =
    item.analysis_type ||
    item.procedure ||
    args.analysis_type ||
    nested.analysis_type ||
    nested.procedure ||
    item.name;
  return typeof value === 'string' ? value : '';
}

/** True when this turn's primary output is a client deck build. */
export function isClientDeckResult(results: ToolResult[] | undefined): boolean {
  return analysisItems(results).some(item => procedureOf(item) === 'build_client_deck');
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
  const procedure = procedureOf(item);
  if (procedure === 'frequencies') return true;
  // Rank tests and other labelled procedures also carry table.rows — not Frequencies.
  if (procedure && KIND_LABELS[procedure]) return false;
  const summary = summaryOf(item);
  const text = `${summary.title || ''} ${summary.line || ''}`;
  if (/\bfrequency table\b/i.test(text)) return true;
  return hasFrequencyTable(summary) || hasFrequencyTable(item.result);
}

/** The analysis kind for the badge: ANOVA, Crosstab, and so on. */
export function outputKind(results: ToolResult[] | undefined): string {
  const items = analysisItems(results);
  const names = items.map(procedureOf);
  const preferred = preferredProcedure(items);
  const labeled = [preferred, ...names].find(name => name && KIND_LABELS[name]);
  if (labeled) return KIND_LABELS[labeled];
  // Known analysis names beat the frequency-table heuristic (Mann-Whitney carries rows).
  for (const name of [preferred, ...names]) {
    if (!name || name === 'frequencies' || KIND_LABELS[name]) continue;
    const shown = analysisDisplayName(name);
    if (shown && shown !== name) return shown;
  }
  if (items.some(isFrequencyResult)) return 'Frequencies';
  const procedure = procedureOf(items[0] || {});
  if (!procedure) return 'Output';
  return KIND_LABELS[procedure] || analysisDisplayName(procedure);
}

/** Tool progress such as "compute" is not the answer. */
export function isProcedurePlaceholder(text: string): boolean {
  const lines = text
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean);
  return lines.length > 0 && lines.every(line => /^compute(?:\s*;\s*n=\d+)?\.?$/i.test(line));
}

/** Empty / tool-name / progress / flags stubs are never a finished lead (TEN-40). */
export function isInvalidContractLead(text: string): boolean {
  const raw = String(text || '').trim();
  if (!raw) return true;
  const low = raw.toLowerCase();
  if (/\{\{|\}\}/.test(raw)) return true;
  if (/building the (?:table|deck)/i.test(low)) return true;
  if (/^done so far\b/i.test(low)) return true;
  if (/the reply did not finish/i.test(low)) return true;
  if (/current status:\s*pending|status:\s*pending|status is pending/i.test(low)) return true;
  if (/once it finishes|once the table finishes/i.test(low)) return true;
  if (/i(?:'|’)?ll give you|i will give you/i.test(low)) return true;
  if (/here is the table\.?$/i.test(low)) return true;
  if (/^[a-z][a-z0-9_]*(?:\s*;\s*)?flags:\s*[\w,\s]+$/i.test(raw)) return true;
  if (
    /^(?:banner_table|brand_duplication|paired_brand_test|chi_square|descriptives|frequencies|compute|rake|nps|funnel|correlation|correlations|ttest_paired)\b/i.test(
      raw
    ) &&
    !/\d/.test(raw)
  ) {
    return true;
  }
  return false;
}

/** Deferred promise / pending status is not chat prose once a result exists (TEN-192). */
export function isDeferredResultProse(text: string): boolean {
  const raw = String(text || '').trim();
  if (!raw) return false;
  if (/\{\{|\}\}/.test(raw)) return true;
  const low = raw.toLowerCase();
  if (isInvalidContractLead(low)) return true;
  // TEN-192: denial drafts written before the banner landed are not a reply.
  return /still building|table is still pending|pull (?:the body|its figures)|has not returned|was not returned|no projected|no figures|engine has not|once it finishes|current status:\s*pending/i.test(
    low
  );
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
        /\bp\s*[<=>]|p-value|F\s*\(|(?:Welch'?s\s+)?(?:Survey\s+F|U|H|t|z)\s*\(|χ²|chi-square|η²|eta|\br\s*=/i.test(
          sentence
        )
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
  /^(the weighted base for this table is|weighted base\b|unweighted base\b|minimum base|no column is under that base|a column is under that base|base:|unweighted, n =|base \d|(un)?weighted\.?$|[a-z0-9 _/-]+:\s*(un)?weighted\.?$)/i;
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

/** Crosstab / by titles are card names even when longer than a lead sentence. */
function isTableCrossTitle(text: string): boolean {
  return /[×]|(\s+by\s+)/i.test(text);
}

function cardTitleText(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= 90) return trimmed;
  return `${trimmed.slice(0, 89).trimEnd()}…`;
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
function replaceColumnCodes(title: string, columns: QuestionLabel[]): string {
  const byName = new Map<string, string>();
  for (const column of columns) {
    const name = (column.name || '').trim();
    const label = (column.label || '').trim();
    if (name && label && label !== name) {
      byName.set(name.toLowerCase(), label);
    }
  }
  if (!byName.size) return title;
  return title
    .split(/(\s+|×|x|,)/i)
    .map(part => {
      if (/^(×|x|,|\s+)$/i.test(part)) return part === 'x' || part === 'X' ? '×' : part;
      return byName.get(part.toLowerCase()) || part;
    })
    .join('');
}

export function titledWithQuestion(title: string, columns: QuestionLabel[] = []): string {
  const stripped = title.replace(/^frequency table:\s*/i, '').trim();
  const key = stripped.replace(/\.\s*$/, '').toLowerCase();
  const meta = columns.find(column => column.name.trim().toLowerCase() === key);
  const label = (meta?.label || '').trim();
  if (label && label !== stripped) return label;
  return replaceColumnCodes(stripped || title, columns);
}

const PROCEDURE_TITLE = /^(compute|computed|run analysis|run_analysis)$/i;

/** The analysis the card should be named for. A saved column is not the result. */
function preferredProcedure(items: ToolResult[]): string {
  const names = items.map(procedureOf);
  for (const name of [
    'build_client_deck',
    'brand_duplication',
    'paired_brand_test',
    'funnel',
    'nps',
    'chi_square',
    'banner_table',
    'rake',
    'frequencies',
  ]) {
    if (names.includes(name)) return name;
  }
  return names.find(name => name && name !== 'compute') || names[0] || '';
}

/** A short procedure line is not the model's answer. */
export function isBlandAnswer(text: string): boolean {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length || words.length > 14) return false;
  return (
    /^(compute|computed|funnel|nps|rake|result)\b/i.test(text.trim()) ||
    /could not be attached/i.test(text)
  );
}

/** Plain text when a turn would otherwise leave the chat blank. */
export const EMPTY_TURN_ANSWER = 'The reply did not finish. Ask again.';
export const CONTINUING_TURN_ANSWER = 'This turn is still running. Nothing has been reported yet.';
export const UNFINISHED_TURN_ANSWER =
  'This turn did not end on a result, a conceptual answer, a question, or an unsupported outcome.';

/** Terminal answers must be readable. Approval may stay blank (plan is on the card). */
export function visibleTurnAnswer(status: string | undefined, text: string): string {
  const raw = String(text || '').trim();
  if (status === 'awaiting_approval') return '';
  // Placeholders / progress stubs are not a finished reply (TEN-40).
  if (/\{\{|\}\}/.test(raw) || isDeferredResultProse(raw)) {
    return status === 'continuing' ? CONTINUING_TURN_ANSWER : EMPTY_TURN_ANSWER;
  }
  const done = withoutResultTokens(raw).trim();
  if (done) return done;
  if (status === 'continuing') return CONTINUING_TURN_ANSWER;
  return EMPTY_TURN_ANSWER;
}

/**
 * TEN-242: prefer finished result lines over "did not finish" / placeholders
 * when the card already has a summary.
 */
export function readableTurnAnswer(
  status: string | undefined,
  text: string,
  results?: { summary?: Record<string, unknown> | null; result?: Record<string, unknown> }[]
): string {
  const kept = visibleTurnAnswer(status, text);
  if (status === 'awaiting_approval') return kept;
  const unfinished =
    !kept ||
    kept === EMPTY_TURN_ANSWER ||
    kept === CONTINUING_TURN_ANSWER ||
    kept === UNFINISHED_TURN_ANSWER ||
    /\{\{|\}\}/.test(kept) ||
    isDeferredResultProse(kept);
  if (!unfinished) return kept;
  const salvaged = resultLead(kept, results).trim();
  if (salvaged && salvaged !== EMPTY_TURN_ANSWER && !/\{\{|\}\}/.test(salvaged)) {
    return salvaged;
  }
  return kept;
}

/** Keep the streamed answer when the finished text is only a procedure line. */
export function keptModelAnswer(streamed: string, finalText: string): string {
  const live = withoutResultTokens(streamed).trim();
  const done = withoutResultTokens(finalText).trim();
  if (!done) return live;
  if (!live || /\{\{|\}\}/.test(streamed)) return done;
  if (isBlandAnswer(done) && !isBlandAnswer(live)) return live;
  return done;
}

const STDERR_MARKS = [
  'traceback',
  'execution halted',
  'loading required package',
  'attaching package',
  'masked from package',
  'svydesign',
  'error in ',
  'lengths of prob',
  'modulenotfounderror',
  'syntaxerror',
  'nameerror',
  'typeerror:',
  'valueerror:',
  'r script failed',
];
const PROMISE_MARKS = ['check', 'look', 'verify', 'confirm', 'retry', 'rerun', 'investigate'];
const CORRECTION_MARKS = [
  'earlier reply',
  'previous reply',
  'i was wrong',
  'wrong way round',
  'i misspoke',
  'that was incorrect',
  'in my last reply',
  'correction:',
];

/** One pass for every sentence a person reads. Drops a promise, a retry, and raw stderr. */
export function guardUserText(text: string): string {
  const source = String(text || '');
  if (!source.trim()) return '';
  const kept = source
    .split(/(?<=[.!?])\s+|\n+/)
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => (/\bfreq:/i.test(part) ? 'Check not run for this table.' : part))
    .filter(part => !dropUserSentence(part));
  return kept.join(' ').trim();
}

function dropUserSentence(part: string): boolean {
  const folded = part.toLowerCase();
  if (STDERR_MARKS.some(mark => folded.includes(mark))) return true;
  if (
    /\b(?:brand_duplication|banner_table|paired_brand_test|row_filters|analysis_type)\b/i.test(
      folded
    )
  ) {
    return true;
  }
  if (
    (folded.includes('option column') || folded.includes('option columns')) &&
    (folded.includes('passed') ||
      (folded.includes('lists') && folded.includes('but')) ||
      folded.includes('check that the list matches'))
  ) {
    return true;
  }
  if (CORRECTION_MARKS.some(mark => folded.includes(mark))) return true;
  const opening =
    folded.startsWith("i'll ") || folded.startsWith('i will ') || folded.startsWith('let me ');
  return opening && PROMISE_MARKS.some(mark => folded.includes(mark));
}

function withoutOtherRuns(text: string): string {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const kept = sentences.filter(sentence => {
    if (/can.?t show inline|cannot show inline/i.test(sentence)) return false;
    if (
      /other chat|another chat|earlier chat|previous chat|earlier run|previous run|earlier funnel/i.test(
        sentence
      )
    )
      return false;
    return true;
  });
  return kept.join(' ').trim();
}

/** The model's sentences, or the result's own line when the chat has none. */
export function resultLead(
  answer: string,
  results?: { summary?: Record<string, unknown> | null; result?: Record<string, unknown> }[],
  tables?: RunTable[]
): string {
  let prose = withoutOtherRuns(
    answerWithoutBase(withoutResultTokens(answerWithoutTables(answer)))
  ).trim();
  // A finish stub is not a lead; use the structured result lines instead.
  const unfinishedStub =
    prose === EMPTY_TURN_ANSWER ||
    prose === CONTINUING_TURN_ANSWER ||
    prose === UNFINISHED_TURN_ANSWER ||
    /^this turn did not end on a result/i.test(prose);
  if (unfinishedStub) prose = '';
  const finding = withoutOtherRuns(answerWithoutBase(summaryLine(results))).trim();
  const deniesTheTable =
    /not returned|was not returned|can.?t give|cannot give|could not (?:give|return|show)|was not run/i.test(
      prose
    );
  if (deniesTheTable && finding) return guardUserText(withoutStrayEnding(finding));
  // TEN-188 / TEN-40 / TEN-192: pending / deferred / failed-model prose must not beat a finished result line.
  const pendingOrFailedProse =
    isDeferredResultProse(prose) ||
    /flags:\s*\w|reports?\s+(?:banner_table|brand_duplication)|model call failed|this turn stopped/i.test(
      prose
    );
  if (pendingOrFailedProse && finding) return guardUserText(withoutStrayEnding(finding));
  const hasFigure = (text: string) => /%/.test(text) || /thousand/i.test(text);
  const hasDigits = (text: string) => /\d/.test(text);
  // Prefer the structured summary when the model still quotes snake_case codes.
  const codeHeavy = (text: string) =>
    /\b[A-Za-z][A-Za-z0-9]*_[A-Za-z0-9_]+\b/.test(text) ||
    /\bWeight:\s*[A-Za-z][A-Za-z0-9]*_[A-Za-z0-9_]*\b/.test(text);
  // Bare Key-stat glued ahead of a plain reading, or the same clause twice.
  const repeatedContract =
    prose.toLowerCase().split('consistent with chance').length - 1 >= 2 ||
    prose.toLowerCase().split('spearman').length - 1 >= 2 ||
    (/^(?:spearman\s*ρ|pearson\s*r|kendall\s*τ)\s*=/i.test(prose.trim()) &&
      /no real link|move together|move in opposite/i.test(finding));
  const preferFinding =
    Boolean(finding && hasDigits(finding)) && (!prose || codeHeavy(prose) || repeatedContract);
  // Duplication leads are stamped by the engine (Paper 6n). Prefer them over model prose
  // so the card does not repeat net reach in two formats.
  const duplicationFinding =
    Boolean(finding) &&
    Array.isArray(results) &&
    results.some(item => {
      const nested = item?.result && typeof item.result === 'object' ? item.result : item;
      const record =
        nested && typeof nested === 'object' ? (nested as Record<string, unknown>) : {};
      return (
        record.kind === 'brand_duplication' ||
        record.analysis_type === 'brand_duplication' ||
        record.procedure === 'brand_duplication'
      );
    });
  const text =
    (duplicationFinding ? finding : '') ||
    (preferFinding ? finding : '') ||
    (hasFigure(prose) && !codeHeavy(prose) ? prose : '') ||
    (hasFigure(finding) ? finding : '') ||
    (finding && hasDigits(finding) && !hasFigure(prose) ? finding : '') ||
    (prose && hasDigits(prose) && !pendingOrFailedProse ? prose : '') ||
    finding ||
    (pendingOrFailedProse || unfinishedStub ? '' : prose) ||
    (unfinishedStub ? '' : outputTakeaway(answer));
  // TEN-40: a tool name, flags stub, or progress line is never the card lead.
  const stubLead =
    /^(?:banner_table|brand_duplication|paired_brand_test|chi_square|descriptives|frequencies|compute|rake|nps|funnel|correlation|correlations|ttest_paired)\b/i.test(
      text.trim()
    ) ||
    /building the (?:table|deck)/i.test(text) ||
    /current status:\s*pending/i.test(text) ||
    /^[a-z][a-z0-9_]*(?:\s*;\s*)?flags:\s*[\w,\s]+$/i.test(text.trim());
  const usable =
    stubLead && finding && !isInvalidContractLead(finding) ? finding : stubLead ? '' : text;
  const cleaned = guardUserText(withoutStrayEnding(collapseRepeatedLead(usable)));
  const headline = tables ? funnelHeadline(tables) : '';
  const figures = cleaned.match(/%/g)?.length ?? 0;
  const hasFunnelFigures =
    /from the previous stage/i.test(cleaned) || /highest at\s+-?\d/i.test(cleaned);
  // A full API funnel line already has conversions and high/low figures; do not replace it.
  if (headline && (!cleaned || (figures > 4 && !hasFunnelFigures))) return headline;
  return cleaned;
}

/** Drop a repeated Mann-Whitney / correlation sentence glued onto itself. */
function collapseRepeatedLead(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  const half = Math.floor(trimmed.length / 2);
  if (half >= 40) {
    const left = trimmed.slice(0, half).trim();
    const right = trimmed.slice(half).trim();
    if (left && right && (right.startsWith(left) || left === right)) return left;
  }
  // Same block twice with a space between (length not an even split).
  for (let size = Math.floor(trimmed.length / 2); size >= 40; size -= 1) {
    const block = trimmed.slice(0, size).trimEnd();
    if (block.length < 40) break;
    const rest = trimmed.slice(size).trimStart();
    if (rest === block || rest.startsWith(block)) return block;
  }
  // Same U/F/t clause twice on one line.
  const match = trimmed.match(
    /^(.+?\b(?:U|H|F|t)\s*(?:\([^)]*\))?\s*=\s*-?[\d.,]+.+?)(?:\s+\1)+$/i
  );
  if (match?.[1]) return match[1].trim();
  return collapseSubsumedStatSentences(trimmed);
}

/** Split on sentence endings without cutting decimal places (1086523.5). */
function leadSentenceParts(line: string): string[] {
  const parts = line
    .trim()
    .split(/(?<!\.)\.(?:\s+|$)/)
    .map(part => part.trim())
    .filter(Boolean);
  // A trailing "?" is a question-label mark, not a finished sentence — the
  // splitter already consumed the real "." so put it back (TEN-40).
  return parts.map(part => (part.endsWith('.') || part.endsWith('!') ? part : `${part}.`));
}

function looksLikeBareStatLead(sentence: string): boolean {
  const low = sentence.trim().toLowerCase();
  if (
    /^(?:welch'?s\s+)?(?:survey\s+)?(?:pearson\s+chi-square|u|h|f|t|z|χ²|chi-square)\b/.test(low)
  ) {
    return low.includes('p =') || low.includes('p <') || low.includes('p-value');
  }
  // Bare Key-stat for a correlation pair (no subject labels before the coeff).
  if (/^(?:spearman\s*ρ|pearson\s*r|kendall\s*τ)\s*=/.test(low)) {
    return low.includes('p =') || low.includes('p <') || low.includes('p-value');
  }
  return false;
}

function looksLikeCorrelationPair(sentence: string): boolean {
  const low = sentence.trim().toLowerCase();
  if (!/(?:spearman\s*ρ|pearson\s*r|kendall\s*τ|\bρ\b|\br\s*=|\bτ\b)/.test(low)) return false;
  return low.includes('p =') || low.includes('p <') || low.includes('p-value');
}

function correlationFigureKey(sentence: string): string {
  const low = sentence.trim().toLowerCase();
  const coeff = low.match(/(?:spearman\s*ρ|pearson\s*r|kendall\s*τ|ρ|r|τ)\s*=\s*(-?[\d.]+)/);
  const p = low.match(/p\s*(?:value)?\s*[=<>]\s*([\d.]+)/);
  if (!coeff || !p) return '';
  return `${coeff[1]}|${p[1]}`;
}

function looksLikeCorrelationReading(sentence: string): boolean {
  const low = sentence.trim().toLowerCase();
  return (
    low.startsWith('no real link between ') ||
    low.includes(' move together') ||
    low.includes(' move in opposite')
  );
}

/** Drop a bare U/F/t … p = … and keep each labelled sentence once. */
function collapseSubsumedStatSentences(line: string): string {
  const parts = leadSentenceParts(line);
  if (parts.length < 2) return line;
  const norms = parts.map(part => part.replace(/\.$/, '').toLowerCase());
  const drop = new Set<number>();
  norms.forEach((short, index) => {
    if (short.length < 16 || !/\d/.test(short) || !looksLikeBareStatLead(short)) return;
    const subsumed = norms.some(
      (longer, other) =>
        other !== index && longer.length > short.length + 4 && longer.includes(short)
    );
    if (subsumed) drop.add(index);
  });
  // Correlation: same ρ/p under codes vs labels → keep the labelled sentence (TEN-40).
  norms.forEach((short, index) => {
    if (drop.has(index) || !looksLikeCorrelationPair(short)) return;
    const figures = correlationFigureKey(short);
    if (!figures) return;
    const codeHeavy = /\b[a-z][a-z0-9]*_[a-z0-9_]+\b/.test(short);
    norms.forEach((other, otherIndex) => {
      if (otherIndex === index || drop.has(otherIndex) || !looksLikeCorrelationPair(other)) return;
      if (correlationFigureKey(other) !== figures) return;
      const otherCodes = /\b[a-z][a-z0-9]*_[a-z0-9_]+\b/.test(other);
      if (codeHeavy && !otherCodes) drop.add(index);
      else if (codeHeavy === otherCodes && short.length < other.length) drop.add(index);
    });
  });
  // Plain reading first: at most one bare Key-stat, after the reading (TEN-40).
  const readingIndexes = norms
    .map((short, index) => ({ short, index }))
    .filter(({ short, index }) => !drop.has(index) && looksLikeCorrelationReading(short))
    .map(({ index }) => index);
  const bareCoeffIndexes = norms
    .map((short, index) => ({ short, index }))
    .filter(
      ({ short, index }) =>
        !drop.has(index) && looksLikeBareStatLead(short) && looksLikeCorrelationPair(short)
    )
    .map(({ index }) => index);
  if (readingIndexes.length && bareCoeffIndexes.length) {
    const firstReading = Math.min(...readingIndexes);
    const before = bareCoeffIndexes.filter(index => index < firstReading);
    const after = bareCoeffIndexes.filter(index => index >= firstReading);
    if (after.length) {
      before.forEach(index => drop.add(index));
      after.slice(1).forEach(index => drop.add(index));
    } else {
      before.slice(0, -1).forEach(index => drop.add(index));
    }
  }
  const kept: string[] = [];
  const seen = new Set<string>();
  parts.forEach((part, index) => {
    if (drop.has(index)) return;
    const key = norms[index];
    if (seen.has(key)) return;
    seen.add(key);
    kept.push(part);
  });
  const readingPos = kept.findIndex(part => looksLikeCorrelationReading(part));
  const barePos = kept.findIndex(
    part => looksLikeBareStatLead(part) && looksLikeCorrelationPair(part)
  );
  if (readingPos >= 0 && barePos >= 0 && barePos < readingPos) {
    const swap = kept[barePos];
    kept[barePos] = kept[readingPos];
    kept[readingPos] = swap;
  }
  return kept.join(' ').trim();
}
/** A funnel output opens that output. Other outputs open the table builder. */
export function outputOpenHref(projectHref: string, kind: string, runId: string): string {
  if (kind === 'Funnel' && runId) {
    return analysisReportHref(projectHref, runId);
  }
  if (kind === 'Client deck') {
    // Slides view — not Outputs (no stored analysis summary for a deck job).
    return clientDeckReportHref(projectHref);
  }
  return `${projectHref}/tables`;
}

/** Open Report › Outputs on a finished analysis (and highlight that run). */
export function analysisReportHref(projectHref: string, runId?: string | null): string {
  if (runId) {
    return `${projectHref}/report?pane=outputs&run=${encodeURIComponent(runId)}`;
  }
  return `${projectHref}/report?pane=outputs`;
}

/** Open Report › Slides for a client deck. */
export function clientDeckReportHref(projectHref: string): string {
  return `${projectHref}/report?pane=slides`;
}

/** A weight column code and an empty cautions bullet are not part of the finding. */
export function withoutStrayEnding(text: string): string {
  const lines = text.split('\n').filter(line => {
    const trimmed = line.trim();
    if (/^cautions:?$/i.test(trimmed)) return false;
    if (/^[-*•]\s*$/.test(trimmed)) return false;
    // A trailing "weighted by column_code" line under the reply (TEN-41).
    if (/^weighted by [A-Za-z][A-Za-z0-9]*_[A-Za-z0-9_]*\.?$/i.test(trimmed)) return false;
    return true;
  });
  return (
    lines
      .join('\n')
      .replace(/\s+weighted by [A-Za-z][A-Za-z0-9]*_[A-Za-z0-9_]*\.?/gi, '')
      .replace(/\s+Weight:\s*[A-Za-z][A-Za-z0-9]*_[A-Za-z0-9_]*\.?/gi, '')
      .replace(/\s*[\(\[]\s*[\)\]]/g, '')
      .replace(/(\d+\.\d{2,})%/g, (_all, raw: string) => {
        const number = Number(raw);
        if (!Number.isFinite(number)) return `${raw}%`;
        const shown = number.toFixed(1).replace(/\.0$/, '');
        return `${shown}%`;
      })
      // U/H half-integers match the Test table: 1086523.500 → 1086523.5
      .replace(
        /\b([UH])\s*=\s*(-?\d+)\.(\d{2,})\b/g,
        (_all, name: string, whole: string, frac: string) => {
          const trimmed = frac.replace(/0+$/, '');
          if (!trimmed) return `${name} = ${whole}`;
          if (trimmed === '5' && frac.replace(/5/, '').replace(/0/g, '') === '') {
            return `${name} = ${whole}.5`;
          }
          return `${name} = ${whole}.${trimmed}`;
        }
      )
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}

function summaryLine(
  results?: { summary?: Record<string, unknown> | null; result?: Record<string, unknown> }[]
): string {
  const lines: string[] = [];
  const seen = new Set<string>();
  const push = (line: string) => {
    const text = line.trim();
    if (!text || !/[A-Za-z]/.test(text) || !/\d/.test(text)) return;
    // The default summarize stub is the procedure name; it is not a lead.
    if (isInvalidContractLead(text)) return;
    if (
      /^(banner_table|brand_duplication|paired_brand_test|rake|frequencies|funnel|nps|chi_square|descriptives)\b/i.test(
        text
      )
    )
      return;
    if (/flags:\s*\w/i.test(text) || /building the table/i.test(text)) return;
    if (seen.has(text)) return;
    seen.add(text);
    lines.push(text);
  };
  for (const item of results || []) {
    const nested =
      item?.result && typeof item.result === 'object' && !Array.isArray(item.result)
        ? (item.result as Record<string, unknown>)
        : undefined;
    const nestedSummary =
      nested && nested.summary && typeof nested.summary === 'object'
        ? (nested.summary as Record<string, unknown>)
        : undefined;
    const summary = item?.summary || nestedSummary;
    if (typeof summary?.line === 'string') push(summary.line);
    // Report answer is the same contract when the summary line was stripped.
    for (const layer of [item?.result, nested]) {
      if (!layer || typeof layer !== 'object') continue;
      const report = (layer as { report?: unknown }).report;
      if (!report || typeof report !== 'object') continue;
      const block = report as { answer_from_result?: unknown; answer?: unknown };
      if (block.answer_from_result === true && typeof block.answer === 'string') {
        push(block.answer);
      }
    }
  }
  if (!lines.length) return '';
  // A share or rake finding beats a weight-only companion. Comparison and
  // correlation lines have no % — keep every structured contract in order.
  const withFigure = lines.filter(line => /%|thousand|target|met|missed/i.test(line));
  if (withFigure.length) return withFigure.join(' ');
  return lines.join(' ');
}

/** Subject before the statistic on a structured lead, e.g. "Satisfaction by Brand". */
function subjectFromStructuredAnswer(answer: string): string {
  for (const line of proseLines(answer)) {
    const match = line.match(
      /^(.+?):\s*(?:Welch'?s\s+)?(?:Survey\s+F|Pearson\s+chi-square|F|t|H|U|z|statistic)\b/i
    );
    const subject = (match?.[1] || '').trim();
    if (subject && isQuestion(subject) && !PROCEDURE_TITLE.test(subject)) {
      return subject.length > 90 ? `${subject.slice(0, 89).trimEnd()}…` : subject;
    }
  }
  return '';
}

function structuredAnswerOnResult(item: ToolResult): string {
  const result = item.result || {};
  const nested =
    result.result && typeof result.result === 'object'
      ? (result.result as Record<string, unknown>)
      : {};
  for (const layer of [result, nested]) {
    const report = layer.report;
    if (!report || typeof report !== 'object') continue;
    const block = report as { answer_from_result?: unknown; answer?: unknown };
    if (
      block.answer_from_result === true &&
      typeof block.answer === 'string' &&
      block.answer.trim()
    ) {
      return block.answer.trim();
    }
  }
  return '';
}

/** The table title the API put on the result, or the first prose line that is not the base. */
export function outputTitle(
  results: ToolResult[] | undefined,
  answer: string,
  columns: QuestionLabel[] = []
): string {
  const items = analysisItems(results);
  if (preferredProcedure(items) === 'funnel') return 'Funnel';
  if (preferredProcedure(items) === 'brand_duplication') return 'Duplication';
  // Share tables for skipped categoricals must not rename a descriptives card.
  if (preferredProcedure(items) === 'descriptives') return 'Descriptives';
  const questions = frequencyQuestions(results).map(question =>
    titledWithQuestion(question, columns)
  );
  if (questions.length === 1) return questions[0];
  if (questions.length > 1) {
    const stems = questions.map(question =>
      question.includes(':') ? question.split(':', 1)[0].trim() : question
    );
    const shared =
      stems.every(stem => stem.toLowerCase() === stems[0].toLowerCase()) && stems[0]
        ? stems[0]
        : questions[0];
    return `${shared} and ${questions.length - 1} more`;
  }
  const preferred = preferredProcedure(items);
  if (preferred === 'rake' || preferred === 'poststratify') {
    for (const item of items) {
      if (procedureOf(item) !== preferred) continue;
      const title = summaryOf(item).title;
      if (typeof title === 'string' && title.trim() && !isLeadSentence(title)) {
        return cardTitleText(title.trim());
      }
    }
  }
  for (const item of items) {
    if (procedureOf(item) === 'compute' && preferred && preferred !== 'compute') continue;
    const fromResult = subjectFromStructuredAnswer(structuredAnswerOnResult(item));
    if (fromResult) return fromResult;
    const result = item.result || {};
    const nested =
      result.result && typeof result.result === 'object'
        ? (result.result as Record<string, unknown>)
        : {};
    const title = summaryOf(item).title ?? result.title ?? nested.title;
    if (typeof title === 'string' && PROCEDURE_TITLE.test(title.trim())) continue;
    const keepLongTitle =
      typeof title === 'string' &&
      (isTableCrossTitle(title) || procedureOf(item) === 'banner_table');
    if (typeof title === 'string' && title.trim() && (keepLongTitle || !isLeadSentence(title))) {
      const shown = titledWithQuestion(title, columns);
      const kindName = (
        KIND_LABELS[procedureOf(item)] ||
        KIND_LABELS[preferred] ||
        ''
      ).toLowerCase();
      if (kindName && shown.toLowerCase().startsWith(kindName) && shown.split(/\s+/).length > 2) {
        continue;
      }
      if (isQuestion(shown) || keepLongTitle) return cardTitleText(shown);
      const fromColumn = questionFromBody(bodyOf(item), columns);
      if (fromColumn) return cardTitleText(fromColumn);
      if (shown.trim()) return cardTitleText(shown);
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
      const labelled = `${titledWithQuestion(measure, columns)} by ${titledWithQuestion(group, columns)}`;
      // Prefer the structured subject when the body only has variable codes.
      if (!isQuestion(labelled)) {
        const fromAnswer = subjectFromStructuredAnswer(answer);
        if (fromAnswer) return fromAnswer;
      }
      return labelled;
    }
    if (measure) return titledWithQuestion(measure, columns);
  }
  const fromAnswerAlone = subjectFromStructuredAnswer(answer);
  if (fromAnswerAlone) return fromAnswerAlone;
  const procedure = preferred || procedureOf(items[0] || {});
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
    .replace(/\{\{[^}]+\}\}/g, '')
    .replace(/\{+\s*table:\s*[^{}\n]+\}+/g, '')
    .replace(/[ \t]{2,}/g, ' ')
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
/** A lead saved as one line still starts a list at each " - ". */
export function restoreListBreaks(text: string): string {
  return text
    .replace(/([.!?])\s+-\s+/g, '$1\n- ')
    .replace(/(?<=[a-z0-9%])\s+-\s+(?=[A-Z])/g, '\n- ');
}

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
  const items = analysisItems(results).filter(succeeded);
  const preferred = preferredProcedure(items);
  const ordered = preferred
    ? [
        ...items.filter(item => procedureOf(item) === preferred),
        ...items.filter(item => procedureOf(item) !== preferred),
      ]
    : items;
  return ordered
    .map(item => {
      const nested = item.result || {};
      const value = (item as { run_id?: unknown }).run_id ?? nested.run_id ?? nested.job_id;
      return typeof value === 'string' ? value : '';
    })
    .filter(Boolean);
}

/** A real table is already in the stream. A compute step is not one. */
export function hasSummaryTable(results: ToolResult[] | undefined): boolean {
  return analysisItems(results).some(item => {
    if (!succeeded(item) || procedureOf(item) === 'compute') return false;
    const summary = summaryOf(item);
    if (Array.isArray(summary.table) && summary.table.length > 0) return true;
    if (Array.isArray(summary.by_group) && summary.by_group.length > 0) return true;
    return false;
  });
}

/** The output card is a successful result. A failed turn stays in the thread. */
export function outputCardReady(
  turn: { status?: string; tool_results?: ToolResult[] } | null | undefined,
  plan: boolean
): boolean {
  if (!turn || turn.status !== 'ok') return false;
  // A plan with no table yet is still the approval card. A table in the stream opens the panel.
  if (plan) return hasSummaryTable(turn.tool_results);
  if (outputRunIds(turn.tool_results).length > 0 || hasSummaryTable(turn.tool_results)) return true;
  // Finished deck with a download (or pending job id) still gets the chat card.
  return (turn.tool_results || []).some(item => {
    if (procedureOf(item) !== 'build_client_deck') return false;
    const nested = item.result || {};
    if (nested.ok === false || nested.error) return false;
    return Boolean(
      nested.exports ||
      nested.key ||
      nested.run_id ||
      nested.job_id ||
      (item as { run_id?: unknown }).run_id
    );
  });
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

/**
 * Side-panel tab for an agent table. Unsaved previews have no T number so they
 * cannot collide with a saved T1; a saved number is shown only after save.
 */
export function outputTableTabLabel(title: string, number?: number | null): string {
  const label = title.trim() || 'Table';
  const saved = Number(number);
  if (Number.isFinite(saved) && saved > 0) return `T${saved} ${label}`;
  return label;
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
