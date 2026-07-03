import type { ChatMessage } from '../webllmClient';
import type { SchemaSummary } from '@/utils/visualiser/schema-compute';

const SYSTEM_PROMPT = `You are a data visualization assistant. Choose useful charts and explain them. Output JSON only.`;

export interface ChartCandidate {
  id: string;
  type: string;
  x?: string;
  y?: string;
  breakdown?: string;
}

export interface EnhancedChart {
  id: string;
  niceTitle: string;
  niceReason: string;
}

export function buildChartSuggestionsPrompt(
  schemaSummary: SchemaSummary,
  candidates: ChartCandidate[]
): ChatMessage[] {
  // Limit candidates to top 10 to reduce prompt size
  const limitedCandidates = candidates.slice(0, 10);
  const candidatesText = limitedCandidates
    .map((c, i) => {
      const parts = [`${i + 1}. id=${c.id}`, `type=${c.type}`];
      if (c.x) parts.push(`x=${c.x}`);
      if (c.y) parts.push(`y=${c.y}`);
      if (c.breakdown) parts.push(`breakdown=${c.breakdown}`);
      return parts.join(', ');
    })
    .join('\n');

  // Truncate summary if too long
  const summaryText =
    schemaSummary.summaryText.length > 300
      ? schemaSummary.summaryText.substring(0, 300) + '...'
      : schemaSummary.summaryText;

  const userPrompt = `Summary: ${summaryText}

Charts: ${candidatesText}

Pick up to 5 most useful charts. Return JSON only:
[{"id": "id", "niceTitle": "title", "niceReason": "reason"}]`;

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ];
}
