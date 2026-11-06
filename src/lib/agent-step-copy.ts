/** A step the person can read. Internal tool names and filler stay out of the list. */

const HIDDEN = new Set([
  'warming',
  'warm',
  'finish',
  'get result',
  'get_result',
  'set requirements',
  'set_requirements',
  'resume',
  'tool',
  'continuing',
  'ask user',
  'ask_user',
]);

const FILLER =
  /^(warming up|thinking…|thinking\.\.\.|continuing this turn|running finish|running get result|running set requirements|running warming)$/i;

const PLAIN: Record<string, string> = {
  'run analysis': 'Ran the analysis',
  'read data': 'Read the open file',
  'data edit': 'Edited the data',
  'import file': 'Imported a file',
  'ask clarifying question': 'Asked a question',
  'banner table': 'Built a table',
  descriptives: 'Summarised the columns',
  frequencies: 'Counted the values',
  'ttest independent': 'Compared two groups',
  'chi square': 'Tested the table',
  'linear regression': 'Fitted a regression',
  regression: 'Fitted a regression',
  'code open text': 'Coded the open answers',
  compute: 'Computed a new column',
};

export function visibleAgentStep(
  step: string | undefined,
  message: string | undefined
): string | null {
  const rawStep = (step || '').trim().toLowerCase().replace(/_/g, ' ');
  const rawMessage = (message || '').trim();
  if (!rawStep && !rawMessage) return null;
  if (FILLER.test(rawMessage) || HIDDEN.has(rawStep)) return null;
  if (PLAIN[rawStep] && (!rawMessage || rawMessage.toLowerCase() === rawStep))
    return PLAIN[rawStep];
  if (PLAIN[rawMessage.toLowerCase()]) return PLAIN[rawMessage.toLowerCase()];
  if (rawMessage && !/^running\s+/i.test(rawMessage)) return rawMessage;
  const fromRunning = rawMessage
    .replace(/^running\s+/i, '')
    .trim()
    .toLowerCase();
  const name = rawStep && !HIDDEN.has(rawStep) ? rawStep : fromRunning;
  if (!name || HIDDEN.has(name)) return null;
  return PLAIN[name] || null;
}
