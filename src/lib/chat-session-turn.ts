import { EMPTY_TURN_ANSWER, resultLead } from '@/components/flow/chat-output';
import type { AgentLoopResponse } from '@/lib/run-agent-loop';

export type StoredChatTurn = {
  user?: string;
  answer?: string;
  tool_results?: AgentLoopResponse['tool_results'];
  steps?: { name?: string; message?: string }[];
};

/** Session GET may include a held plan when the stream went quiet mid-approval. */
export type StoredChatSession = {
  session_id?: string;
  turns?: StoredChatTurn[];
  status?: string;
  pending_approvals?: AgentLoopResponse['pending_approvals'];
  answer_markdown?: string;
};

function turnHasAnswer(turn: StoredChatTurn): boolean {
  return Boolean((turn.answer || '').trim() || turn.tool_results?.length);
}

/**
 * Text shown when reopening a chat. Prefer the stored reply; if it was lost,
 * use the result lead so a finished analysis is not "did not finish".
 */
export function restoredChatAnswer(turn: StoredChatTurn | undefined): string {
  if (!turn) return '';
  const stored = (turn.answer || '').trim();
  if (stored && stored !== EMPTY_TURN_ANSWER) return stored;
  const salvaged = resultLead(stored || '', turn.tool_results).trim();
  if (salvaged) return salvaged;
  if (stored) return stored;
  return turn.steps?.length ? EMPTY_TURN_ANSWER : '';
}

/** How many saved turns already answered this question. */
export function answeredTurnCount(turns: StoredChatTurn[] | undefined, question: string): number {
  const asked = question.trim();
  if (!asked) return 0;
  return (turns || []).filter(turn => (turn.user || '').trim() === asked && turnHasAnswer(turn))
    .length;
}

/**
 * The saved turn for this question, once a new answer is stored.
 * `alreadyAnswered` is the number of earlier replies to the same question.
 */
export function savedChatTurn(
  turns: StoredChatTurn[] | undefined,
  question: string,
  mode: AgentLoopResponse['mode'],
  alreadyAnswered = 0,
  session?: Pick<StoredChatSession, 'status' | 'pending_approvals' | 'answer_markdown'> | null
): AgentLoopResponse | null {
  const asked = question.trim();
  if (!asked) return null;
  const answered = (turns || []).filter(
    turn => (turn.user || '').trim() === asked && turnHasAnswer(turn)
  );
  const pending =
    session?.status === 'awaiting_approval' && session.pending_approvals
      ? session.pending_approvals
      : null;
  // A held plan may have no finished assistant answer yet — still recover Approve.
  if (pending && answered.length <= alreadyAnswered) {
    const lastAsk = (turns || []).filter(turn => (turn.user || '').trim() === asked).at(-1);
    if (lastAsk || alreadyAnswered === 0) {
      return {
        status: 'awaiting_approval',
        mode,
        answer_markdown: String(session?.answer_markdown || '').trim(),
        session_id: undefined,
        pending_approvals: pending,
        tool_results: lastAsk?.tool_results,
      };
    }
  }
  if (answered.length <= alreadyAnswered) return null;
  const match = answered[answered.length - 1]!;
  const results = match.tool_results;
  const steps = (match.steps || []).flatMap(step => {
    const name = step.name || '';
    const message = step.message || '';
    return name || message ? [{ name, message }] : [];
  });
  if (pending) {
    return {
      status: 'awaiting_approval',
      mode,
      answer_markdown: String(session?.answer_markdown || restoredChatAnswer(match)).trim(),
      session_id: undefined,
      pending_approvals: pending,
      tool_results: results,
      tool_trace: steps,
    };
  }
  return {
    status: 'ok',
    mode,
    answer_markdown: restoredChatAnswer(match),
    session_id: undefined,
    tool_results: results,
    tool_trace: steps,
  };
}
