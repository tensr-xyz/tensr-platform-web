export type InviteEmailStatus = 'sent' | 'failed' | 'not_configured' | 'unknown';

export interface OrganizationInvitation {
  id: string;
  organizationId: string;
  email: string;
  role: 'ADMIN' | 'MEMBER' | 'VIEWER';
  invitedBy: string;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED';
  token: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  emailStatus: InviteEmailStatus;
  emailError: string | null;
  emailSentAt: string | null;
}

const STATUSES = new Set(['PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED']);
const EMAIL_STATUSES = new Set(['sent', 'failed', 'not_configured']);

function text(value: unknown): string {
  return value == null ? '' : String(value);
}

/** The API returns snake_case invitation records with owner/member roles. */
export function mapApiInvitation(raw: Record<string, unknown>): OrganizationInvitation {
  const status = text(raw.status).toUpperCase();
  const emailStatus = text(raw.email_status);
  return {
    id: text(raw.id),
    organizationId: text(raw.organization_id),
    email: text(raw.email),
    role: text(raw.role).toLowerCase() === 'owner' ? 'ADMIN' : 'MEMBER',
    invitedBy: text(raw.invited_by_user_id),
    status: (STATUSES.has(status) ? status : 'PENDING') as OrganizationInvitation['status'],
    token: text(raw.token),
    expiresAt: text(raw.expires_at),
    createdAt: text(raw.created_at),
    updatedAt: text(raw.updated_at),
    emailStatus: (EMAIL_STATUSES.has(emailStatus) ? emailStatus : 'unknown') as InviteEmailStatus,
    emailError: raw.email_error == null ? null : text(raw.email_error),
    emailSentAt: raw.email_sent_at == null ? null : text(raw.email_sent_at),
  };
}

export function isInvitationExpired(
  invitation: OrganizationInvitation,
  now: Date = new Date()
): boolean {
  const expires = Date.parse(invitation.expiresAt);
  return Number.isNaN(expires) || expires <= now.getTime();
}

/** Short label for the members page. Invitations created before invite emails existed are 'unknown'. */
export function inviteEmailLabel(invitation: OrganizationInvitation): string {
  switch (invitation.emailStatus) {
    case 'sent':
      return 'Email sent';
    case 'failed':
      return 'Email failed';
    case 'not_configured':
      return 'Not emailed';
    default:
      return 'No email on record';
  }
}

export function inviteCreatedToast(invitation: OrganizationInvitation): {
  title: string;
  description: string;
  variant?: 'destructive';
} {
  const joinHint = 'They join when they sign in with this email.';
  if (invitation.emailStatus === 'sent') {
    return { title: 'Invitation emailed', description: `Sent to ${invitation.email}. ${joinHint}` };
  }
  const reason =
    invitation.emailStatus === 'failed' && invitation.emailError
      ? ` (${invitation.emailError})`
      : '';
  return {
    title: 'Invitation saved, but not emailed',
    description: `We couldn't email ${invitation.email}${reason}. ${joinHint} You can resend it from Pending invitations.`,
    variant: 'destructive',
  };
}
