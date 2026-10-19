import { resolveAgentVersion } from './agent-version';

describe('resolveAgentVersion', () => {
  it('reads the user when the workspace is personal', () => {
    expect(
      resolveAgentVersion({
        isPersonalAccount: true,
        userAgentVersion: 'v2',
        organizationAgentVersion: 'v1',
      })
    ).toBe('v2');
  });

  it('reads the organisation for a team workspace', () => {
    expect(
      resolveAgentVersion({
        isPersonalAccount: false,
        userAgentVersion: 'v2',
        organizationAgentVersion: 'v1',
      })
    ).toBe('v1');
  });

  it('uses v2 when the workspace has no stored version', () => {
    expect(
      resolveAgentVersion({
        isPersonalAccount: true,
        userAgentVersion: null,
        organizationAgentVersion: 'v1',
      })
    ).toBe('v2');
    expect(
      resolveAgentVersion({
        isPersonalAccount: false,
        userAgentVersion: 'v1',
        organizationAgentVersion: undefined,
      })
    ).toBe('v2');
  });
});
