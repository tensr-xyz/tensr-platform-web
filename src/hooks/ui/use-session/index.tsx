import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { ApiRequestError } from '@/lib/api-error';
import { getTensrWebSocketUrl } from '@/lib/tensr-api-url';
import { getAccessToken, getIdToken, getStytchBearerForTensrApi } from '@/utils/auth';
import { useAuthStore } from '@/stores/auth-store';
import { persistActiveSessionId } from '@/lib/collaboration-session-storage';
import { devLog } from '@/lib/dev-log';

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

export interface PresenceSelection {
  rowIndex: number;
  columnId: string;
}

export interface UserPresence {
  userId: string;
  userName: string;
  cursor?: {
    x: number;
    y: number;
    tabId?: string;
    element?: string;
    selection?: PresenceSelection | null;
  } | null;
  lastActive: number;
}

class WebSocketService {
  private static instance: WebSocketService;
  private ws: WebSocket | null = null;
  public userId: string = crypto.randomUUID();
  public userName: string = `User ${Math.floor(Math.random() * 1000)}`;

  private wsReadyEmitter = new EventEmitter<boolean>();
  private sessionLiveEmitter = new EventEmitter<boolean>();
  private sessionEmitter = new EventEmitter<Session | null>();
  private presenceEmitter = new EventEmitter<Map<string, UserPresence>>();
  private sessionsListEmitter = new EventEmitter<Session[]>();
  private analysisEmitter = new EventEmitter<{ datasetId: string; runId: string; op?: string }>();
  // Sheet (`sheet_live` op-log) messages — `initial_state` (sheet flavor), `op_applied`,
  // `op_rejected`, `snapshot_saved`, and any `error` — routed here instead of the
  // session-specific emitters above. See `subscribeToSheet`/`sendSheetOp`/`onSheetMessage`.
  private sheetEmitter = new EventEmitter<Record<string, any>>();
  private _wsReady: boolean = false;
  /** True after session-flavored `initial_state` — roster/presence come from WS, not REST polls. */
  private _sessionRealtimeBound = false;
  private _session: Session | null = null;
  private _sessionsList: Session[] = [];
  private _presence = new Map<string, UserPresence>();
  // sessionId to `join` once the (re)connected socket opens.
  private _pendingSessionId: string | null = null;
  // Sheet ids subscribed on this single connection — re-sent on reconnect so
  // live-sheet sync survives dropped connections transparently.
  private _subscribedSheetIds = new Set<string>();
  private _reconnectAttempts = 0;
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _backgroundSyncStarted = false;
  private _sessionsListInterval: ReturnType<typeof setInterval> | null = null;
  private _rosterFallbackInterval: ReturnType<typeof setInterval> | null = null;
  private _joinAckTimer: ReturnType<typeof setTimeout> | null = null;
  private _joinAttempts = 0;
  private presenceSendTimer: ReturnType<typeof setTimeout> | null = null;
  private presenceEmitTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingPresenceCursor: UserPresence['cursor'] | undefined;
  private static readonly MAX_RECONNECT_ATTEMPTS = 8;
  private static readonly MAX_JOIN_ATTEMPTS = 5;

  private handlePresenceUpdate(message: { presence: UserPresence; userId?: string }) {
    const incomingPresence = message.presence;
    if (!incomingPresence || typeof incomingPresence !== 'object') {
      return;
    }
    const userId = incomingPresence.userId || message.userId;
    if (!userId) {
      return;
    }

    // Process all presence updates, not just our own
    if (incomingPresence.cursor === null) {
      this._presence.delete(userId);
    } else {
      this._presence.set(userId, {
        ...incomingPresence,
        userId,
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
  private clearJoinAckTimer() {
    if (this._joinAckTimer) {
      clearTimeout(this._joinAckTimer);
      this._joinAckTimer = null;
    }
  }

  /** Send JSON on the socket; mirror `type` → `action` for API Gateway route selection. */
  private sendJson(message: Record<string, unknown>) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    const type = typeof message.type === 'string' ? message.type : undefined;
    const payload = type && message.action === undefined ? { action: type, ...message } : message;
    this.ws.send(JSON.stringify(payload));
  }

  private sendSessionJoin() {
    if (!this._pendingSessionId || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    if (this._sessionRealtimeBound && this._session?.id === this._pendingSessionId) {
      return;
    }
    this._joinAttempts += 1;
    // `action` mirrors `type` — API Gateway's default routeSelectionExpression is
    // `$request.body.action`; empty action can drop messages before $default in some setups.
    devLog('[wsService] sending session join', {
      sessionId: this._pendingSessionId,
      userId: this.userId,
      attempt: this._joinAttempts,
    });
    this.sendJson({
      type: 'join',
      sessionId: this._pendingSessionId,
      userId: this.userId,
      userName: this.userName,
    });

    this.clearJoinAckTimer();
    this._joinAckTimer = setTimeout(() => {
      if (this._sessionRealtimeBound) return;
      if (this._joinAttempts >= WebSocketService.MAX_JOIN_ATTEMPTS) {
        console.error(
          '[wsService] No session initial_state after join — presence/cursors will not sync. Check WS auth and that RealtimeStack shares the business Dynamo table with REST sessions.'
        );
        return;
      }
      console.warn(
        `[wsService] session join not acknowledged (attempt ${this._joinAttempts}) — retrying`
      );
      this.sendSessionJoin();
    }, 2000);
  }

  private markSessionLive(session: Session, presence?: Record<string, UserPresence>) {
    this.clearJoinAckTimer();
    this._joinAttempts = 0;
    this._session = session;
    this._sessionRealtimeBound = true;
    this.sessionLiveEmitter.emit(true);
    persistActiveSessionId(session.id);
    if (presence) {
      this._presence.clear();
      Object.entries(presence).forEach(([userId, data]) => {
        this._presence.set(userId, data as UserPresence);
      });
      this.presenceEmitter.emit(new Map(this._presence));
    }
    this.sessionEmitter.emit(session);
    this.wsReadyEmitter.emit(true);
    devLog('[wsService] session live (WS join ack)', {
      sessionId: session.id,
      participants: session.participantCount ?? session.participants?.length,
    });
    for (const sheetId of this._subscribedSheetIds) {
      this.sendJson({ type: 'subscribe', sheetId });
    }
  }

  private connect() {
    // Avoid tearing down an in-flight handshake (Strict Mode / double setupWebSocket
    // was closing CONNECTING sockets → "WebSocket is closed before the connection
    // is established").
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    ) {
      if (this.ws.readyState === WebSocket.OPEN && this._pendingSessionId) {
        this.sendSessionJoin();
      }
      return;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // Prefer opaque session_token in the query string (API Gateway URL cap 4096).
    // Fall back to the same bearer REST uses if the opaque token is missing.
    let token = getAccessToken() || getStytchBearerForTensrApi() || getIdToken();
    const wsBase = getTensrWebSocketUrl('/ws');
    let wsUrl = token
      ? `${wsBase}${wsBase.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(token)}`
      : wsBase;
    if (token && wsUrl.length > 4000) {
      const sessionToken = getAccessToken();
      if (sessionToken && sessionToken !== token) {
        token = sessionToken;
        wsUrl = `${wsBase}${wsBase.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(token)}`;
      }
      if (wsUrl.length > 4000) {
        console.error(
          `[wsService] WebSocket URL is ${wsUrl.length} chars (API Gateway limit 4096). Presence will fail — use session_token, not JWT.`
        );
      }
    }
    if (!token) {
      console.warn('[wsService] Authentication required for collaboration WebSocket');
      return;
    }

    // Clear presence when setting up new connection
    this._presence.clear();
    this._sessionRealtimeBound = false;
    this.sessionLiveEmitter.emit(false);
    this._joinAttempts = 0;

    devLog('[wsService] connecting', { wsBase, urlLength: wsUrl.length });
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this._reconnectAttempts = 0;
      this._wsReady = true;
      this.wsReadyEmitter.emit(true);
      devLog('[wsService] socket open');

      if (this._pendingSessionId) {
        this.sendSessionJoin();
      }

      // Re-subscribe any live sheets so a dropped/reopened connection doesn't
      // silently stop syncing cell edits for tabs still mounted.
      for (const sheetId of this._subscribedSheetIds) {
        this.sendJson({ type: 'subscribe', sheetId });
      }
      // Prove the message Lambda can post back (join uses the same path).
      this.sendJson({ type: 'ping' });
      window.setTimeout(() => {
        if (!this._sessionRealtimeBound && this._joinAttempts > 0) {
          // If we also never saw a pong, post_to_connection / message Lambda is broken.
          console.warn(
            '[wsService] Still no session ack. If you also never saw "← pong", redeploy RealtimeStack (dev-tensr-realtime-message) — REST Live roster can work while WS replies are dead.'
          );
        }
      }, 2500);
    };

    this.ws.onmessage = event => {
      try {
        const message = JSON.parse(event.data);
        if (message?.type && message.type !== 'presence_update') {
          devLog('[wsService] ←', message.type, message.sheetId || message.session?.id || '');
        }

        switch (message.type) {
          case 'initial_state':
            // Sheet-flavored `initial_state` carries `sheetId`/`schema` instead of
            // `session`/`presence` — route it to sheet subscribers, not the session
            // state below (see `app/realtime/hub.py::_handle_subscribe`).
            if (message.sheetId !== undefined) {
              this.sheetEmitter.emit(message);
              break;
            }
            if (message.session) {
              this.markSessionLive(message.session, message.presence);
            }
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

          case 'analysis_run_created':
            if (message.datasetId && message.runId) {
              this.analysisEmitter.emit({
                datasetId: String(message.datasetId),
                runId: String(message.runId),
                op: message.op ? String(message.op) : undefined,
              });
            }
            break;

          case 'session_ended':
            this._session = null;
            this._sessionRealtimeBound = false;
            this.sessionLiveEmitter.emit(false);
            this._presence.clear();
            persistActiveSessionId(null);
            this.sessionEmitter.emit(null);
            this.presenceEmitter.emit(new Map());
            break;

          // Sheet op-log messages (persisted via `sheet_live_dynamo`). Cell edits
          // during a live session flow through these instead of the old ephemeral,
          // non-persisted `cell_update` broadcast.
          case 'op_applied':
          case 'op_rejected':
          case 'snapshot_saved':
            this.sheetEmitter.emit(message);
            break;

          case 'pong':
            devLog('[wsService] ← pong (message Lambda + post_to_connection OK)');
            break;

          case 'error':
            console.error('[wsService] server error:', message.message || message);
            if (message.code === 'connection_not_found') {
              console.error(
                '[wsService] Server lost our connection row — forcing reconnect. If this persists, redeploy RealtimeStack (dev-tensr-realtime-message).'
              );
              this.ws?.close();
              break;
            }
            if (
              typeof message.message === 'string' &&
              /join|session/i.test(message.message) &&
              !this._sessionRealtimeBound
            ) {
              console.error(
                '[wsService] Session WS join failed — cursors/presence disabled until join succeeds:',
                message.message
              );
            }
            this.sheetEmitter.emit(message);
            break;
        }
      } catch (error) {
        console.error('Error processing message:', error);
      }
    };

    this.ws.onclose = () => {
      this._wsReady = false;
      this._sessionRealtimeBound = false;
      this.sessionLiveEmitter.emit(false);
      this._presence.clear();
      this.wsReadyEmitter.emit(false);
      this.presenceEmitter.emit(new Map());

      const shouldRetry =
        Boolean(this._session || this._subscribedSheetIds.size > 0 || this._pendingSessionId) &&
        this._reconnectAttempts < WebSocketService.MAX_RECONNECT_ATTEMPTS;

      if (!shouldRetry) {
        if (this._reconnectAttempts >= WebSocketService.MAX_RECONNECT_ATTEMPTS) {
          console.error(
            '[wsService] Giving up WebSocket reconnect after repeated handshake failures. Check NEXT_PUBLIC_WEBSOCKET_URL and realtime auth.'
          );
        }
        return;
      }

      const delay = Math.min(30_000, 2_000 * 1.6 ** this._reconnectAttempts);
      this._reconnectAttempts += 1;
      if (this._reconnectTimer) {
        clearTimeout(this._reconnectTimer);
      }
      this._reconnectTimer = setTimeout(() => {
        this._reconnectTimer = null;
        this.connect();
      }, delay);
    };

    this.ws.onerror = () => {
      console.error(
        '[wsService] WebSocket error — session was created over REST but realtime join may have failed. Check NEXT_PUBLIC_WEBSOCKET_URL and the access_token query param.'
      );
    };
  }

  setupWebSocket(sessionId: string) {
    this._pendingSessionId = sessionId;
    this._joinAttempts = 0;
    this._sessionRealtimeBound = false;
    this.sessionLiveEmitter.emit(false);
    this.connect();
  }

  /** Subscribe (or re-subscribe) the shared connection to a `sheet_live` doc. */
  subscribeToSheet(sheetId: string) {
    this._subscribedSheetIds.add(sheetId);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendJson({ type: 'subscribe', sheetId });
    } else if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
      this.connect();
    }
    // If CONNECTING, `onopen` above will send `subscribe` for every tracked sheetId.
  }

  unsubscribeFromSheet(sheetId: string) {
    this._subscribedSheetIds.delete(sheetId);
  }

  sendSheetOp(sheetId: string, baseVersion: number, op: unknown) {
    this.sendJson({ type: 'op', sheetId, baseVersion, op });
  }

  sendSheetMessage(message: Record<string, any>) {
    this.sendJson(message);
  }

  onSheetMessage(callback: (message: Record<string, any>) => void) {
    return this.sheetEmitter.subscribe(callback);
  }

  get isSocketOpen(): boolean {
    return !!this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  updatePresence(cursor: UserPresence['cursor']) {
    // Only after session-flavored `initial_state` — earlier sends are dropped by the
    // hub because the connection is not bound to a sessionId yet.
    if (!this._sessionRealtimeBound || !this.ws || !this._session) {
      return;
    }

    // Clearing when already absent must not emit — effect cleanups that call
    // updatePresence(null) would otherwise re-render forever.
    if (cursor === null) {
      if (!this._presence.has(this.userId)) {
        return;
      }
      this._presence.delete(this.userId);
      if (this.presenceSendTimer) {
        clearTimeout(this.presenceSendTimer);
        this.presenceSendTimer = null;
      }
      this.pendingPresenceCursor = undefined;
      try {
        this.sendJson({
          type: 'presence_update',
          presence: {
            userId: this.userId,
            userName: this.userName,
            cursor: null,
            lastActive: Date.now(),
          },
          userId: this.userId,
        });
      } catch (error) {
        console.error('Error sending presence update:', error);
      }
      this.presenceEmitter.emit(new Map(this._presence));
      return;
    }

    this._presence.set(this.userId, {
      userId: this.userId,
      userName: this.userName,
      cursor,
      lastActive: Date.now(),
    });
    this.pendingPresenceCursor = cursor;

    // Coalesce local UI updates (~1 frame) so Spreadsheet/cursors don't thrash.
    if (!this.presenceEmitTimer) {
      this.presenceEmitTimer = setTimeout(() => {
        this.presenceEmitTimer = null;
        this.presenceEmitter.emit(new Map(this._presence));
      }, 32);
    }

    // Wire send ~12/s — enough for smooth remote cursors without saturating WS.
    if (this.presenceSendTimer) {
      return;
    }
    this.presenceSendTimer = setTimeout(() => {
      this.presenceSendTimer = null;
      const latest = this.pendingPresenceCursor;
      if (latest === undefined || !this._sessionRealtimeBound || !this.ws) {
        return;
      }
      const presence = this._presence.get(this.userId) ?? {
        userId: this.userId,
        userName: this.userName,
        cursor: latest,
        lastActive: Date.now(),
      };
      try {
        this.sendJson({
          type: 'presence_update',
          presence,
          userId: this.userId,
        });
      } catch (error) {
        console.error('Error sending presence update:', error);
      }
    }, 80);
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
        this.sendJson({ type: 'leave_session', sessionId: this._session.id });
      } else {
        this.ws.close();
        this._wsReady = false;
      }

      // Clear local state
      this._session = null;
      this._sessionRealtimeBound = false;
      this.sessionLiveEmitter.emit(false);
      this._presence.clear();
      persistActiveSessionId(null);

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
    persistActiveSessionId(session.id);
    this.sessionEmitter.emit(session);
  }

  /** Keep WS presence / join identity aligned with the authenticated tensr user id. */
  setIdentity(userId: string, userName?: string) {
    if (userId?.trim()) {
      this.userId = userId.trim();
    }
    if (userName?.trim()) {
      this.userName = userName.trim();
    }
  }

  onWsReady(callback: (ready: boolean) => void) {
    return this.wsReadyEmitter.subscribe(callback);
  }

  /** True once this socket has received session `initial_state` (presence/ops will work). */
  onSessionLive(callback: (live: boolean) => void) {
    return this.sessionLiveEmitter.subscribe(callback);
  }

  get isSessionLive() {
    return this._sessionRealtimeBound;
  }

  onSessionChange(callback: (session: Session | null) => void) {
    return this.sessionEmitter.subscribe(callback);
  }

  onPresenceChange(callback: (presence: Map<string, UserPresence>) => void) {
    return this.presenceEmitter.subscribe(callback);
  }

  onSessionsListChange(callback: (sessions: Session[]) => void) {
    return this.sessionsListEmitter.subscribe(callback);
  }

  onAnalysisRunCreated(
    callback: (event: { datasetId: string; runId: string; op?: string }) => void
  ) {
    return this.analysisEmitter.subscribe(callback);
  }

  /**
   * Single app-wide poller (not per `useSession` mount). Roster/presence/analysis
   * are pushed over WS; REST is only a slow fallback when the socket isn't bound.
   */
  startBackgroundSync() {
    if (this._backgroundSyncStarted) return;
    this._backgroundSyncStarted = true;

    let collaborationUnavailable = false;
    const fetchSessionsList = async () => {
      if (collaborationUnavailable) return;
      try {
        const response = await apiClient.collaboration.sessions();
        this._sessionsList = response || [];
        this.sessionsListEmitter.emit(this._sessionsList);
      } catch (error) {
        if (error instanceof ApiRequestError && error.status === 404) {
          collaborationUnavailable = true;
          if (this._sessionsListInterval) {
            clearInterval(this._sessionsListInterval);
            this._sessionsListInterval = null;
          }
          return;
        }
        console.warn('Collaboration sessions unavailable:', error);
        this._sessionsList = [];
        this.sessionsListEmitter.emit([]);
      }
    };

    void fetchSessionsList();
    // Discoverable session list only — not the live roster. 30s is enough.
    this._sessionsListInterval = setInterval(fetchSessionsList, 30_000);

    const refreshRosterIfUnbound = async () => {
      const id = this._session?.id;
      if (!id || this._sessionRealtimeBound) return;
      try {
        const session = await apiClient.collaboration.getSession(id);
        if (session?.id) {
          this.applySessionUpdate(session);
        }
      } catch {
        // Session may have ended.
      }
    };
    this._rosterFallbackInterval = setInterval(refreshRosterIfUnbound, 15_000);
  }

  get currentSession() {
    return this._session;
  }

  get sessionsList() {
    return this._sessionsList;
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

function syncWsIdentityFromAuth() {
  const user = useAuthStore.getState().user;
  if (!user?.userId) {
    return;
  }
  const displayName =
    user.email?.trim() ||
    [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
    undefined;
  wsService.setIdentity(user.userId, displayName);
}

/** Cursor/selection map — subscribe only where UI needs it (avoids Spreadsheet re-renders). */
export function usePresence() {
  const [presence, setPresence] = useState<Map<string, UserPresence>>(
    () => new Map(wsService.presence)
  );

  useEffect(() => {
    return wsService.onPresenceChange(next => {
      setPresence(next);
    });
  }, []);

  return presence;
}

export function useSession() {
  const [wsReady, setWsReady] = useState(wsService.isReady);
  const [sessionLive, setSessionLive] = useState(wsService.isSessionLive);
  const [currentSession, setCurrentSession] = useState<Session | null>(wsService.currentSession);
  const [sessions, setSessions] = useState<Session[]>(() => wsService.sessionsList);

  useEffect(() => {
    syncWsIdentityFromAuth();
    return useAuthStore.subscribe(state => {
      if (state.user?.userId) {
        syncWsIdentityFromAuth();
      }
    });
  }, []);

  useEffect(() => {
    wsService.startBackgroundSync();

    const wsReadyCleanup = wsService.onWsReady(ready => {
      setWsReady(ready);
    });

    const sessionLiveCleanup = wsService.onSessionLive(live => {
      setSessionLive(live);
    });

    const sessionCleanup = wsService.onSessionChange(session => {
      setCurrentSession(session);
    });

    const sessionsCleanup = wsService.onSessionsListChange(list => {
      setSessions(list);
    });

    return () => {
      wsReadyCleanup();
      sessionLiveCleanup();
      sessionCleanup();
      sessionsCleanup();
    };
  }, []);

  // A session always forks `datasetId` — no filePath-only collaboration.
  const createSession = async (params: { datasetId: string; fileName: string }) => {
    try {
      const idToken = getIdToken();
      if (!idToken) {
        throw new Error('Authentication required');
      }
      if (!params.datasetId?.trim()) {
        throw new Error('datasetId is required to start a collaboration session');
      }

      syncWsIdentityFromAuth();
      const session = await apiClient.collaboration.createSession({
        ...params,
        userName: wsService.userName,
      });

      // REST create is authoritative for "am I in a session?" — apply it immediately so the
      // collaboration panel flips to the active view. Waiting only on the WebSocket
      // `initial_state` left the UI stuck on "Start Session" whenever the socket was slow
      // or failed to join (empty onerror). Presence/sheet sync still comes from setupWebSocket.
      wsService.applySessionUpdate(session);
      setSessions(prev => {
        if (prev.some(s => s.id === session.id)) return prev;
        return [session, ...prev];
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

      syncWsIdentityFromAuth();
      const userName = options?.userName?.trim() || wsService.userName;
      if (userName) {
        wsService.userName = userName;
      }

      const session = await apiClient.collaboration.joinSession(sessionId, { userName });
      wsService.applySessionUpdate(session);
      setSessions(prev => {
        if (prev.some(s => s.id === session.id)) return prev;
        return [session, ...prev];
      });
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

  /** Host-only: overwrite the source dataset with the fork's current data, then discard
   * the fork. See `sessions.py::post_save_back_session`. */
  const saveBackSession = async () => {
    const sessionId = wsService.currentSession?.id;
    if (!sessionId) {
      throw new Error('No active collaboration session');
    }
    try {
      return await apiClient.collaboration.saveBack(sessionId);
    } catch (error) {
      console.error('Failed to save back collaboration session:', error);
      throw error;
    }
  };

  /** Host-only: drop the fork's changes entirely and end the session. See
   * `sessions.py::post_discard_session`. */
  const discardSession = async () => {
    const sessionId = wsService.currentSession?.id;
    if (!sessionId) {
      throw new Error('No active collaboration session');
    }
    try {
      return await apiClient.collaboration.discard(sessionId);
    } catch (error) {
      console.error('Failed to discard collaboration session:', error);
      throw error;
    }
  };

  const updatePresence = useCallback((cursor: UserPresence['cursor']) => {
    wsService.updatePresence(cursor);
  }, []);

  return {
    wsReady,
    /** Socket has completed WS `join` + `initial_state` — presence/ops will actually deliver. */
    sessionLive,
    currentSession,
    sessions,
    createSession,
    joinSession,
    leaveSession,
    updateParticipantRole,
    saveBackSession,
    discardSession,
    ws: wsService.socket,
    updatePresence,
    clientId: wsService.userId,
  };
}
