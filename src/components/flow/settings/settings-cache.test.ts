import { createRequestCache } from './settings-cache';
import { initialLoad } from './use-load';

describe('settings request cache', () => {
  it('shares one in-flight request and reuses a fresh answer', async () => {
    let clock = 0;
    const cache = createRequestCache(() => clock);
    const load = jest.fn(async () => 'plans');
    const [a, b] = await Promise.all([cache.get('k', load), cache.get('k', load)]);
    expect([a, b]).toEqual(['plans', 'plans']);
    clock = 30_000;
    await cache.get('k', load, 60_000);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('keeps the old answer visible while a stale one refreshes', async () => {
    let clock = 0;
    const cache = createRequestCache(() => clock);
    await cache.get('k', async () => 1, 1000);
    clock = 5000;
    let finish: (value: number) => void = () => undefined;
    const next = cache.get('k', () => new Promise<number>(resolve => (finish = resolve)), 1000);
    expect(cache.peek('k')).toBe(1);
    finish(2);
    await next;
    expect(cache.peek('k')).toBe(2);
  });

  it('does not keep failures, and falls back to the last good answer', async () => {
    let clock = 0;
    const cache = createRequestCache(() => clock);
    await expect(cache.get('a', async () => Promise.reject(new Error('x')))).rejects.toThrow('x');
    expect(cache.peek('a')).toBeUndefined();
    const retry = jest.fn(async () => 'ok');
    await cache.get('a', retry);
    expect(retry).toHaveBeenCalledTimes(1);
    clock = 120_000;
    await expect(cache.get('a', async () => Promise.reject(new Error('y')))).rejects.toThrow('y');
    expect(cache.peek('a')).toBe('ok');
  });

  it('forgets matching keys only', async () => {
    const cache = createRequestCache(() => 0);
    await cache.get('plans', async () => 'p');
    await cache.get('ws:me', async () => 'm');
    cache.forget(key => key !== 'plans');
    expect(cache.peek('plans')).toBe('p');
    expect(cache.peek('ws:me')).toBeUndefined();
  });

  it('starts a screen ready when there is a cached answer', () => {
    expect(initialLoad(undefined)).toEqual({ phase: 'loading' });
    expect(initialLoad({ a: 1 })).toEqual({ phase: 'ready', data: { a: 1 } });
  });
});
