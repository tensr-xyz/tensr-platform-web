export type MemberRole = 'ADMIN' | 'MEMBER' | 'VIEWER';

export interface OrganizationMember {
  organizationId: string;
  userId: string;
  role: MemberRole;
  joinedAt: string;
  user?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    profilePicture?: string;
  };
}

function text(value: unknown): string {
  return value == null ? '' : String(value);
}

/** The API returns snake_case members with owner/member roles. */
export function mapApiMember(raw: Record<string, unknown>): OrganizationMember {
  const userId = text(raw.user_id ?? raw.userId);
  const email = text(raw.email);
  return {
    organizationId: text(raw.organization_id ?? raw.organizationId),
    userId,
    role: text(raw.role).toLowerCase() === 'owner' ? 'ADMIN' : 'MEMBER',
    joinedAt: text(raw.created_at ?? raw.joinedAt),
    user: email ? { id: userId, email } : undefined,
  };
}

/** The API only has owner and member. */
export function toApiRole(role: MemberRole): 'owner' | 'member' {
  return role === 'ADMIN' ? 'owner' : 'member';
}

/** FastAPI puts the reason in `detail`. */
export function apiErrorDetail(body: unknown, fallback: string): string {
  if (body && typeof body === 'object') {
    const { detail, message } = body as { detail?: unknown; message?: unknown };
    if (typeof detail === 'string' && detail) return detail;
    if (typeof message === 'string' && message) return message;
  }
  return fallback;
}
