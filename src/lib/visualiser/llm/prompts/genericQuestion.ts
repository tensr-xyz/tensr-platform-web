import type { ChatMessage } from '../webllmClient';
import type { SchemaSummary } from '@/utils/visualiser/schema-compute';

const SYSTEM_PROMPT = `You are a data analysis assistant. Suggest interesting analyses. No specific numbers, just ideas. Keep brief (2-3 suggestions).`;

export function buildGenericQuestionPrompt(
  schemaSummary: SchemaSummary,
  userQuestion: string
): ChatMessage[] {
  // Truncate summary if too long
  const summaryText =
    schemaSummary.summaryText.length > 300
      ? schemaSummary.summaryText.substring(0, 300) + '...'
      : schemaSummary.summaryText;

  const userPrompt = `Summary: ${summaryText}

Question: "${userQuestion}"

Suggest 2-3 analyses or charts to explore. Ideas only, no numbers.`;

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ];
}
