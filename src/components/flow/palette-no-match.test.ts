import { paletteNoMatchCopy } from './palette-no-match';

describe('palette no-match state', () => {
  it('says no analysis matches and offers the typed text to the agent', () => {
    expect(paletteNoMatchCopy('  bayesian thing ')).toEqual({
      message: 'No analysis matches “bayesian thing”. Press ⏎ to ask chat instead.',
      ask: 'bayesian thing',
    });
  });

  it('never says coming soon', () => {
    expect(paletteNoMatchCopy('x').message).not.toMatch(/coming soon/i);
    expect(paletteNoMatchCopy('').message).not.toMatch(/coming soon/i);
    expect(paletteNoMatchCopy('').ask).toBeNull();
  });
});
