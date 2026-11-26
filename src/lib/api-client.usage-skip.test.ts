import { shouldSkipUsageTracking } from '@/lib/api-client';

describe('shouldSkipUsageTracking', () => {
  it('skips per-run analysis polls so they do not POST /usage/track', () => {
    expect(shouldSkipUsageTracking('/datasets/analysis-runs/run-abc')).toBe(true);
    expect(shouldSkipUsageTracking('/datasets/analysis-runs/run-abc/r-check')).toBe(true);
    expect(shouldSkipUsageTracking('/datasets/ds-1/runs')).toBe(true);
  });

  it('still tracks real user actions', () => {
    expect(shouldSkipUsageTracking('/datasets/ds-1/analyze')).toBe(false);
    expect(shouldSkipUsageTracking('/assistant/agent-loop')).toBe(false);
  });
});
