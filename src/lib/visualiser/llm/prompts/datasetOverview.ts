import type { ChatMessage } from '../webllmClient';
import type { SchemaSummary } from '@/utils/visualiser/schema-compute';

const SYSTEM_PROMPT = `You are a data analysis assistant. Describe datasets clearly in plain English. Never invent numbers. Keep responses to 3-5 bullet points.`;

export function buildDatasetOverviewPrompt(schemaSummary: SchemaSummary): ChatMessage[] {
  // Truncate summary if too long (limit to ~500 chars to stay within context)
  const summaryText =
    schemaSummary.summaryText.length > 500
      ? schemaSummary.summaryText.substring(0, 500) + '...'
      : schemaSummary.summaryText;

  const userPrompt = `Dataset summary: ${summaryText}

Describe in 3-5 bullet points for a non-technical user. Mention typical values and potential analyses. Use only provided information.`;

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ];
}
