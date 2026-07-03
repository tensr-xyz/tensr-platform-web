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
