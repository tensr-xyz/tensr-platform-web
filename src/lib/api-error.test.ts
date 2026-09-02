import { ApiRequestError, formatApiErrorMessage } from './api-error';

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

  it('uses agent_loop_timeout detail message', () => {
    const err = new Error(
      'API Error: 504 - {"detail":{"error":"agent_loop_timeout","message":"This request hit the server time limit."}}'
    );
    expect(formatApiErrorMessage(err)).toBe('This request hit the server time limit.');
  });

  it('maps a bare API Gateway 503 body to a retry sentence, not raw JSON', () => {
    const err = new Error('{"message":"Service Unavailable"}');
    const shown = formatApiErrorMessage(err);
    expect(shown).not.toContain('{');
    expect(shown.toLowerCase()).toMatch(/unavailable|timed out|try again/);
  });

  it('maps ApiRequestError 503 the same way', () => {
    const shown = formatApiErrorMessage(
      new ApiRequestError(503, '{"message":"Service Unavailable"}')
    );
    expect(shown).not.toContain('{');
    expect(shown.toLowerCase()).toMatch(/unavailable|timed out|try again/);
  });

  it('shows the table fingerprint refuse paragraph, not a code object', () => {
    const paragraph =
      'This table was built against dataset ds-1 (fingerprint abcdef123456…). The current data no longer matches (fingerprint fedcba654321…). What changed: removed Male; added Non-binary. Options: rebuild a new spec against the current dataset version, or point this spec at the original DatasetVersion it was built against. The stored spec was not mutated.';
    const err = new Error(`{"detail":${JSON.stringify(paragraph)}}`);
    const shown = formatApiErrorMessage(err);
    expect(shown).toBe(paragraph);
    expect(shown).not.toMatch(/"code"/);
  });
});
