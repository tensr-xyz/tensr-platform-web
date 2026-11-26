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
  /** Paper 9e: offer "See them" for row-removal edits. */
  seeDropped?: boolean;
};

/** Generic fillers so a finished turn always offers three numbered next steps. */
const NEXT_STEP_FILLERS: Array<{ label: string; prompt: string }> = [
  {
    label: 'What should I check next?',
    prompt: 'What should I check next based on this result?',
  },
  {
    label: 'Explain this result',
    prompt: 'Explain this result in plain language, including what drives it and any caveats.',
  },
  {
    label: 'Check the bases',
    prompt: 'Check the bases for this result.',
  },
  {
    label: 'Try another cut',
    prompt: 'Show me another cut of this result.',
  },
];

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
    candidates.push({
      label: 'Check the bases',
      prompt: 'Check the bases after these changes.',
    });
  }

  if ((opts.steps || []).some(step => /table|banner|crosstab/i.test(step))) {
    candidates.push({
      label: 'Add to a banner book',
      prompt: 'Add this table to a banner book.',
    });
  }

  const seen = new Set<string>();
  const unique = candidates.filter(item => {
    const key = item.label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // QA: always surface three chips so typing 1 / 2 / 3 works after every finished turn.
  for (const filler of NEXT_STEP_FILLERS) {
    if (unique.length >= 3) break;
    const key = filler.label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(filler);
  }

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

/** Edit / version procedures that create a working version (v2 name may be the procedure). */
const EDIT_PROCEDURES = new Set([
  'data_edit',
  'recode',
  'compute',
  'filter',
  'filter_apply',
  'rename',
  'rename_labels',
  'set_labels',
  'merge_small_categories',
  'set_dont_know_missing',
  'set_nets',
  'set_routing',
  'confirm_loop',
  'fix_types',
  'rake',
  'weight',
  'rim',
  'set_active_weight',
  'combine_weights',
  'merge',
  'merge_datasets',
  'stack',
  'fuse_waves',
  'save_working_version',
]);

function entryProcedureName(entry: AgentLoopToolResult & Record<string, unknown>): string {
  const args = entry.args && typeof entry.args === 'object' ? entry.args : null;
  const result = entry.result && typeof entry.result === 'object' ? entry.result : null;
  return String(
    entry.procedure ||
      args?.operation ||
      args?.analysis_type ||
      result?.operation ||
      result?.analysis_type ||
      entry.name ||
      ''
  )
    .trim()
    .toLowerCase();
}

function isChatTurnEditEntry(entry: AgentLoopToolResult & Record<string, unknown>): boolean {
  const procedure = entryProcedureName(entry);
  if (EDIT_PROCEDURES.has(procedure)) return true;
  const producing = String(entry.producing_operation || entry.result?.producing_operation || '')
    .trim()
    .toLowerCase();
  if (producing.startsWith('weight:')) return true;
  // Slim / history payloads may only leave lineage ids.
  if (String(entry.derived_dataset_id || '').trim()) return true;
  const result = entry.result;
  if (!result || typeof result !== 'object') return false;
  if (String(result.derived_dataset_id || result.saved_dataset_id || '').trim()) return true;
  const nested =
    result.derived && typeof result.derived === 'object'
      ? (result.derived as Record<string, unknown>)
      : null;
  return Boolean(String(nested?.dataset_id || '').trim());
}

function weightLabelFromResult(
  result: Record<string, unknown>,
  entry: Record<string, unknown>
): string {
  const vector =
    result.weight_vector && typeof result.weight_vector === 'object'
      ? (result.weight_vector as Record<string, unknown>)
      : null;
  const diagnostics =
    vector?.diagnostics && typeof vector.diagnostics === 'object'
      ? (vector.diagnostics as Record<string, unknown>)
      : result.diagnostics && typeof result.diagnostics === 'object'
        ? (result.diagnostics as Record<string, unknown>)
        : null;
  for (const raw of [
    result.active_weight_label,
    diagnostics?.weight_label,
    vector?.label,
    entry.active_weight_label,
  ]) {
    const label = String(raw || '').trim();
    if (!label) continue;
    // Never surface column codes (rake_weight, weight_2).
    if (label.includes('_') && label === label.toLowerCase()) continue;
    return label;
  }
  return '';
}

function isWeightVersionOperation(operation: string): boolean {
  const key = operation.trim().toLowerCase();
  return (
    key === 'rake' ||
    key === 'weight' ||
    key === 'rim' ||
    key === 'set_active_weight' ||
    key === 'combine_weights' ||
    key.startsWith('weight:')
  );
}

/** Dataset edits from this turn, for a change list and undo. */
export function chatTurnChangesFromToolResults(
  toolResults: AgentLoopToolResult[] | undefined
): ChatTurnChange[] {
  const out: ChatTurnChange[] = [];
  for (const entry of toolResults || []) {
    const entryRecord = entry as AgentLoopToolResult & Record<string, unknown>;
    if (!isChatTurnEditEntry(entryRecord)) continue;
    const result =
      entry.result && typeof entry.result === 'object'
        ? entry.result
        : ({} as Record<string, unknown>);
    if (result.ok === false || result.refused === true) continue;
    // Slim stream payloads put ids on the entry; full results keep them nested.
    const nested =
      result.derived && typeof result.derived === 'object'
        ? (result.derived as Record<string, unknown>)
        : null;
    const entrySummary =
      entryRecord.summary && typeof entryRecord.summary === 'object'
        ? (entryRecord.summary as Record<string, unknown>)
        : null;
    const summary =
      result.summary && typeof result.summary === 'object'
        ? (result.summary as Record<string, unknown>)
        : entrySummary;
    const currentDatasetId = String(
      result.derived_dataset_id ||
        result.saved_dataset_id ||
        nested?.dataset_id ||
        result.dataset_id ||
        entryRecord.derived_dataset_id ||
        ''
    ).trim();
    const parentIds = result.parent_dataset_ids;
    const firstParentId = Array.isArray(parentIds) ? String(parentIds[0] || '').trim() : '';
    const args = entry.args && typeof entry.args === 'object' ? entry.args : null;
    const previousDatasetId = String(
      result.parent_dataset_id ||
        nested?.parent_dataset_id ||
        firstParentId ||
        entryRecord.parent_dataset_id ||
        args?.parent_dataset_id ||
        ''
    ).trim();
    const operation = String(
      result.operation ||
        args?.operation ||
        args?.analysis_type ||
        entryRecord.procedure ||
        result.analysis_type ||
        entryRecord.producing_operation ||
        ''
    ).trim();
    const weightLabel = weightLabelFromResult(result, entryRecord);
    const fromMarkdown = stripMarkdownBold(
      String(result.answer_markdown || summary?.line || entryRecord.answer_markdown || '').trim()
    );
    const versionSwitched = Boolean(
      currentDatasetId && previousDatasetId && currentDatasetId !== previousDatasetId
    );
    // Need something the person can undo or at least read.
    if (!currentDatasetId && !previousDatasetId && !fromMarkdown && !operation && !weightLabel) {
      continue;
    }
    if (currentDatasetId && previousDatasetId && currentDatasetId === previousDatasetId) {
      if (!fromMarkdown && !operation && !weightLabel) continue;
    }

    const ids = {
      operation: operation || undefined,
      previousDatasetId: previousDatasetId || undefined,
      currentDatasetId: currentDatasetId || undefined,
    };

    // Weight + new file version: two readable rows (QA / Paper 9e pattern).
    if (isWeightVersionOperation(operation) && weightLabel && versionSwitched) {
      const weightChange: ChatTurnChange = {
        label: `New weight: ${weightLabel}`.slice(0, 160),
        ...ids,
      };
      const versionChange: ChatTurnChange = {
        label: 'File version switched',
        ...ids,
      };
      out.push(weightChange, versionChange);
      continue;
    }

    const label =
      (weightLabel ? `New weight: ${weightLabel}` : '') ||
      fromMarkdown ||
      (operation ? humanOperationLabel(operation) : '') ||
      'Edited the data';
    const change: ChatTurnChange = {
      label: label.slice(0, 160),
      ...ids,
    };
    if (changeOffersSeeDropped(change)) change.seeDropped = true;
    out.push(change);
  }
  return out;
}

/** True when Paper 9e should offer "See them" beside Undo (row removals). */
export function changeOffersSeeDropped(change: ChatTurnChange): boolean {
  const operation = (change.operation || '').toLowerCase();
  if (operation === 'filter_apply' || operation === 'filter') return true;
  return /\b(removed|dropped|exclud(?:e|ed|ing)?)\b/i.test(change.label);
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

/** True when a long run finished while the tab was hidden (away banner). */
export function chatRunFinishedWhileAway(opts: {
  /** Override for tests; defaults to document.hidden. */
  hidden?: boolean;
  startedAt?: number;
  minElapsedMs?: number;
  now?: number;
}): boolean {
  if (typeof window === 'undefined') return false;
  const hidden = opts.hidden ?? (typeof document !== 'undefined' ? document.hidden : false);
  if (!hidden) return false;
  const minElapsed = opts.minElapsedMs ?? LONG_RUN_MS;
  if (opts.startedAt != null) {
    const now = opts.now ?? Date.now();
    if (now - opts.startedAt < minElapsed) return false;
  }
  return true;
}

/**
 * Ask for desktop notification permission while the tab is visible (before a
 * long run finishes in the background).
 */
export function ensureChatNotificationPermission(): void {
  if (typeof window === 'undefined') return;
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'default') return;
  try {
    void Notification.requestPermission();
  } catch {
    /* ignore */
  }
}

/**
 * Browser notification when a long chat run finishes and the tab is in the
 * background. Returns true when a notification was shown (or a notify stub ran).
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
  if (!chatRunFinishedWhileAway(opts)) return false;

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
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
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
    // Prefer asking while visible via ensureChatNotificationPermission; still try.
    void Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        try {
          new Notification(opts.title, { body: opts.body, silent: false });
        } catch {
          /* ignore */
        }
      }
    });
    return false;
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
  const cleaned = operation
    .replace(/^weight:/i, '')
    .replace(/_/g, ' ')
    .trim();
  if (!cleaned) return 'Edited the data';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function stripMarkdownBold(text: string): string {
  return text.replace(/\*\*/g, '').replace(/^#+\s*/, '');
}
