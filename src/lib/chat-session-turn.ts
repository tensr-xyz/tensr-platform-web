import type { AgentLoopResponse } from '@/lib/run-agent-loop';

export type StoredChatTurn = {
  user?: string;
  answer?: string;
  tool_results?: AgentLoopResponse['tool_results'];
  steps?: { name?: string; message?: string }[];
};

function turnHasAnswer(turn: StoredChatTurn): boolean {
  return Boolean((turn.answer || '').trim() || turn.tool_results?.length);
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
  alreadyAnswered = 0
): AgentLoopResponse | null {
  const asked = question.trim();
  if (!asked) return null;
  const answered = (turns || []).filter(
    turn => (turn.user || '').trim() === asked && turnHasAnswer(turn)
  );
  if (answered.length <= alreadyAnswered) return null;
  const match = answered[answered.length - 1];
  const answer = match.answer || '';
  const results = match.tool_results;
  const steps = (match.steps || []).flatMap(step => {
    const name = step.name || '';
    const message = step.message || '';
    return name || message ? [{ name, message }] : [];
  });
  return {
    status: 'ok',
    mode,
    answer_markdown: answer,
    session_id: undefined,
    tool_results: results,
    tool_trace: steps,
  };
}
