import { PRODUCTION_MENU_ITEMS } from './production-menu';
import { isDialogMenuItem, getMenuItemComponent } from './menu-registry';
import { ACCEPTED_UPLOAD_ACCEPT, isAcceptedUploadExtension } from '@/lib/accepted-upload-types';
import { DEFAULT_SUBSCRIPTION_PRICING } from '@/configs/pricing';
import { Q_PROCEDURES, isQAgentAnalysisType } from './q-program-catalog';
import { resolveChatAction } from '@/lib/chat-actions';
import { resolveGateInOrder } from '@/lib/resolve-agent-gate';
import { isAgentRunnableAnalysisType } from '@/lib/run-agent-analysis-plan';

const REQUIRED_DIALOGS = [
  'Custom Tables',
  'Batch Tables',
  'Rake Weights',
  'Fuse Waves',
  'Open-text coding',
  'TURF',
  'Driver Analysis',
  'Correspondence Analysis',
  'Van Westendorp',
  'Gabor-Granger',
  'NPS',
  'Brand Funnel',
  'MaxDiff (counting / MNL)',
  'Conjoint (MNL)',
];

function flattenMenuLabels(): string[] {
  const labels: string[] = [];
  for (const item of Object.values(PRODUCTION_MENU_ITEMS)) {
    for (const names of Object.values(item.sections)) {
      labels.push(...names);
    }
  }
  return labels;
}

describe('Q-page + billing scorecard (UI is wired)', () => {
  it('puts every new Q procedure on the production menu as a real dialog', () => {
    const labels = flattenMenuLabels();
    for (const name of REQUIRED_DIALOGS) {
      expect(labels).toContain(name);
      expect(isDialogMenuItem(name)).toBe(true);
      expect(getMenuItemComponent(name)).not.toBeNull();
    }
  });

  it('accepts SPSS, Stata, and Triple-S uploads', () => {
    expect(isAcceptedUploadExtension('wave.sav')).toBe(true);
    expect(isAcceptedUploadExtension('wave.dta')).toBe(true);
    expect(isAcceptedUploadExtension('wave.sss')).toBe(true);
    expect(ACCEPTED_UPLOAD_ACCEPT).toContain('.sav');
  });

  it('does not put referral copy on the pricing catalogue', () => {
    const blob = JSON.stringify(DEFAULT_SUBSCRIPTION_PRICING).toLowerCase();
    expect(blob).not.toMatch(/referral|refer a friend|TENSR-/i);
  });

  it('maps Q chat phrases to their dialog, except banner tables which stay in the agent', () => {
    // Banner / crosstab / custom-tables asks run through banner_table.
    // Opening the empty Custom Tables dialog would drop that request.
    const agentTableGates: Record<string, 'tutor' | 'analysis-question'> = {
      'custom tables': 'tutor',
      crosstab: 'analysis-question',
      'cross tab': 'tutor',
      'banner table': 'tutor',
    };
    // The production menu has its own Fuse Datasets dialog, so that phrase
    // opens it instead of the Fuse Waves catalog label.
    const dialogLabel: Record<string, string> = {
      'fuse datasets': 'Fuse Datasets',
    };
    for (const proc of Q_PROCEDURES) {
      expect(isDialogMenuItem(proc.menuLabel)).toBe(true);
      for (const phrase of proc.chatPhrases) {
        const message = `run ${phrase}`;
        const action = resolveChatAction(message);
        const agentGate = agentTableGates[phrase];
        if (agentGate) {
          expect(action).toEqual({ kind: 'chat' });
          expect(resolveGateInOrder(message)).toBe(agentGate);
        } else {
          expect(action).toEqual({
            kind: 'dialog',
            menuName: dialogLabel[phrase] ?? proc.menuLabel,
          });
          expect(resolveGateInOrder(message)).toBe('menu-dialog');
        }
      }
    }
  });

  it('lets the agent execute Q analysis types instead of dropping the plan', () => {
    expect(isQAgentAnalysisType('nps')).toBe(true);
    expect(isQAgentAnalysisType('maxdiff_count')).toBe(true);
    expect(isQAgentAnalysisType('fuse_waves')).toBe(true);
    expect(isQAgentAnalysisType('mcnemar')).toBe(false);
    expect(isAgentRunnableAnalysisType('nps')).toBe(true);
    expect(isAgentRunnableAnalysisType('maxdiff_mnl')).toBe(true);
    expect(isAgentRunnableAnalysisType('choice_simulator')).toBe(true);
    expect(isAgentRunnableAnalysisType('made_up_test')).toBe(false);
  });
});
