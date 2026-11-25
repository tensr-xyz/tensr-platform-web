import { shouldRetryProjectQuery } from './use-project-data';

describe('shouldRetryProjectQuery', () => {
  it('retries a 5xx once, then stops', () => {
    const err = Object.assign(new Error('Tensr could not load this right now.'), { status: 500 });
    expect(shouldRetryProjectQuery(0, err)).toBe(true);
    expect(shouldRetryProjectQuery(1, err)).toBe(false);
  });

  it('never retries a 4xx', () => {
    const err = Object.assign(new Error('Project not found'), { status: 404 });
    expect(shouldRetryProjectQuery(0, err)).toBe(false);
  });
});
