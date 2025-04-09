import { useCallback } from 'react';

interface CursorPosition {
  x: number;
  y: number;
}

interface User {
  userName: string;
  cursor?: CursorPosition;
}

interface UserCursorsProps {
  presence: Map<string, User>;
  clientId: string;
}

const UserCursors = ({ presence, clientId }: UserCursorsProps) => {
  const renderCursor = useCallback(
    (user: User, userId: string) => {
      if (userId === clientId || !user.cursor) {
        return null;
      }

      // Generate consistent color based on user ID
      const color = `hsl(${Math.abs(userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % 360}, 70%, 50%)`;

      return (
        <div
          key={userId}
          className="fixed pointer-events-none z-[9999]"
          style={{
            left: user.cursor.x,
            top: user.cursor.y,
            transform: 'translate(-50%, -50%)',
          }}
        >
          {/* Cursor dot */}
          <div className="relative">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color }} />
            <div
              className="absolute -inset-1 w-6 h-6 border-2 rounded-full animate-ping opacity-75"
              style={{ borderColor: color }}
            />
          </div>

          {/* Username label */}
          <div className="absolute top-5 left-2 px-2 py-1 text-xs font-medium text-white rounded-md shadow-lg bg-black/75 whitespace-nowrap">
            {user.userName}
          </div>
        </div>
      );
    },
    [clientId]
  );

  // Filter out current user and users without cursors
  const otherUsers = Array.from(presence.entries()).filter(
    ([id, user]: [string, User]) => id !== clientId && user.cursor
  );

  if (otherUsers.length === 0) {
    return null;
  }

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999]">
      {otherUsers.map(([userId, user]: [string, User]) => renderCursor(user, userId))}
    </div>
  );
};

export default UserCursors;
