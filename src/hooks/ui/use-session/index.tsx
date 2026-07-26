import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { ApiRequestError } from '@/lib/api-error';
import { getTensrWebSocketUrl } from '@/lib/tensr-api-url';
import { getIdToken } from '@/utils/auth';

type Listener<T> = (value: T) => void;

class EventEmitter<T> {
  private listeners: Listener<T>[] = [];

  subscribe(listener: Listener<T>) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  emit(value: T) {
    this.listeners.forEach(listener => listener(value));
  }
}

export interface Session {
  id: string;
  datasetId?: string;
  fileName: string;
  filePath: string;
  ownerId?: string;
  ownerName: string;
  participantCount: number;
  // `role` comes straight from `collaboration_db.format_session_response` (Host/Editor/Viewer).
  // The Host can change a participant's role via `apiClient.collaboration.updateParticipantRole`
  // (see `useSession().updateParticipantRole`); everyone else only ever reads it here.
  participants: Array<{ userId: string; userName: string; role?: string }>;
  created: number;
  clientId?: string;
}

export interface UserPresence {
  userId: string;
  userName: string;
  cursor?: {
    x: number;
    y: number;
    tabId?: string;
    element?: string;
  } | null;
  lastActive: number;
}

class WebSocketService {
  private static instance: WebSocketService;
  private ws: WebSocket | null = null;
  public userId: string = crypto.randomUUID();
  public userName: string = `User ${Math.floor(Math.random() * 1000)}`;

  private wsReadyEmitter = new EventEmitter<boolean>();
  private sessionEmitter = new EventEmitter<Session | null>();
  private presenceEmitter = new EventEmitter<Map<string, UserPresence>>();
  // Sheet (`sheet_live` op-log) messages — `initial_state` (sheet flavor), `op_applied`,
  // `op_rejected`, `snapshot_saved`, and any `error` — routed here instead of the
  // session-specific emitters above. See `subscribeToSheet`/`sendSheetOp`/`onSheetMessage`.
  private sheetEmitter = new EventEmitter<Record<string, any>>();
  private _wsReady: boolean = false;
  private _session: Session | null = null;
  private _presence = new Map<string, UserPresence>();
  // sessionId to `join` once the (re)connected socket opens.
  private _pendingSessionId: string | null = null;
  // Sheet ids subscribed on this single connection — re-sent on reconnect so
  // live-sheet sync survives dropped connections transparently.
  private _subscribedSheetIds = new Set<string>();

  private handlePresenceUpdate(message: { presence: UserPresence }) {
    const { presence: incomingPresence } = message;

    // Process all presence updates, not just our own
    if (incomingPresence.cursor === null) {
      this._presence.delete(incomingPresence.userId);
    } else {
      // Update presence for all users
      this._presence.set(incomingPresence.userId, {
        ...incomingPresence,
        lastActive: Date.now(),
      });
    }

    // Create new Map to ensure reference changes
    const updatedPresence = new Map(this._presence);
    this.presenceEmitter.emit(updatedPresence);
  }

  private constructor() {}

  static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  /**
   * Single WebSocket connection shared by collaboration-session messages (join/
   * presence) and sheet live-doc messages (subscribe/op). Both concerns key off the
   * same `connectionId` server-side (see `app/realtime/hub.py` / `app/realtime_hub.py`),
   * so one socket carries both instead of opening a second connection per sheet.
   */
  private connect() {
    if (this.ws) {
      this.ws.close();
    }

    const token = getIdToken();
    // Production: RealtimeStack's single WebSocket route (see getTensrWebSocketUrl docs).
    const wsBase = getTensrWebSocketUrl('/ws');
    const wsUrl = token
      ? `${wsBase}${wsBase.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(token)}`
      : wsBase;
    if (!token) {
      console.warn('Authentication required for collaboration WebSocket');
      return;
    }

    // Clear presence when setting up new connection
    this._presence.clear();

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this._wsReady = true;
      this.wsReadyEmitter.emit(true);

      if (this._pendingSessionId) {
        this.ws?.send(
          JSON.stringify({
            type: 'join',
            sessionId: this._pendingSessionId,
            userId: this.userId,
            userName: this.userName,
          })
        );
      }

      // Re-subscribe any live sheets so a dropped/reopened connection doesn't
      // silently stop syncing cell edits for tabs still mounted.
      for (const sheetId of this._subscribedSheetIds) {
        this.ws?.send(JSON.stringify({ type: 'subscribe', sheetId }));
      }
    };

    this.ws.onmessage = event => {
      try {
        const message = JSON.parse(event.data);

        switch (message.type) {
          case 'initial_state':
            // Sheet-flavored `initial_state` carries `sheetId`/`schema` instead of
            // `session`/`presence` — route it to sheet subscribers, not the session
            // state below (see `app/realtime/hub.py::_handle_subscribe`).
            if (message.sheetId !== undefined) {
              this.sheetEmitter.emit(message);
              break;
            }
            this._session = message.session;
            if (message.presence) {
              // Handle initial presence state
              this._presence.clear();
              Object.entries(message.presence).forEach(([userId, data]) => {
                this._presence.set(userId, data as UserPresence);
              });
              // Create new Map to ensure reference change
              this.presenceEmitter.emit(new Map(this._presence));
            }
            this.sessionEmitter.emit(message.session);
            this.wsReadyEmitter.emit(true);
            break;

          case 'presence_update':
            this.handlePresenceUpdate(message);
            break;

          case 'participant_joined':
            if (message.session) {
              this._session = message.session;
              this.sessionEmitter.emit(message.session);
            }
            break;

          case 'role_updated':
            if (message.session) {
              this._session = message.session;
              this.sessionEmitter.emit(message.session);
            }
            break;

          case 'participant_left':
            if (message.session) {
              this._session = message.session;
              this.sessionEmitter.emit(message.session);
            }
            if (message.userId) {
              this._presence.delete(message.userId);
              this.presenceEmitter.emit(new Map(this._presence));
            }
            break;

          case 'session_ended':
            this._session = null;
            this._presence.clear();
            this.sessionEmitter.emit(null);
            this.presenceEmitter.emit(new Map());
            break;

          // Sheet op-log messages (persisted via `sheet_live_dynamo`). Cell edits
          // during a live session flow through these instead of the old ephemeral,
          // non-persisted `cell_update` broadcast.
          case 'op_applied':
          case 'op_rejected':
          case 'snapshot_saved':
          case 'error':
            this.sheetEmitter.emit(message);
            break;
        }
      } catch (error) {
        console.error('Error processing message:', error);
      }
    };

    this.ws.onclose = () => {
      this._wsReady = false;
      this._presence.clear();
      this.wsReadyEmitter.emit(false);
      this.presenceEmitter.emit(new Map());

      setTimeout(() => {
        if (this._session || this._subscribedSheetIds.size > 0) {
          this.connect();
        }
      }, 3000);
    };

    this.ws.onerror = error => {};
  }

  setupWebSocket(sessionId: string) {
    this._pendingSessionId = sessionId;
    this.connect();
  }

  /** Subscribe (or re-subscribe) the shared connection to a `sheet_live` doc. */
  subscribeToSheet(sheetId: string) {
    this._subscribedSheetIds.add(sheetId);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'subscribe', sheetId }));
    } else if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
      this.connect();
    }
    // If CONNECTING, `onopen` above will send `subscribe` for every tracked sheetId.
  }

  unsubscribeFromSheet(sheetId: string) {
    this._subscribedSheetIds.delete(sheetId);
  }

  sendSheetOp(sheetId: string, baseVersion: number, op: unknown) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'op', sheetId, baseVersion, op }));
    }
  }

  sendSheetMessage(message: Record<string, any>) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  onSheetMessage(callback: (message: Record<string, any>) => void) {
    return this.sheetEmitter.subscribe(callback);
  }

  get isSocketOpen(): boolean {
    return !!this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  updatePresence(cursor: UserPresence['cursor']) {
    if (!this._wsReady || !this.ws) {
      return;
    }

    const presence: UserPresence = {
      userId: this.userId,
      userName: this.userName,
      cursor,
      lastActive: Date.now(),
    };

    // Update local presence immediately
    if (cursor === null) {
      this._presence.delete(this.userId);
    } else {
      this._presence.set(this.userId, presence);
    }

    // Send to server
    try {
      const message = {
        type: 'presence_update',
        presence,
        userId: this.userId,
      };
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('Error sending presence update:', error);
    }

    // Emit with new Map to ensure reference change
    this.presenceEmitter.emit(new Map(this._presence));
  }

  async leaveSession() {
    if (!this._session || !this.ws) {
      return;
    }

    try {
      await apiClient.collaboration.leaveSession(this._session.id);
      this._pendingSessionId = null;

      // If a sheet is still subscribed (live editing continuing solo), keep the
      // socket open instead of tearing it down — only drop the session itself.
      const keepSocketOpen = this._subscribedSheetIds.size > 0;
      if (keepSocketOpen) {
        this.ws.send(JSON.stringify({ type: 'leave_session', sessionId: this._session.id }));
      } else {
        this.ws.close();
        this._wsReady = false;
      }

      // Clear local state
      this._session = null;
      this._presence.clear();

      // Emit updates
      this.sessionEmitter.emit(null);
      this.presenceEmitter.emit(new Map());
      if (!keepSocketOpen) {
        this.wsReadyEmitter.emit(false);
      }
    } catch (error) {
      console.error('Error leaving session:', error);
      throw error;
    }
  }

  /** Optimistic local apply of a session returned by a REST call (e.g. role change),
   *  ahead of the `role_updated` broadcast that will echo the same data back over the
   *  socket shortly after. */
  applySessionUpdate(session: Session) {
    this._session = session;
    this.sessionEmitter.emit(session);
  }

  onWsReady(callback: (ready: boolean) => void) {
    return this.wsReadyEmitter.subscribe(callback);
  }

  onSessionChange(callback: (session: Session | null) => void) {
    return this.sessionEmitter.subscribe(callback);
  }

  onPresenceChange(callback: (presence: Map<string, UserPresence>) => void) {
    return this.presenceEmitter.subscribe(callback);
  }

  get currentSession() {
    return this._session;
  }

  get isReady() {
    return this._wsReady;
  }

  get socket() {
    return this.ws;
  }

  get presence() {
    return this._presence;
  }
}

export const wsService = WebSocketService.getInstance();

export function useSession() {
  const [wsReady, setWsReady] = useState(wsService.isReady);
  const [currentSession, setCurrentSession] = useState<Session | null>(wsService.currentSession);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [presence, setPresence] = useState<Map<string, UserPresence>>(new Map());

  useEffect(() => {
    const wsReadyCleanup = wsService.onWsReady(ready => {
      setWsReady(ready);
    });

    const sessionCleanup = wsService.onSessionChange(session => {
      setCurrentSession(session);
    });

    const presenceCleanup = wsService.onPresenceChange(newPresence => {
      setPresence(newPresence);
    });

    // Fetch available sessions initially and then periodically
    let collaborationUnavailable = false;
    let interval: ReturnType<typeof setInterval> | undefined;

    const fetchSessions = async () => {
      if (collaborationUnavailable) return;
      try {
        const response = await apiClient.collaboration.sessions();
        setSessions(response || []);
      } catch (error) {
        if (error instanceof ApiRequestError && error.status === 404) {
          // AuthStack must be redeployed with /api/sessions routes (see tensr-api/infra/stacks/auth_stack.py).
          collaborationUnavailable = true;
          if (interval) clearInterval(interval);
          return;
        }
        console.warn('Collaboration sessions unavailable:', error);
        setSessions([]);
      }
    };

    void fetchSessions();
    interval = setInterval(fetchSessions, 5000);

    return () => {
      wsReadyCleanup();
      sessionCleanup();
      presenceCleanup();
      if (interval) clearInterval(interval);
    };
  }, []);

  const createSession = async (params: {
    datasetId?: string;
    filePath?: string;
    fileName: string;
  }) => {
    try {
      const idToken = getIdToken();
      if (!idToken) {
        throw new Error('Authentication required');
      }

      const session = await apiClient.collaboration.createSession({
        ...params,
        userName: wsService.userName,
      });

      wsService.setupWebSocket(session.id);
      return session;
    } catch (error) {
      console.error('Failed to create session:', error);
      throw error;
    }
  };

  const joinSession = async (sessionId: string, options?: { userName?: string }) => {
    try {
      const idToken = getIdToken();
      if (!idToken) {
        throw new Error('Authentication required');
      }

      const userName = options?.userName?.trim() || wsService.userName;
      if (userName) {
        wsService.userName = userName;
      }

      const session = await apiClient.collaboration.joinSession(sessionId, { userName });
      wsService.setupWebSocket(session.id);
      return session;
    } catch (error) {
      console.error('Failed to join session:', error);
      throw error;
    }
  };

  const leaveSession = async () => {
    try {
      await wsService.leaveSession();
    } catch (error) {
      console.error('Failed to leave session:', error);
      throw error;
    }
  };

  /** Host-only: promote/demote a participant. See `sessions.py::post_update_participant_role`. */
  const updateParticipantRole = async (userId: string, role: 'Editor' | 'Viewer') => {
    const sessionId = wsService.currentSession?.id;
    if (!sessionId) {
      throw new Error('No active collaboration session');
    }
    try {
      const session = await apiClient.collaboration.updateParticipantRole(sessionId, userId, role);
      wsService.applySessionUpdate(session);
      return session;
    } catch (error) {
      console.error('Failed to update participant role:', error);
      throw error;
    }
  };

  return {
    wsReady,
    currentSession,
    sessions,
    createSession,
    joinSession,
    leaveSession,
    updateParticipantRole,
    ws: wsService.socket,
    presence,
    updatePresence: wsService.updatePresence.bind(wsService),
    clientId: wsService.userId,
  };
}
