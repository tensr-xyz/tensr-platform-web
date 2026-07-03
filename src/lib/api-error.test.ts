import { formatApiErrorMessage } from './api-error';

describe('formatApiErrorMessage', () => {
  it('maps assistant plan 402 to friendly text', () => {
    const err = new Error(
      'API Error: 402 - {"detail":{"error":"ai_assistant_not_in_plan","message":"Upgrade to Pro","plan_code":"none"}}'
    );
    expect(formatApiErrorMessage(err)).toContain('Upgrade to **Pro**');
  });

  it('uses detail.message when present', () => {
    const err = new Error('API Error: 400 - {"detail":"Bad request"}');
    expect(formatApiErrorMessage(err)).toBe('Bad request');
  });

  it('handles plain errors', () => {
    expect(formatApiErrorMessage(new Error('Network failed'))).toBe('Network failed');
  });
});
