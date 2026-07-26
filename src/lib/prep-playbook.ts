import { apiClient } from '@/lib/api-client';
import type {
  ChatPendingAction,
  PlaybookProposedAction,
  PrepPlaybookStep,
} from '@/lib/chat-pending-action';
import type { AgentAnalysisHistoryEntry } from '@/stores/tabs-store';

export const PREP_PLAYBOOK_STEPS: PrepPlaybookStep[] = [
  'missing_data',
  'duplicates',
  'outliers',
  'type_fix',
];

export type PlaybookStepResult = {
  step: PrepPlaybookStep;
  step_index: number;
  total_steps: number;
  title: string;
  status: 'issue_found' | 'clean';
  summary: string;
  details: string[];
  proposed_action: PlaybookProposedAction | null;
  is_last_step: boolean;
  stats?: Record<string, unknown>;
};

// Mirrors app/assistant/prep_playbook.py's _TRIGGER_RE — kept in sync so the panel can
// start the playbook instantly (no network round trip) for obvious asks, the same way
// shouldRouteMessageToDataIntent() short-circuits parse-intent for spreadsheet asks.
// The backend still recognises the same phrases via parse-intent for any other caller.
const TRIGGER_RE =
  /\b(clean(?:\s+up)?\s+(?:this|the|my)?\s*(?:dataset|data)|prepare\s+(?:this|the|my)?\s*(?:dataset|data)|prep\s+(?:this|the|my)?\s*(?:dataset|data)|wrangle(?:\s+(?:this|the|my)?\s*(?:dataset|data))?|data\s+prep(?:aration)?|tidy\s+up\s+(?:this|the|my)?\s*(?:dataset|data))\b/i;

export function isPrepPlaybookTrigger(message: string): boolean {
  const text = (message || '').trim();
  if (!text) return false;
  return TRIGGER_RE.test(text);
}

export async function fetchPlaybookStep(
  datasetId: string,
  step?: PrepPlaybookStep
): Promise<PlaybookStepResult> {
  return apiClient.assistant.prepPlaybookStep({ datasetId, step: step ?? null });
}

export async function applyPlaybookProposedAction(
  action: PlaybookProposedAction
): Promise<Record<string, unknown>> {
  return apiClient.assistant.applyPlaybookAction(action);
}

export function nextPlaybookStep(step: PrepPlaybookStep): PrepPlaybookStep | null {
  const idx = PREP_PLAYBOOK_STEPS.indexOf(step);
  if (idx < 0 || idx === PREP_PLAYBOOK_STEPS.length - 1) return null;
  return PREP_PLAYBOOK_STEPS[idx + 1];
}

/** Human-readable, grounded (numbers pulled from the actual response) log line for a
 *  completed playbook step, used in chat and fed into the closing synthesize-report call. */
export function describePlaybookApplyResult(
  action: Extract<ChatPendingAction, { kind: 'prep_playbook' }>,
  result: Record<string, unknown>
): string {
  const rows = typeof result.n_rows === 'number' ? result.n_rows : undefined;
  const rowsSuffix = rows !== undefined ? ` Dataset now has ${rows} row(s).` : '';
  switch (action.step) {
    case 'missing_data': {
      const n =
        typeof result.replaced_values_count === 'number' ? result.replaced_values_count : undefined;
      return `${action.title}: imputed ${n ?? 'the flagged'} missing value(s).${rowsSuffix}`;
    }
    case 'duplicates': {
      const n =
        typeof result.removed_rows_count === 'number' ? result.removed_rows_count : undefined;
      return `${action.title}: removed ${n ?? 'the'} duplicate row(s).${rowsSuffix}`;
    }
    case 'outliers': {
      const method = (action.proposedAction?.body?.method as string | undefined) ?? 'cap';
      const cols = (action.proposedAction?.body?.columns as string[] | undefined)?.length ?? 0;
      if (method === 'remove') {
        const before = typeof result.rows_before === 'number' ? result.rows_before : undefined;
        const after = typeof result.rows_after === 'number' ? result.rows_after : rows;
        const removed = before !== undefined && after !== undefined ? before - after : undefined;
        return `${action.title}: removed ${removed ?? 'the'} outlier row(s) across ${cols} column(s).${rowsSuffix}`;
      }
      if (method === 'flag') {
        return `${action.title}: flagged outliers in ${cols} column(s) with new "_outlier" indicator columns.${rowsSuffix}`;
      }
      return `${action.title}: capped outlier values to the IQR bounds in ${cols} column(s).${rowsSuffix}`;
    }
    case 'type_fix': {
      const casts =
        (action.proposedAction?.body?.casts as
          | Array<{ name: string; target_type: string }>
          | undefined) ?? [];
      const names = casts.map(c => `${c.name} → ${c.target_type}`).join(', ');
      return `${action.title}: applied types${names ? ` (${names})` : ''}.${rowsSuffix}`;
    }
    default:
      return `${action.title}: applied.${rowsSuffix}`;
  }
}

/** Minimal AnalysisReport-shaped payload so the closing narrative can reuse the existing
 *  /assistant/synthesize-report endpoint (Track C step 3) instead of a bespoke writer.
 *
 *  When `analysisEntries` (the tab's `analysisHistory` — real completed runs, e.g.
 *  regression/ANOVA/correlations, with their actual result summaries) is non-empty, the
 *  closing narrative covers prep AND those analyses instead of prep alone. Each entry's
 *  `content` is the grounded assistant-markdown already produced from real results when
 *  that run completed, so folding it in here doesn't introduce any unfounded claims. With
 *  no analyses, this falls back to the original prep-only report untouched. */
export function buildPrepPlaybookReport(
  logEntries: string[],
  triggerMessage: string,
  analysisEntries: AgentAnalysisHistoryEntry[] = []
): Record<string, unknown> {
  const hasAnalyses = analysisEntries.length > 0;
  const analysisLines = analysisEntries.map(entry => {
    const label = entry.subtitle ? `${entry.analysisType} (${entry.subtitle})` : entry.analysisType;
    return `${label}: ${entry.content}`.trim();
  });

  const analysisLog = hasAnalyses
    ? [...logEntries, '', '--- Analyses run on this dataset ---', ...analysisLines].join('\n')
    : logEntries.join('\n');

  const summary = hasAnalyses
    ? logEntries.length
      ? `Completed an automated data-prep pass across ${logEntries.length} step(s), followed by ${analysisEntries.length} analysis run(s) on the cleaned dataset.`
      : `Automated data-prep pass completed with no changes needed; ${analysisEntries.length} analysis run(s) were carried out on this dataset.`
    : logEntries.length
      ? `Completed an automated data-prep pass across ${logEntries.length} step(s).`
      : 'Automated data-prep pass completed with no changes needed.';

  return {
    meta: {
      title: hasAnalyses ? 'Data preparation and analysis summary' : 'Data preparation summary',
      analysis_key: 'data_prep_playbook',
    },
    summary,
    interpretation: triggerMessage,
    analysis_log: analysisLog,
    metrics: analysisEntries.map(entry => ({
      label: entry.analysisType,
      value: entry.subtitle || entry.content.slice(0, 160),
    })),
    trust: { notes: hasAnalyses ? [...logEntries, ...analysisLines] : logEntries },
  };
}
