import {
  clearSessionMe,
  getSessionMe,
  peekSessionMe,
  sessionMeWorkspaceKey,
} from './session-me-cache';

describe('sessionMeCache', () => {
  beforeEach(() => {
    clearSessionMe();
    window.localStorage.removeItem('activeOrganizationId');
  });

  it('dedupes concurrent loaders for the same workspace into one network call', async () => {
    let loads = 0;
    const load = () => {
      loads += 1;
      return Promise.resolve({ user_id: 'u1', entitlements: { plan_code: 'pro' } });
    };
    const [a, b, c] = await Promise.all([
      getSessionMe(load),
      getSessionMe(load),
      getSessionMe(load),
    ]);
    expect(loads).toBe(1);
    expect(a.user_id).toBe('u1');
    expect(b).toBe(a);
    expect(c).toBe(a);
    expect(peekSessionMe()).toEqual(a);
  });

  it('keeps separate caches per workspace and does not cross-talk', async () => {
    const personal = await getSessionMe(() => Promise.resolve({ org: 'personal' }), {
      workspaceKey: 'personal',
    });
    const team = await getSessionMe(() => Promise.resolve({ org: 'team-9' }), {
      workspaceKey: 'team-9',
    });
    expect(personal.org).toBe('personal');
    expect(team.org).toBe('team-9');
    expect(peekSessionMe('personal')).toEqual(personal);
    expect(peekSessionMe('team-9')).toEqual(team);
  });

  it('force joins an in-flight load but refreshes after settle', async () => {
    let resolveFirst!: (value: { n: number }) => void;
    let loads = 0;
    const slow = new Promise<{ n: number }>(resolve => {
      resolveFirst = resolve;
    });
    const firstPromise = getSessionMe(() => {
      loads += 1;
      return slow;
    });
    const joined = getSessionMe(
      () => {
        loads += 1;
        return Promise.resolve({ n: 99 });
      },
      { force: true }
    );
    resolveFirst({ n: 1 });
    await expect(firstPromise).resolves.toEqual({ n: 1 });
    await expect(joined).resolves.toEqual({ n: 1 });
    expect(loads).toBe(1);

    const refreshed = await getSessionMe(
      () => {
        loads += 1;
        return Promise.resolve({ n: 2 });
      },
      { force: true }
    );
    expect(refreshed).toEqual({ n: 2 });
    expect(loads).toBe(2);
  });

  it('clearSessionMe drops settled entries so the next sign-in reloads', async () => {
    await getSessionMe(() => Promise.resolve({ user_id: 'before' }));
    clearSessionMe();
    expect(peekSessionMe()).toBeUndefined();
    const again = await getSessionMe(() => Promise.resolve({ user_id: 'after' }));
    expect(again.user_id).toBe('after');
  });

  it('sessionMeWorkspaceKey reads the active organisation or personal', () => {
    expect(sessionMeWorkspaceKey()).toBe('personal');
    window.localStorage.setItem('activeOrganizationId', 'org-abc');
    expect(sessionMeWorkspaceKey()).toBe('org-abc');
  });
});
