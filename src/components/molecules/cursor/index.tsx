'use client';

import { useEffect, useState } from 'react';
import { MousePointer2 } from 'lucide-react';
import { usePresence, useSession, type UserPresence } from '@/hooks/ui/use-session';

function presenceColor(userId: string): string {
  return `hsl(${
    Math.abs(userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % 360
  } 70% 45%)`;
}

/** Colored pointer + name label for every remote collaborator. */
function RemotePointer({ userId, user }: { userId: string; user: UserPresence }) {
  if (!user.cursor || user.cursor.x == null || user.cursor.y == null) {
    return null;
  }
  // Ignore cleared / zeroed placeholders until we have a real mouse sample.
  if (user.cursor.x === 0 && user.cursor.y === 0 && !user.cursor.selection) {
    return null;
  }

  const color = presenceColor(userId);
  const label = user.userName?.split('@')[0] || 'Collaborator';

  return (
    <div
      className="pointer-events-none fixed z-[9999]"
      style={{
        left: user.cursor.x,
        top: user.cursor.y,
        transform: 'translate(-3px, -2px)',
      }}
    >
      <MousePointer2
        size={32}
        strokeWidth={1.75}
        color="white"
        fill={color}
        className="drop-shadow-md"
        aria-hidden
      />
      <div
        className="absolute left-6 top-5 max-w-[160px] truncate rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-white shadow-lg ring-1 ring-black/10"
        style={{ backgroundColor: color }}
      >
        {label}
      </div>
    </div>
  );
}

/** Outline the cell another user has focused (uses data-row-index / data-column-id). */
function RemoteCellSelections({
  presence,
  clientId,
}: {
  presence: Map<string, UserPresence>;
  clientId: string;
}) {
  const [, bump] = useState(0);

  useEffect(() => {
    const onLayout = () => bump(n => n + 1);
    window.addEventListener('resize', onLayout);
    // Spreadsheet scroll containers — capture so nested overflow scrolls update rings.
    document.addEventListener('scroll', onLayout, true);
    const id = window.setInterval(onLayout, 500);
    return () => {
      window.removeEventListener('resize', onLayout);
      document.removeEventListener('scroll', onLayout, true);
      window.clearInterval(id);
    };
  }, []);

  const remote = Array.from(presence.entries()).filter(
    ([id, user]) => id !== clientId && !!user.cursor?.selection
  );

  if (remote.length === 0) return null;

  return (
    <>
      {remote.map(([userId, user]) => {
        const sel = user.cursor?.selection;
        if (!sel) return null;
        const safeCol =
          typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
            ? CSS.escape(sel.columnId)
            : sel.columnId.replace(/["\\]/g, '\\$&');
        const el = document.querySelector<HTMLElement>(
          `[data-row-index="${sel.rowIndex}"][data-column-id="${safeCol}"]`
        );
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) return null;
        const color = presenceColor(userId);
        const label = user.userName?.split('@')[0] || 'Collaborator';

        return (
          <div
            key={`sel-${userId}`}
            className="pointer-events-none fixed z-[9998]"
            style={{
              left: rect.left,
              top: rect.top,
              width: rect.width,
              height: rect.height,
              boxShadow: `inset 0 0 0 2px ${color}`,
              backgroundColor: `${color}18`,
            }}
          >
            <span
              className="absolute -top-5 left-0 max-w-[140px] truncate rounded px-1 py-0.5 text-[10px] font-semibold text-white shadow"
              style={{ backgroundColor: color }}
            >
              {label}
            </span>
          </div>
        );
      })}
    </>
  );
}

/** Self-subscribes to presence so Spreadsheet does not re-render on every cursor move. */
const UserCursors = () => {
  const presence = usePresence();
  const { clientId, currentSession } = useSession();

  if (!currentSession) {
    return null;
  }

  const others = Array.from(presence.entries()).filter(([id]) => id !== clientId);

  if (others.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999]">
      <RemoteCellSelections presence={presence} clientId={clientId} />
      {others.map(([userId, user]) => (
        <RemotePointer key={userId} userId={userId} user={user} />
      ))}
    </div>
  );
};

export default UserCursors;
