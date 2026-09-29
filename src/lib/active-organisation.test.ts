import {
  ACTIVE_ORGANISATION_COOKIE,
  PERSONAL_ACCOUNT_KEY,
  readIsPersonal,
  resolveProxyOrganisationId,
  resolveWorkspaceSelection,
  saveActiveOrganisationId,
  type WorkspaceOrganisation,
} from './active-organisation';

describe('saveActiveOrganisationId', () => {
  const cookie = () =>
    document.cookie
      .split('; ')
      .find(part => part.startsWith(`${ACTIVE_ORGANISATION_COOKIE}=`))
      ?.split('=')[1];

  afterEach(() => saveActiveOrganisationId(null));

  it('stores an open team for the proxy', () => {
    saveActiveOrganisationId('3e17df28-4359-4ac8-ae6a-1a788fe9ced5');
    expect(localStorage.getItem('activeOrganizationId')).toBe(
      '3e17df28-4359-4ac8-ae6a-1a788fe9ced5'
    );
    expect(cookie()).toBe('3e17df28-4359-4ac8-ae6a-1a788fe9ced5');
  });

  it('clears the team cookie in the personal workspace and on sign-out', () => {
    saveActiveOrganisationId('prolific');
    saveActiveOrganisationId(PERSONAL_ACCOUNT_KEY);
    expect(localStorage.getItem('activeOrganizationId')).toBe(PERSONAL_ACCOUNT_KEY);
    expect(cookie()).toBeUndefined();

    saveActiveOrganisationId('prolific');
    saveActiveOrganisationId(null);
    expect(localStorage.getItem('activeOrganizationId')).toBeNull();
    expect(cookie()).toBeUndefined();
  });
});

describe('resolveProxyOrganisationId', () => {
  it('prefers the header the page sent', () => {
    expect(resolveProxyOrganisationId('from-header', 'from-cookie')).toBe('from-header');
  });

  it('falls back to the cookie when the page sent no header', () => {
    expect(resolveProxyOrganisationId(null, 'prolific')).toBe('prolific');
  });

  it('ignores personal and malformed cookie values', () => {
    expect(resolveProxyOrganisationId(null, PERSONAL_ACCOUNT_KEY)).toBeNull();
    expect(resolveProxyOrganisationId(null, 'bad value;')).toBeNull();
    expect(resolveProxyOrganisationId(null, undefined)).toBeNull();
  });
});

const personal: WorkspaceOrganisation = { id: 'personal', role: 'ADMIN', isPersonal: true };
const team: WorkspaceOrganisation = { id: 'prolific', role: 'ADMIN', isPersonal: false };

describe('resolveWorkspaceSelection', () => {
  it('opens the only team when the user has not chosen a workspace', () => {
    expect(resolveWorkspaceSelection([personal, team], null)).toEqual({
      kind: 'organisation',
      id: 'prolific',
      role: 'ADMIN',
    });
  });

  it('keeps a saved personal workspace', () => {
    expect(resolveWorkspaceSelection([personal, team], PERSONAL_ACCOUNT_KEY)).toEqual({
      kind: 'personal',
    });
  });

  it('restores a saved team from the membership list', () => {
    expect(resolveWorkspaceSelection([personal, team], 'prolific')).toEqual({
      kind: 'organisation',
      id: 'prolific',
      role: 'ADMIN',
    });
  });

  it('does not treat the personal organisation id as the team workspace', () => {
    expect(resolveWorkspaceSelection([personal, team], 'personal')).toEqual({ kind: 'personal' });
  });

  it('stays personal when several teams exist and nothing is saved', () => {
    const other: WorkspaceOrganisation = { id: 'other', role: 'MEMBER', isPersonal: false };
    expect(resolveWorkspaceSelection([personal, team, other], null)).toEqual({ kind: 'personal' });
  });
});

describe('readIsPersonal', () => {
  it('reads the API flag', () => {
    expect(readIsPersonal({ is_personal: 1 })).toBe(true);
    expect(readIsPersonal({ is_personal: 0 })).toBe(false);
    expect(readIsPersonal({})).toBe(false);
  });
});
