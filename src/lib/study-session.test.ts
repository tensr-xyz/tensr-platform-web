import { bearerWhenReady, studyRowText } from './study-session';

describe('study session', () => {
  it('waits for the session token instead of sending an empty bearer', async () => {
    jest.useFakeTimers();
    let token = '';
    const pending = bearerWhenReady(() => token, 5);
    await jest.advanceTimersByTimeAsync(100);
    token = 'session-jwt';
    await jest.advanceTimersByTimeAsync(100);
    await expect(pending).resolves.toBe('session-jwt');
    jest.useRealTimers();
  });

  it('labels a study with its dataset count and updated time', () => {
    const text = studyRowText({
      name: 'Brand tracker',
      dataset_count: 2,
      updated_at: '2026-10-29T11:00:00.000Z',
    });
    expect(text.startsWith('Brand tracker · 2 datasets · ')).toBe(true);
  });
});
