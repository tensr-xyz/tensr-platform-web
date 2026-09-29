/** Persisted when the user is in their personal workspace, not a team organisation. */
export const PERSONAL_ACCOUNT_KEY = 'PERSONAL_ACCOUNT';

export const ACTIVE_ORGANISATION_STORAGE_KEY = 'activeOrganizationId';

/**
 * Read by the /api/tensr proxy when a request has no X-Organization-Id header.
 * Selection only: tensr-api still checks membership.
 */
export const ACTIVE_ORGANISATION_COOKIE = 'tensr_active_org';

const ORGANISATION_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function isOrganisationId(value: string | null | undefined): value is string {
  return !!value && value !== PERSONAL_ACCOUNT_KEY && ORGANISATION_ID_PATTERN.test(value);
}

function writeActiveOrganisationCookie(orgId: string | null): void {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = isOrganisationId(orgId)
    ? `${ACTIVE_ORGANISATION_COOKIE}=${encodeURIComponent(orgId)}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax${secure}`
    : `${ACTIVE_ORGANISATION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
}

/** Save the open workspace: a team id, PERSONAL_ACCOUNT_KEY, or null to forget it. */
export function saveActiveOrganisationId(orgId: string | null): void {
  if (typeof window === 'undefined') return;
  if (orgId === null) {
    localStorage.removeItem(ACTIVE_ORGANISATION_STORAGE_KEY);
  } else {
    localStorage.setItem(ACTIVE_ORGANISATION_STORAGE_KEY, orgId);
  }
  writeActiveOrganisationCookie(orgId);
}

/** Header wins; the cookie covers callers that build their own headers. */
export function resolveProxyOrganisationId(
  headerValue: string | null,
  cookieValue: string | null | undefined
): string | null {
  if (headerValue) return headerValue;
  return isOrganisationId(cookieValue) ? cookieValue : null;
}

export type WorkspaceRole = 'ADMIN' | 'MEMBER' | 'VIEWER';

export type WorkspaceOrganisation = {
  id: string;
  role: WorkspaceRole;
  isPersonal?: boolean;
};

export type WorkspaceSelection =
  | { kind: 'personal' }
  | { kind: 'organisation'; id: string; role: WorkspaceRole };

export function readIsPersonal(raw: Record<string, unknown>): boolean {
  const value = raw.is_personal ?? raw.isPersonal;
  return value === true || value === 1 || value === '1';
}

export function teamOrganisations<T extends { isPersonal?: boolean }>(organisations: T[]): T[] {
  return organisations.filter(organisation => !organisation.isPersonal);
}

/**
 * Pick the workspace to open from memberships the API returned.
 * Session tokens do not carry these organisations.
 * A single team and no saved choice opens that team so its trial applies.
 * Several teams and no saved choice stay on the personal workspace.
 */
export function resolveWorkspaceSelection(
  organisations: WorkspaceOrganisation[],
  savedOrgId: string | null
): WorkspaceSelection {
  const teams = teamOrganisations(organisations);
  if (savedOrgId && savedOrgId !== PERSONAL_ACCOUNT_KEY) {
    const saved = teams.find(organisation => organisation.id === savedOrgId);
    if (saved) {
      return { kind: 'organisation', id: saved.id, role: saved.role };
    }
  }
  if (!savedOrgId && teams.length === 1) {
    const team = teams[0];
    return { kind: 'organisation', id: team.id, role: team.role };
  }
  return { kind: 'personal' };
}
