import type { User } from '@/types/user';

/** Session owner and participant ids are tensr user ids; `/me` puts that on `id` and the Stytch id on `userId`. */
export function isSessionUser(
  user: Pick<User, 'id' | 'userId'> | null | undefined,
  sessionUserId: string | null | undefined
): boolean {
  if (!user || !sessionUserId) return false;
  return sessionUserId === user.id || sessionUserId === user.userId;
}
