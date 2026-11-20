import { PROJECT_TABS } from '@/components/flow/project-tabs';
import type { ProjectViewerPresence } from '@/hooks/ui/use-session';

const PAGE_LABELS = new Map<string, string>(PROJECT_TABS.map(([key, label]) => [key, label]));

/** Tab key → label shown in “Priya is on Report”. */
export function projectPresencePageLabel(page: string | null | undefined): string {
  const key = String(page || '')
    .trim()
    .toLowerCase();
  if (!key) return '';
  return PAGE_LABELS.get(key) || page || '';
}

/** First name (or email local-part) for the status line. */
export function projectPresenceFirstName(userName: string): string {
  const text = userName.trim();
  if (!text) return 'Someone';
  const base = text.includes('@') ? text.split('@')[0] : text;
  const part = base.split(/[\s._-]+/).filter(Boolean)[0] || base;
  return part.charAt(0).toUpperCase() + part.slice(1);
}

export type PresenceTone = { background: string; color: string };

/** Paper 9f avatar tones (accent soft, warm, muted overflow). */
export const PROJECT_PRESENCE_TONES: PresenceTone[] = [
  { background: '#E8F1ED', color: '#1E6B58' },
  { background: '#F3E6D8', color: '#A15C12' },
  { background: '#E7E6E1', color: '#6A6B66' },
];

export function projectPresenceTone(index: number): PresenceTone {
  return PROJECT_PRESENCE_TONES[index % PROJECT_PRESENCE_TONES.length]!;
}

export type PresenceAvatar = {
  userId: string;
  userName: string;
  page: string | null;
  initials: string;
  tone: PresenceTone;
};

export type ProjectPresenceView = {
  avatars: PresenceAvatar[];
  overflow: number;
  status: string | null;
};

/** Others only — current user is not shown in the stack (Paper 9f). */
export function buildProjectPresenceView(
  presence: Map<string, ProjectViewerPresence> | ProjectViewerPresence[],
  currentUserId: string | null | undefined,
  initialsOf: (name: string) => string,
  max = 2
): ProjectPresenceView {
  const rows = Array.isArray(presence) ? presence : Array.from(presence.values());
  const others = rows
    .filter(row => row.userId && row.userId !== currentUserId)
    .sort((a, b) => (b.lastActive || 0) - (a.lastActive || 0));

  const visible = others.slice(0, max);
  const overflow = Math.max(0, others.length - visible.length);
  const avatars: PresenceAvatar[] = visible.map((row, index) => ({
    userId: row.userId,
    userName: row.userName,
    page: row.page ?? null,
    initials: initialsOf(row.userName),
    tone: projectPresenceTone(index),
  }));

  const focus = others.find(row => projectPresencePageLabel(row.page));
  const status = focus
    ? `${projectPresenceFirstName(focus.userName)} is on ${projectPresencePageLabel(focus.page)}`
    : null;

  return { avatars, overflow, status };
}
