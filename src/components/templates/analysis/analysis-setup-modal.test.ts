import { setupFormKind } from './analysis-setup-modal';

describe('setup form kind', () => {
  it('shows no form until the catalog settles, so Run cannot swap forms', () => {
    expect(setupFormKind('loading', false)).toBe('loading');
    expect(setupFormKind('loading', true)).toBe('loading');
    expect(setupFormKind('ready', true, true)).toBe('loading');
  });

  it('uses the spec form only when the catalog is ready and has the op', () => {
    expect(setupFormKind('ready', true)).toBe('spec');
    expect(setupFormKind('ready', false)).toBe('legacy');
    expect(setupFormKind('failed', true)).toBe('legacy');
  });
});
