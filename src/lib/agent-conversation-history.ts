/** Recent chat turns sent to tensr-api assistant routes for thread continuity. */

export type AgentConversationTurn = {
  role: 'user' | 'assistant';
  content: string;
};

export function buildAgentConversationHistory(
  messages: Array<{ role: string; content: string }>,
  limit = 8
): AgentConversationTurn[] {
  return messages
    .slice(-limit)
    .map(m => ({
      role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: (m.content ?? '').trim(),
    }))
    .filter(m => m.content.length > 0);
}

export function isAnalysisFollowUpQuestion(
  message: string,
  priorMessages: Array<{ role: string; content: string }>
): boolean {
  if (
    !/(recommend|suggest|which (column|variable|one|numeric)|what would you|should i use|you specify|would you pick)/i.test(
      message
    )
  ) {
    return false;
  }
  const blob = [...priorMessages, { role: 'user', content: message }]
    .map(m => m.content)
    .join('\n')
    .toLowerCase();
  return /t-test|ttest|t test|anova|compare|group|outcome|independent-samples/.test(blob);
}

/**
 * After a missing-column clarification, a short reply like "Tm" / "use Tm" should
 * re-enter parse-intent (with history) instead of the followup tutor.
 */
export function isAnalysisColumnClarificationReply(
  message: string,
  priorMessages: Array<{ role: string; content: string }>,
  schemaColumnNames: string[] = []
): boolean {
  const trimmed = message.trim();
  if (!trimmed || trimmed.length > 64) return false;

  const lastAssistant = [...priorMessages].reverse().find(m => m.role === 'assistant');
  if (
    !lastAssistant ||
    !/couldn't find columns|available (numeric |group\/category )?columns|did you mean/i.test(
      lastAssistant.content
    )
  ) {
    return false;
  }

  const candidate = trimmed
    .replace(/^(use|try|its|it's|column|the column)\s+/i, '')
    .replace(/[.!?]+$/g, '')
    .trim();
  if (!candidate || candidate.split(/\s+/).length > 3) return false;

  if (schemaColumnNames.length > 0) {
    const lower = candidate.toLowerCase();
    return schemaColumnNames.some(name => name.toLowerCase() === lower);
  }

  return /^[\w%.]+$/i.test(candidate);
}
