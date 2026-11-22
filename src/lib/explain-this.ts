/**
 * Build the Paper 10g "Explain this" panel from fields already on the result.
 * Never invents numbers — only rearranges lead, checks, and footnote copy.
 */

export type ExplainThisSection = {
  label: string;
  body: string;
};

export type ExplainThisPanelModel = {
  title: string;
  sections: ExplainThisSection[];
  basedOn: string;
  markdown: string;
  chatPrompt: string;
  reportNotePrompt: string;
};

function clean(text: string | null | undefined): string {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstSentence(text: string): string {
  const trimmed = clean(text);
  if (!trimmed) return '';
  const match = trimmed.match(/^(.+?[.!?])(?:\s|$)/);
  return match ? match[1] : trimmed;
}

function warnChecks(checks: string[] | undefined): string[] {
  return (checks || [])
    .map(check => clean(check))
    .filter(Boolean)
    .filter(check => /low base|warn|care|few|small|missing|outlier|vif|assumption/i.test(check));
}

/** Prefer warn-like checks; otherwise any check lines. */
export function careLinesFromChecks(checks: string[] | undefined): string[] {
  const warn = warnChecks(checks);
  if (warn.length) return warn;
  return (checks || []).map(check => clean(check)).filter(Boolean);
}

export function buildExplainThisPanel(input: {
  title?: string;
  lead?: string;
  footnote?: string;
  checks?: string[];
  baseNote?: string;
}): ExplainThisPanelModel {
  const title = clean(input.title) || 'This output';
  const lead = clean(input.lead);
  const footnote = clean(input.footnote);
  const baseNote = clean(input.baseNote);
  const care = careLinesFromChecks(input.checks);

  // Lead is the finding. "What it shows" stays a short title gloss so we never
  // invent a measure description the run did not return.
  const shows = `Results for “${title}”.`;
  const standsOut = lead || 'No highlight was returned with this run.';
  const careBody = care.length ? care.join(' ') : 'No method warnings were flagged on this output.';
  const basedOnRaw = [footnote, baseNote].filter(Boolean).join(' · ');
  const basedOn = basedOnRaw
    ? basedOnRaw.startsWith('Based on')
      ? basedOnRaw
      : `Based on: ${basedOnRaw}`
    : 'Based on: the figures in this run.';

  const sections: ExplainThisSection[] = [
    { label: 'What it shows', body: shows },
    { label: 'What stands out', body: standsOut },
    { label: 'Read with care', body: careBody },
  ];

  const markdown = [
    ...sections.map(section => `**${section.label}:** ${section.body}`),
    basedOn,
  ].join('\n\n');

  return {
    title,
    sections,
    basedOn,
    markdown,
    chatPrompt: `About “${title}”: ${firstSentence(standsOut)} What else should I check?`,
    reportNotePrompt: `Add this explanation to the report as a note under “${title}”:\n\n${markdown}`,
  };
}

/** Seed the chat composer and open the project chat tab. */
export function seedChatDraft(projectId: string, prompt: string): string {
  const text = clean(prompt);
  if (!projectId || !text || typeof window === 'undefined') return '';
  try {
    window.sessionStorage.setItem(`tensr-chat-draft:${projectId}`, text);
  } catch {
    // Composer opens empty if storage is unavailable.
  }
  return `/flow/p/${projectId}/chat`;
}
