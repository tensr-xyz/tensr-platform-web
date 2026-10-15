import type { User } from '@/types/user';

type LabelUser = Pick<User, 'firstName' | 'lastName' | 'email'>;

function clean(value: string | null | undefined): string {
  return (value ?? '').trim();
}

export function accountName(user: Pick<User, 'firstName' | 'lastName'>): string {
  return [clean(user.firstName), clean(user.lastName)].filter(Boolean).join(' ');
}

/** The name shown beside the avatar: the person's name, otherwise their email. */
export function accountLabel(user: LabelUser): string | null {
  const name = accountName(user);
  if (name) return name;
  const email = clean(user.email);
  return email || null;
}

/** Initials from the name, otherwise the email. Null when neither is available. */
export function accountInitials(user: LabelUser): string | null {
  const name = accountName(user);
  if (name) {
    const letters = name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase() ?? '')
      .join('');
    return letters || null;
  }
  const email = clean(user.email);
  if (!email) return null;
  const local = email.split('@')[0] ?? '';
  const pieces = local.split(/[._-]/).filter(part => part.length > 0);
  if (pieces.length > 1) {
    return pieces
      .slice(0, 2)
      .map(part => part[0].toUpperCase())
      .join('');
  }
  const compact = local.replace(/[^a-zA-Z0-9]/g, '');
  if (!compact) return null;
  return compact.slice(0, 2).toUpperCase();
}
