import { isRetiredFromUi, retiredFromUiUserMessage, RETIRED_FROM_UI_OPS } from './retired-from-ui';

describe('retired-from-ui', () => {
  it('flags the false-door ops removed from the workspace', () => {
    expect([...RETIRED_FROM_UI_OPS].sort()).toEqual(
      ['code_open_text', 'loglinear', 'mcnemar', 'stepwise_regression'].sort()
    );
    expect(isRetiredFromUi('mcnemar')).toBe(true);
    expect(isRetiredFromUi('latent_class_analysis')).toBe(false);
    expect(isRetiredFromUi('descriptives')).toBe(false);
    expect(isRetiredFromUi('reliability')).toBe(false);
  });

  it('names the procedure in the user-facing refusal', () => {
    expect(retiredFromUiUserMessage('mcnemar')).toMatch(/McNemar Test/);
    expect(retiredFromUiUserMessage('code_open_text')).toMatch(/Open-text coding/);
  });
});
