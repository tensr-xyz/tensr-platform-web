/**
 * Q-page procedures shared by the production menu, chat gate, and agent loop.
 * Keep labels in lockstep with tensr-api/app/q_program_catalog.py.
 */

export type QProcedure = {
  menuLabel: string;
  analysisType: string | null;
  chatPhrases: readonly string[];
  dialogOnly?: boolean;
};

export const Q_PROCEDURES: readonly QProcedure[] = [
  {
    menuLabel: 'Custom Tables',
    analysisType: 'banner_table',
    chatPhrases: ['custom tables', 'crosstab', 'cross tab', 'banner table'],
  },
  {
    menuLabel: 'Batch Tables',
    analysisType: 'batch_tables',
    chatPhrases: ['batch tables', 'smart tables'],
  },
  {
    menuLabel: 'Rake Weights',
    analysisType: 'rake',
    chatPhrases: ['rake weights', 'rake the sample', 'raking'],
  },
  {
    menuLabel: 'Fuse Waves',
    analysisType: null,
    chatPhrases: ['fuse waves', 'fuse datasets'],
    dialogOnly: true,
  },
  {
    menuLabel: 'Open-text coding',
    analysisType: 'code_open_text',
    chatPhrases: ['open-text coding', 'code the comments', 'thematic coding'],
  },
  {
    menuLabel: 'TURF',
    analysisType: 'turf',
    chatPhrases: ['turf', 'reach and frequency'],
  },
  {
    menuLabel: 'Driver Analysis',
    analysisType: 'drivers',
    chatPhrases: ['driver analysis', 'key drivers'],
  },
  {
    menuLabel: 'Correspondence Analysis',
    analysisType: 'correspondence',
    chatPhrases: ['correspondence analysis'],
  },
  {
    menuLabel: 'Van Westendorp',
    analysisType: 'van_westendorp',
    chatPhrases: ['van westendorp', 'price sensitivity meter'],
  },
  {
    menuLabel: 'Gabor-Granger',
    analysisType: 'gabor_granger',
    chatPhrases: ['gabor-granger', 'gabor granger'],
  },
  {
    menuLabel: 'NPS',
    analysisType: 'nps',
    chatPhrases: ['nps', 'net promoter'],
  },
  {
    menuLabel: 'Brand Funnel',
    analysisType: 'funnel',
    chatPhrases: ['brand funnel'],
  },
  {
    menuLabel: 'MaxDiff (counting / MNL)',
    analysisType: 'maxdiff_count',
    chatPhrases: ['maxdiff', 'max diff', 'best worst'],
  },
  {
    menuLabel: 'Conjoint (MNL)',
    analysisType: 'conjoint_mnl',
    chatPhrases: ['conjoint', 'choice-based conjoint', 'cbc'],
  },
] as const;

export const Q_AGENT_ANALYSIS_TYPES = new Set<string>([
  ...Q_PROCEDURES.filter(p => p.analysisType && !p.dialogOnly).map(p => p.analysisType as string),
  'maxdiff_mnl',
  'choice_simulator',
]);

export function isQAgentAnalysisType(op: string | null | undefined): boolean {
  return !!op && Q_AGENT_ANALYSIS_TYPES.has(op);
}

export const Q_CHAT_SYNONYMS: Record<string, string> = Object.fromEntries(
  Q_PROCEDURES.flatMap(proc => proc.chatPhrases.map(phrase => [phrase, proc.menuLabel]))
);
