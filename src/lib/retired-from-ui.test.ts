import { isRetiredFromUi, retiredFromUiUserMessage, RETIRED_FROM_UI_OPS } from './retired-from-ui';

describe('retired-from-ui', () => {
  it('has no retired ops after full-catalog restore', () => {
    expect([...RETIRED_FROM_UI_OPS]).toEqual([]);
    expect(isRetiredFromUi('mcnemar')).toBe(false);
    expect(isRetiredFromUi('stepwise_regression')).toBe(false);
    expect(isRetiredFromUi('loglinear')).toBe(false);
    expect(isRetiredFromUi('code_open_text')).toBe(false);
    expect(isRetiredFromUi('latent_class_analysis')).toBe(false);
  });

  it('still formats a user-facing message for historical refusals', () => {
    expect(retiredFromUiUserMessage('mcnemar')).toMatch(/McNemar Test/);
    expect(retiredFromUiUserMessage('code_open_text')).toMatch(/Open-text coding/);
  });
});
