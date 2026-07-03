import type { ChatMessage } from '../webllmClient';

const SYSTEM_PROMPT = `You are a careful data analyst. You are given pre-computed statistics.
You MUST NOT invent or alter numbers. Only describe patterns and comparisons.
Keep responses to 2-4 sentences.`;

export function buildQAAboutDataPrompt(userQuestion: string, statsText: string): ChatMessage[] {
  const userPrompt = `${statsText}

Answer the user's question: "${userQuestion}"

Answer in 2-4 sentences.
Do not introduce any new numbers or percentages.
Only use the statistics provided above.`;

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ];
}
