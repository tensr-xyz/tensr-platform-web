/**
 * Chat-turn parity helpers (TEN-136): show-work summary, numbered next steps,
 * per-turn change list for undo, and a browser notification when a long run finishes.
 */

import type { AgentLoopToolResult } from '@/lib/run-agent-loop';

export type NumberedNextStep = {
  /** 1-based index the person can type in the composer. */
  n: number;
  /** Short chip label. */
  label: string;
  /** Full message sent when the chip is chosen or the number is typed. */
  prompt: string;
};

export type ChatTurnChange = {
  /** What changed, in words a person can read. */
  label: string;
  operation?: string;
  previousDatasetId?: string;
  currentDatasetId?: string;
};

const LONG_RUN_MS = 8_000;

/** Headline for the collapsible step log: "Ran 6 steps · a · b · c". */
export function summarizeChatSteps(steps: string[]): string {
  const lines = steps.map(line => line.trim()).filter(Boolean);
  if (!lines.length) return '';
  const count = lines.length;
  const noun = count === 1 ? 'step' : 'steps';
  const highlights = lines
    .slice(0, 3)
    .map(line => shortenStepHighlight(line))
    .filter(Boolean);
  if (!highlights.length) return `Ran ${count} ${noun}`;
  return `Ran ${count} ${noun} · ${highlights.join(' · ')}`;
}

function shortenStepHighlight(line: string): string {
  const cleaned = line.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= 42) return cleaned;
  return `${cleaned.slice(0, 39).trimEnd()}…`;
}

/**
 * Up to three next steps after a finished turn. Labels stay general — never
 * tied to a specific survey question or customer file.
 */
export function numberedNextStepsFromTurn(opts: {
  toolResults?: AgentLoopToolResult[];
  steps?: string[];
  hasOutput?: boolean;
  /** Column labels only (never codes / variable names). */
  columnLabels?: string[];
  /** Report already has pinned findings — offer reshape follow-ups. */
  hasReportPins?: boolean;
  /** Stored report / client deck already has pages — same reshape chips. */
  hasReportDocument?: boolean;
}): NumberedNextStep[] {
  const toolResults = opts.toolResults || [];
  const labels = (opts.columnLabels || []).map(label => label.trim()).filter(Boolean);
  const edits = chatTurnChangesFromToolResults(toolResults);
  const analysisTypes = analysisTypesFromToolResults(toolResults);
  const candidates: Array<{ label: string; prompt: string }> = [];
  const reportReady =
    Boolean(opts.hasReportPins) ||
    Boolean(opts.hasReportDocument) ||
    turnBuiltReportPages(toolResults);

  if (reportReady) {
    candidates.push({
      label: 'Board version (5 slides)',
      prompt:
        'Make a 5 slide version for the board, one headline per slide, a chart on each, final slide with 3 recommendations.',
    });
    candidates.push({
      label: 'Short version',
      prompt: 'Build a short version of the report.',
    });
    candidates.push({
      label: 'Refine for an audience',
      prompt: 'Refine the report for a different audience.',
    });
  }

  if (analysisTypes.length) {
    candidates.push({
      label: 'Explain this result',
      prompt: 'Explain this result in plain language, including what drives it and any caveats.',
    });
    const splitLabel = labels.find((_, index) => index > 0) || labels[0];
    if (splitLabel) {
      candidates.push({
        label: `Split by ${splitLabel}`,
        prompt: `Split the same analysis by ${splitLabel}.`,
      });
    }
  }

  if (opts.hasOutput) {
    candidates.push({
      label: 'Add to the report',
      prompt: 'Add this output to the report.',
    });
  }

  if (edits.length) {
    candidates.push({
      label: 'Summarise what changed',
      prompt: 'Summarise every data change from this turn.',
    });
  }

  if ((opts.steps || []).some(step => /table|banner|crosstab/i.test(step))) {
    candidates.push({
      label: 'Add to a banner book',
      prompt: 'Add this table to a banner book.',
    });
  }

  if (candidates.length < 3) {
    candidates.push({
      label: 'What should I check next?',
      prompt: 'What should I check next based on this result?',
    });
  }

  const seen = new Set<string>();
  const unique = candidates.filter(item => {
    const key = item.label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique.slice(0, 3).map((item, index) => ({
    n: index + 1,
    label: item.label,
    prompt: item.prompt,
  }));
}

/** Expand a lone "1" / "2." / "3)" into the matching next-step prompt. */
export function resolveNumberedNextStep(input: string, steps: NumberedNextStep[]): string | null {
  const trimmed = input.trim();
  const match = /^([1-9])\s*[.)]?\s*$/.exec(trimmed);
  if (!match) return null;
  const n = Number(match[1]);
  const step = steps.find(item => item.n === n);
  return step?.prompt ?? null;
}

/** Dataset edits from this turn, for a change list and undo. */
export function chatTurnChangesFromToolResults(
  toolResults: AgentLoopToolResult[] | undefined
): ChatTurnChange[] {
  const out: ChatTurnChange[] = [];
  for (const entry of toolResults || []) {
    if (entry.name !== 'data_edit') continue;
    const result = entry.result;
    if (!result || typeof result !== 'object') continue;
    if (result.ok === false || result.refused === true) continue;
    const nested =
      result.derived && typeof result.derived === 'object'
        ? (result.derived as Record<string, unknown>)
        : null;
    const currentDatasetId = String(
      result.derived_dataset_id || nested?.dataset_id || result.dataset_id || ''
    ).trim();
    const previousDatasetId = String(
      result.parent_dataset_id || nested?.parent_dataset_id || entry.args?.dataset_id || ''
    ).trim();
    const operation = String(result.operation || entry.args?.operation || '').trim();
    const fromMarkdown = stripMarkdownBold(String(result.answer_markdown || '').trim());
    const label =
      fromMarkdown || (operation ? humanOperationLabel(operation) : '') || 'Edited the data';
    if (!currentDatasetId && !previousDatasetId && !label) continue;
    out.push({
      label: label.slice(0, 160),
      operation: operation || undefined,
      previousDatasetId: previousDatasetId || undefined,
      currentDatasetId: currentDatasetId || undefined,
    });
  }
  return out;
}

/** First previous → last current pair for a single undo of the turn. */
export function chatTurnUndoTarget(
  changes: ChatTurnChange[]
): { previousDatasetId: string; currentDatasetId?: string } | null {
  const withPrevious = changes.filter(change => change.previousDatasetId);
  if (!withPrevious.length) return null;
  const first = withPrevious[0]!;
  const last = withPrevious[withPrevious.length - 1]!;
  return {
    previousDatasetId: first.previousDatasetId!,
    currentDatasetId: last.currentDatasetId || undefined,
  };
}

/**
 * Headline for the turn change list (Paper 9e): "3 changes · saved as a new version".
 * Prefer a numeric version label when the product has one; otherwise stay general.
 */
export function formatChatTurnChangesHeadline(
  changes: ChatTurnChange[],
  opts?: { versionLabel?: string | number | null }
): string {
  const count = changes.length;
  if (!count) return '';
  const noun = count === 1 ? 'change' : 'changes';
  const raw = opts?.versionLabel;
  if (raw != null && String(raw).trim()) {
    const label = String(raw).trim();
    const numbered = /^\d+$/.test(label) ? `version ${label}` : label;
    return `${count} ${noun} · saved as ${numbered}`;
  }
  return `${count} ${noun} · saved as a new version`;
}

/**
 * Browser notification when a long chat run finishes and the tab is in the
 * background. Returns true when a notification was shown.
 */
export function notifyChatRunFinished(opts: {
  title: string;
  body?: string;
  /** Override for tests; defaults to document.hidden. */
  hidden?: boolean;
  startedAt?: number;
  minElapsedMs?: number;
  now?: number;
  notify?: (title: string, options?: NotificationOptions) => void;
}): boolean {
  if (typeof window === 'undefined') return false;
  const hidden = opts.hidden ?? (typeof document !== 'undefined' ? document.hidden : false);
  if (!hidden) return false;
  const minElapsed = opts.minElapsedMs ?? LONG_RUN_MS;
  if (opts.startedAt != null) {
    const now = opts.now ?? Date.now();
    if (now - opts.startedAt < minElapsed) return false;
  }

  const show = (fire: (title: string, options?: NotificationOptions) => void) => {
    fire(opts.title, {
      body: opts.body,
      silent: false,
    });
  };

  if (opts.notify) {
    show(opts.notify);
    return true;
  }
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'denied') return false;
  if (Notification.permission === 'granted') {
    show((title, options) => {
      try {
        new Notification(title, options);
      } catch {
        /* ignore */
      }
    });
    return true;
  }
  if (Notification.permission === 'default') {
    void Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        try {
          new Notification(opts.title, { body: opts.body, silent: false });
        } catch {
          /* ignore */
        }
      }
    });
    // Permission prompt started; treat as handled for this finish.
    return true;
  }
  return false;
}

function analysisTypesFromToolResults(toolResults: AgentLoopToolResult[]): string[] {
  const out: string[] = [];
  for (const entry of toolResults) {
    if (entry.name !== 'run_analysis' && entry.name !== 'run_operations') continue;
    const fromArgs = String(entry.args?.analysis_type || '').trim();
    const fromResult = String(entry.result?.analysis_type || '').trim();
    const key = fromArgs || fromResult;
    if (key && !out.includes(key)) out.push(key);
  }
  return out;
}

/** True when this turn already filled Report pages (client deck), so reshape chips apply. */
function turnBuiltReportPages(toolResults: AgentLoopToolResult[]): boolean {
  for (const entry of toolResults) {
    const result = entry.result;
    if (!result || typeof result !== 'object') continue;
    const procedure = String(entry.name || result.procedure || '').trim();
    const nested = String(result.procedure || '').trim();
    if (procedure !== 'build_client_deck' && nested !== 'build_client_deck') continue;
    if (result.ok === false) continue;
    const pages = result.report_pages;
    if (typeof pages === 'number' && pages > 0) return true;
    if (result.document && typeof result.document === 'object') return true;
    if (result.status === 'complete') return true;
  }
  return false;
}

function humanOperationLabel(operation: string): string {
  const cleaned = operation.replace(/_/g, ' ').trim();
  if (!cleaned) return 'Edited the data';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function stripMarkdownBold(text: string): string {
  return text.replace(/\*\*/g, '').replace(/^#+\s*/, '');
}
