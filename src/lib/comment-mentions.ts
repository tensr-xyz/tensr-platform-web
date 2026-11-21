/** @-mentions in output comments (Paper 6e). Labels only — never codes. */

export type MentionPerson = {
  user_id: string;
  name: string;
  role?: string;
};

export type MentionNotice = {
  report_id?: string | null;
  comment_id?: string | null;
  author_name?: string;
  text?: string;
  created_at?: string | null;
};

/** The @query being typed at the caret, or null when not mentioning. */
export function mentionQueryAt(
  text: string,
  caret: number
): { start: number; query: string } | null {
  const upto = text.slice(0, Math.max(0, Math.min(caret, text.length)));
  const match = /(?:^|[\s([{])@([^\s@]*)$/.exec(upto);
  if (!match) return null;
  const query = match[1] ?? '';
  const start = upto.length - query.length - 1;
  return { start, query };
}

export function filterMentionPeople(people: MentionPerson[], query: string): MentionPerson[] {
  const needle = query.trim().toLowerCase();
  const ranked = people
    .filter(person => person.name.trim().length >= 2)
    .filter(person => !needle || person.name.toLowerCase().includes(needle));
  return ranked.slice(0, 8);
}

/** Replace the active @query with `@Name ` and put the caret after it. */
export function insertMentionAt(
  text: string,
  caret: number,
  name: string
): { text: string; caret: number } | null {
  const active = mentionQueryAt(text, caret);
  if (!active) return null;
  const label = name.trim();
  if (!label) return null;
  const before = text.slice(0, active.start);
  const after = text.slice(caret);
  const inserted = `@${label} `;
  return { text: `${before}${inserted}${after}`, caret: before.length + inserted.length };
}

export function mentionsForReport(notes: MentionNotice[], reportId: string): MentionNotice[] {
  const id = reportId.trim();
  if (!id) return [];
  return notes.filter(note => String(note.report_id || '') === id);
}

export function roleLabel(role?: string): string {
  if (role === 'asker') return 'Asker';
  if (role === 'viewer') return 'Viewer';
  if (role === 'owner') return 'Owner';
  if (role === 'editor' || !role) return 'Editor';
  return role[0].toUpperCase() + role.slice(1).toLowerCase();
}

export function personInitials(name: string): string {
  const parts = name
    .split(/[^A-Za-z0-9]+/)
    .map(part => part.trim())
    .filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0]?.[0] || '';
  const second = parts[1]?.[0] || parts[0]?.[1] || '';
  return (first + second).toUpperCase() || '?';
}

const SEEN_KEY = 'tensr.comment-mentions.seen';

export function unseenMentionIds(notes: MentionNotice[]): string[] {
  if (typeof window === 'undefined') return notes.map(noteKey).filter(Boolean);
  let seen: string[] = [];
  try {
    const raw = window.sessionStorage.getItem(SEEN_KEY);
    seen = raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    seen = [];
  }
  const known = new Set(seen);
  return notes.map(noteKey).filter(id => id && !known.has(id));
}

export function markMentionsSeen(notes: MentionNotice[]): void {
  if (typeof window === 'undefined') return;
  const ids = notes.map(noteKey).filter(Boolean);
  if (!ids.length) return;
  let seen: string[] = [];
  try {
    const raw = window.sessionStorage.getItem(SEEN_KEY);
    seen = raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    seen = [];
  }
  const next = Array.from(new Set([...seen, ...ids])).slice(-200);
  try {
    window.sessionStorage.setItem(SEEN_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
}

function noteKey(note: MentionNotice): string {
  return `${note.report_id || ''}#${note.comment_id || ''}#${note.created_at || ''}`;
}

/** Browser ping when someone @-names you and this tab is in the background. */
export function notifyMentionReceived(opts: {
  authorName: string;
  text?: string;
  hidden?: boolean;
  notify?: (title: string, options?: NotificationOptions) => void;
}): boolean {
  if (typeof window === 'undefined') return false;
  const hidden = opts.hidden ?? (typeof document !== 'undefined' ? document.hidden : false);
  if (!hidden) return false;
  const title = `${opts.authorName || 'Someone'} mentioned you`;
  const body = (opts.text || '').trim().slice(0, 120) || undefined;
  if (opts.notify) {
    opts.notify(title, { body, silent: false });
    return true;
  }
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'denied') return false;
  const fire = () => {
    try {
      new Notification(title, { body, silent: false });
    } catch {
      /* ignore */
    }
  };
  if (Notification.permission === 'granted') {
    fire();
    return true;
  }
  void Notification.requestPermission().then(permission => {
    if (permission === 'granted') fire();
  });
  return false;
}
