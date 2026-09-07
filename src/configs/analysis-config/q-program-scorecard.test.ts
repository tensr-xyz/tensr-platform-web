import { PRODUCTION_MENU_ITEMS } from './production-menu';
import { isDialogMenuItem, getMenuItemComponent } from './menu-registry';
import { ACCEPTED_UPLOAD_ACCEPT, isAcceptedUploadExtension } from '@/lib/accepted-upload-types';
import { DEFAULT_SUBSCRIPTION_PRICING } from '@/configs/pricing';

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
});
